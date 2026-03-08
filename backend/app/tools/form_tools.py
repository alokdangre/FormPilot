"""
FormPilot ADK Function Tools.

These are the tools the ADK agent can call during bidi-streaming.
When the agent calls a tool, ADK handles the function calling protocol
with Gemini automatically — we just define the Python functions.

CRITICAL: fill_field_tool uses a WebSocket callback to send fill commands
BACK to the browser extension. Without this, tools run server-side but
the DOM changes never reach the browser.
"""

import json
import asyncio
import logging
import re
from typing import Optional

logger = logging.getLogger("FormPilot")

# In-memory storage for current session state
_current_form_fields = []
_current_screenshot = None
_current_prompted_field_label = None
_current_verification_issues = []
_pending_fill_slots = 0
_last_final_transcript = ""
_pending_fill_target_label = None
_active_transcript_target_label = None

# WebSocket callback — set by main.py when live WS connects
# This is how tools send commands BACK to the browser
_ws_send_callback = None

# User profile is empty by default so the agent asks the user for info
USER_PROFILE = {}
BOOLEAN_TRUE = {"true", "yes", "y", "1", "on", "checked"}
BOOLEAN_FALSE = {"false", "no", "n", "0", "off", "unchecked"}
BOOLEAN_TRUE_PHRASES = (
    "i do",
    "yes i do",
    "i have",
    "already have",
    "i already have",
    "yep",
    "yeah",
    "sure",
    "affirmative",
)
BOOLEAN_FALSE_PHRASES = (
    "i don't",
    "i dont",
    "do not",
    "don't",
    "dont",
    "i do not",
    "i do n't",
    "nope",
    "nah",
    "not really",
    "have not",
    "haven't",
)
KEEP_EXISTING_PHRASES = (
    "already entered",
    "already filled",
    "already there",
    "it is correct",
    "it's correct",
    "already correct",
    "looks correct",
    "that is correct",
)
SAME_VALUE_PHRASES = {
    "email": ("same email", "same mail", "same e mail", "same as above", "same one"),
    "phone": ("same phone", "same number", "same mobile"),
}


def analyze_form_tool() -> dict:
    """Analyze the current web form visible in the browser.
    
    Returns a list of form fields detected on the page with their labels,
    types, current values, and whether they need user input.
    Call this when the user asks you to fill a form.
    
    Returns:
        dict: Contains 'fields' list with detected form fields.
    """
    if _current_form_fields:
        summary = []
        for f in _current_form_fields:
            status = f.get("status", "unknown")
            label = f.get("label", "unknown")
            val = f.get("resolved_value", "")
            ftype = f.get("type", "text")
            if status == "matched":
                summary.append(f"✅ {label} ({ftype}) = {val[:30]}")
            else:
                summary.append(f"⏳ {label} ({ftype}) — needs input")
        
        return {
            "fields": summary,
            "count": len(_current_form_fields),
            "matched": sum(1 for f in _current_form_fields if f.get("status") == "matched"),
            "pending": sum(1 for f in _current_form_fields if f.get("status") != "matched"),
            "verification_issues": len(_current_verification_issues),
        }
    return {
        "fields": [],
        "count": 0,
        "message": "No form analyzed yet. Ask user to click Analyze first."
    }


def get_next_pending_field_tool() -> dict:
    """Return the next pending field and remember it for the next voice answer."""
    global _current_prompted_field_label

    field = _get_next_pending_field(prefer_current=True)
    if not field:
        _current_prompted_field_label = None
        return {
            "status": "complete",
            "remaining": 0,
            "message": "No pending fields remain."
        }

    _current_prompted_field_label = field.get("label")
    return {
        "status": "pending",
        "remaining": _count_pending_fields(),
        "field_label": field.get("label", ""),
        "field_type": field.get("type", "text"),
        "options": _stringify_options(field),
        "question": _build_voice_question(field),
    }


def fill_field_tool(field_label: str, value: str) -> dict:
    """Fill a specific form field in the browser with the given value.
    
    This sends a command to the browser extension to actually fill the field.
    Use this when the user provides a value for a pending field.
    
    Args:
        field_label: The label of the field to fill (e.g., "Full Name", "Email")
        value: The value to enter into the field
    
    Returns:
        dict: Result of the fill operation.
    """
    if not _claim_fill_slot(field_label, enforce_target=False):
        return {
            "status": "awaiting_user_answer",
            "message": "Wait for the user's next completed answer before filling another field.",
        }
    return _send_fill_command(field_label, value)


def fill_current_pending_field_tool(value: str) -> dict:
    """Fill the currently prompted pending field, then return the next one if any."""
    global _current_prompted_field_label

    field = _get_next_pending_field(prefer_current=True)
    if not field:
        _current_prompted_field_label = None
        return {
            "status": "complete",
            "remaining": 0,
            "message": "No pending fields remain."
        }

    field_label = field.get("label", "")
    if not _claim_fill_slot(field_label, enforce_target=True):
        _current_prompted_field_label = field_label
        return {
            "status": "awaiting_user_answer",
            "field_label": field_label,
            "remaining": _count_pending_fields(),
            "message": "Wait for the user's answer to this exact field before filling it.",
        }

    fill_result = _send_fill_command(field_label, value)
    if fill_result.get("status") == "awaiting_user_answer":
        _current_prompted_field_label = field_label
        return {
            "status": "awaiting_user_answer",
            "field_label": field_label,
            "remaining": _count_pending_fields(),
            "message": fill_result.get("message", "Waiting for the user to finish the next answer."),
        }

    if fill_result.get("status") == "clarification_needed":
        _current_prompted_field_label = field_label
        return {
            "status": "clarification_needed",
            "field_label": field_label,
            "remaining": _count_pending_fields(),
            "question": fill_result.get("message", _build_clarification_question(field)),
            "options": fill_result.get("options", _stringify_options(field)),
        }

    if fill_result.get("status") != "sent":
        return {
            "status": "error",
            "field_label": field_label,
            "message": fill_result.get("message", "Unable to fill the field."),
        }

    _current_prompted_field_label = None
    next_field = _get_next_pending_field(prefer_current=False)
    if not next_field:
        return {
            "status": "complete",
            "field_label": field_label,
            "filled_value": _sanitize_field_value(field, value),
            "remaining": 0,
            "message": "All pending fields are filled."
        }

    _current_prompted_field_label = next_field.get("label")
    return {
        "status": "filled",
        "field_label": field_label,
        "filled_value": _sanitize_field_value(field, value),
        "remaining": _count_pending_fields(),
        "next_field_label": next_field.get("label", ""),
        "next_question": _build_voice_question(next_field),
        "next_options": _stringify_options(next_field),
    }


def get_user_profile_tool() -> dict:
    """Get the user's stored profile data for form filling.
    
    Returns the user's personal information that can be used to fill forms.
    
    Returns:
        dict: User profile with name, email, phone, address, etc.
    """
    return {
        "profile": USER_PROFILE,
        "message": f"Profile loaded with {len(USER_PROFILE)} data points."
    }


def get_verification_issues_tool() -> dict:
    """Return the latest actionable verification issues."""
    if not _current_verification_issues:
        return {
            "count": 0,
            "issues": [],
            "message": "No actionable verification issues are open."
        }

    summaries = []
    for issue in _current_verification_issues:
        label = _normalize_text(issue.get("field") or issue.get("label"))
        expected = _normalize_text(issue.get("expected"))
        actual = _normalize_text(issue.get("actual"))
        summary = label or "Unknown field"
        if expected:
            summary = f"{summary} | expected: {expected}"
        if actual:
            summary = f"{summary} | actual: {actual}"
        summaries.append(summary)

    return {
        "count": len(_current_verification_issues),
        "issues": summaries,
        "message": "Use these issues to guide the correction conversation."
    }


def set_form_context(fields: list, screenshot: str = None):
    """Called by the WebSocket handler to update the agent's form context.
    Not a tool — internal function."""
    global _current_form_fields, _current_screenshot, _current_prompted_field_label, _current_verification_issues, _pending_fill_slots, _last_final_transcript, _pending_fill_target_label, _active_transcript_target_label
    _current_form_fields = fields
    _current_screenshot = screenshot
    _current_prompted_field_label = None
    _current_verification_issues = []
    _pending_fill_slots = 0
    _last_final_transcript = ""
    _pending_fill_target_label = None
    _active_transcript_target_label = None


def set_ws_callback(callback):
    """Set the WebSocket send callback. Called by main.py when live WS connects."""
    global _ws_send_callback
    _ws_send_callback = callback
    logger.info("[Tools] WebSocket callback registered")


def clear_ws_callback():
    """Clear the callback when WS disconnects."""
    global _ws_send_callback
    _ws_send_callback = None


def note_final_user_transcript(text: str):
    global _pending_fill_slots, _last_final_transcript, _pending_fill_target_label, _active_transcript_target_label
    cleaned = _normalize_text(text)
    if not cleaned:
        return
    _last_final_transcript = cleaned
    _pending_fill_slots = 1
    _pending_fill_target_label = _normalize_text(_active_transcript_target_label or _current_prompted_field_label)
    _active_transcript_target_label = None


def note_live_user_transcription(text: str, finished: bool):
    global _active_transcript_target_label
    cleaned = _normalize_text(text)
    if not cleaned:
        return

    if not finished and not _active_transcript_target_label:
        _active_transcript_target_label = _normalize_text(_current_prompted_field_label)
        return

    if finished:
        note_final_user_transcript(cleaned)


def set_verification_issues(issues: list):
    global _current_verification_issues, _current_prompted_field_label, _pending_fill_slots, _pending_fill_target_label, _active_transcript_target_label
    _current_verification_issues = issues or []
    _current_prompted_field_label = None
    _pending_fill_slots = 0
    _pending_fill_target_label = None
    _active_transcript_target_label = None

    for field in _current_form_fields:
        field.pop("verification_issue", None)
        field.pop("last_attempted_value", None)

    issue_map = {}
    for issue in _current_verification_issues:
        label = _normalize_text(issue.get("field") or issue.get("label")).lower()
        if label:
            issue_map[label] = issue

    for field in _current_form_fields:
        label = _normalize_text(field.get("label")).lower()
        issue = issue_map.get(label)
        if not issue:
            continue

        field["status"] = "pending"
        field["needs_user_input"] = True
        field["verification_issue"] = issue
        field["last_attempted_value"] = field.get("resolved_value", "")
        if issue.get("actual"):
            field["current_value"] = issue.get("actual")
        field["resolved_value"] = ""


def clear_verification_issues():
    global _current_verification_issues, _pending_fill_target_label, _active_transcript_target_label
    _current_verification_issues = []
    _pending_fill_target_label = None
    _active_transcript_target_label = None
    for field in _current_form_fields:
        field.pop("verification_issue", None)
        field.pop("last_attempted_value", None)


def register_browser_fill_result(field_label: str, success: bool, actual_value: str = "", error: str = "") -> dict:
    global _current_prompted_field_label

    field = _find_field_by_label(field_label)
    if not field:
        return {"status": "ignored", "message": "Field not found in current context."}

    actual = _normalize_text(actual_value)
    if success:
        if actual:
            field["current_value"] = actual
            field["resolved_value"] = actual
        field["status"] = "matched"
        field["needs_user_input"] = False
        field.pop("verification_issue", None)
        field.pop("last_attempted_value", None)
        field.pop("browser_fill_error", None)
        return {
            "status": "confirmed",
            "field_label": field.get("label", field_label),
            "actual_value": actual,
        }

    field["status"] = "pending"
    field["needs_user_input"] = True
    field["last_attempted_value"] = field.get("resolved_value", "")
    field["resolved_value"] = ""
    if actual:
        field["current_value"] = actual
    if error:
        field["browser_fill_error"] = error
    _current_prompted_field_label = field.get("label")
    return {
        "status": "failed",
        "field_label": field.get("label", field_label),
        "actual_value": actual,
        "error": error,
    }


def _normalize_text(value: str | None) -> str:
    return str(value or "").strip()


def _find_field_by_label(field_label: str) -> Optional[dict]:
    target = _normalize_text(field_label).lower()
    if not target:
        return None

    for field in _current_form_fields:
        label = _normalize_text(field.get("label")).lower()
        if label == target:
            return field

    for field in _current_form_fields:
        label = _normalize_text(field.get("label")).lower()
        if target and (target in label or label in target):
            return field

    return None


def _get_next_pending_field(prefer_current: bool) -> Optional[dict]:
    if prefer_current and _current_prompted_field_label:
        current = _find_field_by_label(_current_prompted_field_label)
        if current and current.get("status") != "matched":
            return current

    for field in _current_form_fields:
        if field.get("status") != "matched":
            return field
    return None


def _count_pending_fields() -> int:
    return sum(1 for field in _current_form_fields if field.get("status") != "matched")


def _stringify_options(field: Optional[dict]) -> list[str]:
    if not field:
        return []

    options = []
    for option in field.get("options", []) or []:
        if isinstance(option, dict):
            text = _normalize_text(option.get("text") or option.get("value"))
        else:
            text = _normalize_text(option)
        if text:
            options.append(text)
    return options


def _build_voice_question(field: dict) -> str:
    label = _normalize_text(field.get("label")) or "this field"
    field_type = _normalize_text(field.get("type")).lower()
    options = _stringify_options(field)
    verification_issue = field.get("verification_issue") or {}
    actual = _normalize_text(verification_issue.get("actual"))

    if label.endswith("?"):
        question = label
    else:
        question = f"What should I enter for {label}?"

    if actual and "not visible" not in actual.lower():
        question = f"I need to update {label}. It currently looks like {actual}. What should I change it to?"

    if field_type in {"radio", "checkbox", "select", "combobox"} and options:
        if len(options) <= 5:
            joined_options = ", ".join(options)
            question = f"{question} Options are {joined_options}."

    return question


def _sanitize_field_value(field: Optional[dict], value: str) -> Optional[str]:
    normalized_value = _normalize_text(value)
    if not normalized_value or not field:
        return normalized_value

    reference_value = _resolve_reference_value(field, normalized_value)
    if reference_value:
        return reference_value

    field_type = _normalize_text(field.get("type")).lower()
    options = _stringify_options(field)
    desired = normalized_value.lower()
    desired_bool = _canonical_boolean(desired)

    if field_type in {"checkbox", "switch"} and not options:
        if desired_bool == "true":
            return "true"
        if desired_bool == "false":
            return "false"
        return None

    if not options:
        return normalized_value

    for option in options:
        if option.lower() == desired:
            return option

    if desired_bool is not None:
        for option in options:
            if _canonical_boolean(option.lower()) == desired_bool:
                return option

    for option in options:
        option_lower = option.lower()
        if desired in option_lower or option_lower in desired:
            return option

    if _is_choice_field(field):
        return None

    return normalized_value


def _canonical_boolean(value: str | None) -> Optional[str]:
    normalized = _normalize_text(value).lower()
    if normalized in BOOLEAN_TRUE:
        return "true"
    if normalized in BOOLEAN_FALSE:
        return "false"

    token_text = " ".join(re.findall(r"[a-z0-9']+", normalized))
    if any(phrase in token_text for phrase in BOOLEAN_FALSE_PHRASES):
        return "false"
    if any(phrase in token_text for phrase in BOOLEAN_TRUE_PHRASES):
        return "true"
    return None


def _is_choice_field(field: Optional[dict]) -> bool:
    if not field:
        return False
    return _normalize_text(field.get("type")).lower() in {"radio", "checkbox", "switch", "select", "combobox", "multiselect"}


def _build_clarification_question(field: Optional[dict]) -> str:
    label = _normalize_text((field or {}).get("label")) or "this field"
    options = _stringify_options(field)
    if options:
        return f"I need a valid option for {label}. Please answer with one of: {', '.join(options)}."
    return f"I didn't catch a valid value for {label}. Please say it again."


def _resolve_reference_value(field: Optional[dict], normalized_value: str) -> Optional[str]:
    if not field:
        return None

    lowered = normalized_value.lower()
    current_value = _normalize_text(field.get("current_value"))
    semantic_type = _normalize_text(field.get("semantic_type")).lower()
    label = _normalize_text(field.get("label")).lower()

    if current_value and any(phrase in lowered for phrase in KEEP_EXISTING_PHRASES):
        return current_value

    if semantic_type == "email" or "email" in label:
        if any(phrase in lowered for phrase in SAME_VALUE_PHRASES["email"]):
            return _normalize_text(USER_PROFILE.get("email")) or current_value or None

    if semantic_type == "tel" or "phone" in label or "mobile" in label:
        if any(phrase in lowered for phrase in SAME_VALUE_PHRASES["phone"]):
            return _normalize_text(USER_PROFILE.get("phone")) or current_value or None

    return None


def _claim_fill_slot(field_label: str, enforce_target: bool) -> bool:
    global _pending_fill_slots, _pending_fill_target_label
    if _pending_fill_slots <= 0:
        return False

    if enforce_target:
        target = _normalize_text(_pending_fill_target_label).lower()
        desired = _normalize_text(field_label).lower()
        if target and desired and target != desired:
            return False

    _pending_fill_slots -= 1
    _pending_fill_target_label = None
    return True


def _send_fill_command(field_label: str, value: str) -> dict:
    field = _find_field_by_label(field_label)
    normalized_value = _sanitize_field_value(field, value)
    if field and _is_choice_field(field) and normalized_value is None:
        return {
            "status": "clarification_needed",
            "field_label": field_label,
            "message": _build_clarification_question(field),
            "options": _stringify_options(field),
        }

    payload_data = {
        "type": "TOOL_FILL_FIELD",
        "label": field_label,
        "value": normalized_value,
    }

    if field:
        payload_data.update({
            "selector": field.get("selector"),
            "name": field.get("name", ""),
            "fieldType": field.get("type", "text"),
        })

    if _ws_send_callback:
        try:
            payload = json.dumps(payload_data)

            try:
                loop = asyncio.get_running_loop()
                loop.create_task(_ws_send_callback(payload))
            except RuntimeError:
                try:
                    loop = asyncio.get_event_loop()
                    asyncio.run_coroutine_threadsafe(_ws_send_callback(payload), loop)
                except Exception:
                    pass

            _mark_field_as_filled(field_label, normalized_value)
            _remember_profile_value(field, normalized_value)

            logger.info(f"[Tool] Fill command sent: {field_label} = {normalized_value[:30]}")
            return {
                "status": "sent",
                "message": f"Filling '{field_label}' with '{normalized_value[:30]}'"
            }
        except Exception as e:
            logger.error(f"[Tool] Fill send error: {e}")
            return {"status": "error", "message": str(e)}

    logger.warning("[Tool] No WebSocket callback — can't fill field")
    return {
        "status": "no_connection",
        "message": "No active browser connection. Ask user to reconnect."
    }


def _mark_field_as_filled(field_label: str, value: str):
    field = _find_field_by_label(field_label)
    if not field:
        return

    field["resolved_value"] = value
    field["current_value"] = value
    field["status"] = "matched"
    field["needs_user_input"] = False


def _remember_profile_value(field: Optional[dict], value: str):
    if not field:
        return

    semantic_type = _normalize_text(field.get("semantic_type")).lower()
    label = _normalize_text(field.get("label")).lower()

    key_map = {
        "email": "email",
        "tel": "phone",
        "country": "country",
        "city": "city",
        "state": "state",
        "street-address": "address",
        "postal-code": "postal_code",
        "given-name": "first_name",
        "family-name": "last_name",
        "name": "full_name",
        "organization": "organization",
        "date": "date_of_birth",
    }

    profile_key = key_map.get(semantic_type)
    if not profile_key:
        if "google cloud account" in label:
            profile_key = "has_google_cloud_account"
        elif "country" in label:
            profile_key = "country"
        elif "phone" in label:
            profile_key = "phone"

    if profile_key:
        USER_PROFILE[profile_key] = value

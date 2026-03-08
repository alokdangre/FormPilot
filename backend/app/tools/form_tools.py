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
from typing import Optional

logger = logging.getLogger("FormPilot")

# In-memory storage for current session state
_current_form_fields = []
_current_screenshot = None
_current_prompted_field_label = None

# WebSocket callback — set by main.py when live WS connects
# This is how tools send commands BACK to the browser
_ws_send_callback = None

# User profile is empty by default so the agent asks the user for info
USER_PROFILE = {}
BOOLEAN_TRUE = {"true", "yes", "y", "1", "on", "checked"}
BOOLEAN_FALSE = {"false", "no", "n", "0", "off", "unchecked"}


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
    field = _find_field_by_label(field_label)
    normalized_value = _sanitize_field_value(field, value)
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

    # Send fill command to the browser through the WebSocket callback
    if _ws_send_callback:
        try:
            payload = json.dumps(payload_data)
            
            # Schedule the async send on the running event loop
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(_ws_send_callback(payload))
            except RuntimeError:
                # No running loop — try get_event_loop() + run_coroutine_threadsafe
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
    else:
        logger.warning("[Tool] No WebSocket callback — can't fill field")
        return {
            "status": "no_connection",
            "message": "No active browser connection. Ask user to reconnect."
        }


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
    fill_result = fill_field_tool(field_label, value)
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


def set_form_context(fields: list, screenshot: str = None):
    """Called by the WebSocket handler to update the agent's form context.
    Not a tool — internal function."""
    global _current_form_fields, _current_screenshot, _current_prompted_field_label
    _current_form_fields = fields
    _current_screenshot = screenshot
    _current_prompted_field_label = None


def set_ws_callback(callback):
    """Set the WebSocket send callback. Called by main.py when live WS connects."""
    global _ws_send_callback
    _ws_send_callback = callback
    logger.info("[Tools] WebSocket callback registered")


def clear_ws_callback():
    """Clear the callback when WS disconnects."""
    global _ws_send_callback
    _ws_send_callback = None


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

    if label.endswith("?"):
        question = label
    else:
        question = f"What should I enter for {label}?"

    if field_type in {"radio", "checkbox", "select", "combobox"} and options:
        if len(options) <= 5:
            joined_options = ", ".join(options)
            question = f"{question} Options are {joined_options}."

    return question


def _sanitize_field_value(field: Optional[dict], value: str) -> str:
    normalized_value = _normalize_text(value)
    if not normalized_value or not field:
        return normalized_value

    options = _stringify_options(field)
    if not options:
        return normalized_value

    desired = normalized_value.lower()
    desired_bool = _canonical_boolean(desired)

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

    return normalized_value


def _canonical_boolean(value: str | None) -> Optional[str]:
    normalized = _normalize_text(value).lower()
    if normalized in BOOLEAN_TRUE:
        return "true"
    if normalized in BOOLEAN_FALSE:
        return "false"
    return None


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

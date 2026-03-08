"""
FormPilot Data Resolver — AI-Powered Field Matching.

Uses Gemini to intelligently match form fields to user profile data.
This is GENERIC — works for ANY form, not hardcoded to specific labels.

Strategy:
1. Fast pass: match obvious fields by type (email → email, tel → phone)
2. AI pass: send remaining unmatched fields to Gemini for semantic matching
"""

import os
import json
import asyncio
import logging
from google import genai
from google.genai import types

logger = logging.getLogger("FormPilot")

# User profile is empty by default so the agent asks the user for info
USER_PROFILE = {}
BOOLEAN_TRUE = {"true", "yes", "y", "1", "on", "checked"}
BOOLEAN_FALSE = {"false", "no", "n", "0", "off", "unchecked"}


def resolve_field_data(merged_fields: list) -> list:
    """
    Two-pass resolver:
    Pass 1 — Fast type-based matching for obvious fields
    Pass 2 — AI-powered semantic matching for remaining fields
    """
    resolved = []
    unmatched_indices = []
    
    for i, f in enumerate(merged_fields):
        label = str(f.get("label", "")).lower().strip()
        field_type = str(f.get("type", "text")).lower()
        
        # Pass 1: Fast match by field type + simple keyword
        value = _fast_match(label, field_type, f)
        value = _sanitize_match_value(f, value)
        
        if value is not None:
            f["resolved_value"] = value
            f["status"] = "matched"
            f["needs_user_input"] = False
        else:
            f["resolved_value"] = ""
            f["status"] = "pending"
            f["needs_user_input"] = True
            unmatched_indices.append(i)
        
        resolved.append(f)
    
    # Pass 2: If there are unmatched fields, use AI
    if unmatched_indices and _has_meaningful_profile_data():
        try:
            ai_matches = _ai_match([resolved[i] for i in unmatched_indices])
            for idx, match_value in zip(unmatched_indices, ai_matches):
                sanitized_value = _sanitize_match_value(resolved[idx], match_value)
                if sanitized_value:
                    resolved[idx]["resolved_value"] = sanitized_value
                    resolved[idx]["status"] = "matched"
                    resolved[idx]["needs_user_input"] = False
        except Exception as e:
            logger.warning(f"AI matching failed, leaving fields as pending: {e}")
    
    return resolved


def _fast_match(label: str, field_type: str, field: dict | None = None) -> str | None:
    """
    Fast keyword-based matching. Works for common field types.
    Returns None if no confident match.
    """
    profile = USER_PROFILE
    field = field or {}
    semantic_type = str(field.get("semantic_type", "")).lower().strip()

    if not profile:
        return None
    
    # Type-based: if the HTML input type tells us what it wants
    if field_type == "tel" or semantic_type == "tel":
        return profile.get("phone")
    if field_type == "date" or semantic_type == "date":
        return profile.get("date_of_birth")
    
    # Email fields — but need context from label to pick the right email
    if field_type == "email" or semantic_type == "email" or (field_type == "text" and label in ("email", "email address", "your email", "your email address")):
        return profile.get("email")
    
    # Name fields
    if label in ("name", "full name", "your name", "full_name"):
        return profile.get("full_name")
    if "first name" in label and "last" not in label:
        return profile.get("first_name")
    if "last name" in label:
        return profile.get("last_name")
    
    # Phone
    if any(kw in label for kw in ("phone", "mobile", "telephone", "cell")):
        return profile.get("phone")
    
    # Address
    if semantic_type == "street-address" or label in ("address", "street address", "your address"):
        return profile.get("address")
    if semantic_type == "city" or label in ("city", "your city"):
        return profile.get("city")
    if semantic_type in ("state", "province") or label in ("state", "province", "your state"):
        return profile.get("state")
    
    # Country — very common
    if semantic_type == "country" or "country" in label or "resident" in label:
        return profile.get("country")
    
    # No confident fast match
    return None


def _has_meaningful_profile_data() -> bool:
    return any(str(value).strip() for value in USER_PROFILE.values())


def _sanitize_match_value(field: dict, value: str | None) -> str | None:
    if value is None:
        return None

    normalized_value = str(value).strip()
    if not normalized_value:
        return None

    options = field.get("options", []) or []
    if not options:
        return normalized_value

    option_pairs = []
    for option in options:
        if isinstance(option, dict):
            text = str(option.get("text", "")).strip()
            raw_value = str(option.get("value", text)).strip()
        else:
            text = str(option).strip()
            raw_value = text

        if text or raw_value:
            option_pairs.append((text, raw_value))

    if not option_pairs:
        return normalized_value

    desired = normalized_value.lower()
    desired_bool = _canonical_boolean(desired)

    exact_text = next((text for text, _ in option_pairs if text and text.lower() == desired), None)
    if exact_text:
        return exact_text

    exact_value = next((text or raw for text, raw in option_pairs if raw and raw.lower() == desired), None)
    if exact_value:
        return exact_value

    if desired_bool is not None:
        bool_match = next(
            (
                text or raw
                for text, raw in option_pairs
                if _canonical_boolean(text.lower()) == desired_bool or _canonical_boolean(raw.lower()) == desired_bool
            ),
            None,
        )
        if bool_match:
            return bool_match

    fuzzy_match = next(
        (
            text or raw
            for text, raw in option_pairs
            if (text and desired in text.lower()) or (raw and desired in raw.lower())
        ),
        None,
    )
    return fuzzy_match


def _canonical_boolean(value: str) -> str | None:
    if value in BOOLEAN_TRUE:
        return "true"
    if value in BOOLEAN_FALSE:
        return "false"
    return None


def _ai_match(unmatched_fields: list) -> list:
    """
    Use Gemini to semantically match form fields to profile data.
    Sends ONE API call for ALL unmatched fields at once.
    """
    client = genai.Client()
    if not _has_meaningful_profile_data():
        return [""] * len(unmatched_fields)
    
    # Build the prompt
    fields_desc = []
    for i, f in enumerate(unmatched_fields):
        field_type = f.get("type", "text")
        options = f.get("options", [])
        options_str = ""
        if options:
            opt_texts = [o.get("text", o.get("value", str(o))) if isinstance(o, dict) else str(o) for o in options]
            options_str = f" Options: {opt_texts}"
        semantic_type = f.get("semantic_type", "")
        semantic_str = f" | Semantic: {semantic_type}" if semantic_type else ""
        fields_desc.append(f'{i+1}. Label: "{f.get("label", "")}" | Type: {field_type}{semantic_str}{options_str}')
    
    fields_text = "\n".join(fields_desc)
    
    profile_text = json.dumps(USER_PROFILE, indent=2)
    
    prompt = f"""You are a form-filling assistant. Match these form fields to user profile data.

FORM FIELDS (unmatched):
{fields_text}

USER PROFILE:
{profile_text}

INSTRUCTIONS:
- For each field, return the EXACT value from the profile that should go in that field.
- If a field asks a yes/no question, answer based on the profile data.
- If a field has options (radio/select), pick the matching option text.
- If no profile data matches, return empty string "".
- Never guess values that are not supported by the profile.
- Return ONLY a JSON array of strings, one per field, in order.
- Example: ["value1", "Yes", "", "India"]

IMPORTANT: Return ONLY the JSON array, nothing else."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,  # Low temperature for deterministic matching
                response_mime_type="application/json",
            )
        )
        
        result_text = response.text.strip()
        # Parse JSON array
        values = json.loads(result_text)
        
        if isinstance(values, list) and len(values) == len(unmatched_fields):
            logger.info(f"AI matched {sum(1 for v in values if v)} of {len(values)} fields")
            return values
        else:
            logger.warning(f"AI returned wrong format: {result_text[:200]}")
            return [""] * len(unmatched_fields)
            
    except Exception as e:
        logger.error(f"AI matching error: {e}")
        return [""] * len(unmatched_fields)


async def resolve_field_data_async(merged_fields: list) -> list:
    """Async version — runs AI matching in executor to avoid blocking."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, resolve_field_data, merged_fields)

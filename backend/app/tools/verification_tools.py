import json
import base64
import asyncio
from typing import Dict, Any
from google import genai
from google.genai import types

BOOLEAN_TRUE = {"true", "yes", "y", "1", "on", "checked"}
BOOLEAN_FALSE = {"false", "no", "n", "0", "off", "unchecked"}


def verify_filled_form_dom(actual_fields: list, expected_values: list) -> Dict[str, Any]:
    """
    DOM-first verification.
    Compares the latest extracted DOM values against the values we intended
    to inject. This avoids screenshot false negatives for fields outside
    the current viewport.
    """
    issues = []

    for expected in expected_values:
        if expected.get("status") != "matched":
            continue

        expected_value = _normalize_compare_value(expected, expected.get("resolved_value", ""))
        if not expected_value:
            continue

        actual = _find_actual_field(expected, actual_fields)
        if not actual:
            issues.append({
                "field": expected.get("label", "Unknown field"),
                "expected": expected.get("resolved_value", ""),
                "actual": "Field not found in DOM.",
            })
            continue

        actual_raw = actual.get("current_value", actual.get("value", ""))
        actual_value = _normalize_compare_value(expected, actual_raw)

        if actual_value == expected_value:
            continue

        expected_bool = _canonical_boolean(expected_value)
        actual_bool = _canonical_boolean(actual_value)
        if expected_bool and actual_bool and expected_bool == actual_bool:
            continue

        issues.append({
            "field": expected.get("label", "Unknown field"),
            "expected": expected.get("resolved_value", ""),
            "actual": actual_raw,
        })

    return {
        "verified": not issues,
        "issues": issues,
    }

async def verify_filled_form(screenshot_b64: str, expected_values: list) -> Dict[str, Any]:
    """
    Self-verification loop.
    Takes the filled form screenshot and the list of expected values,
    and asks Gemini Vision to verify if the UI reflects these values.
    """
    if "," in screenshot_b64:
        screenshot_b64 = screenshot_b64.split(",")[1]
        
    try:
        image_bytes = base64.b64decode(screenshot_b64)
    except Exception as e:
        print(f"[Verify] Error decoding image: {e}")
        return {"verified": False, "issues": [{"error": "Invalid image format"}]}

    client = genai.Client()
    
    expected_summary = json.dumps([
        {"label": f.get('label'), "value_we_injected": f.get('resolved_value')} 
        for f in expected_values if f.get('status') == 'matched'
    ])
    
    prompt = f"""You are an automated QA bot. I filled out the web form in this screenshot.
    Here is the data I injected: {expected_summary}.
    
    Verify that form fields display the injected data.
    Return JSON: {{"verified": bool, "issues": [{{"field": "name", "expected": "val", "actual": "val"}}]}}
    If all correct, issues should be empty list."""
    
    try:
        def _call():
            return client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type='image/png'),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                ),
            )
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, _call)
        parsed = json.loads(response.text)
        return parsed
    except Exception as e:
        print(f"[Verify] Gemini Error: {e}")
        return {"verified": False, "issues": [{"error": str(e)}]}


def _find_actual_field(expected: dict, actual_fields: list) -> dict | None:
    selector = str(expected.get("selector", "")).strip()
    if selector:
        exact = next((field for field in actual_fields if str(field.get("selector", "")).strip() == selector), None)
        if exact:
            return exact

    expected_label = str(expected.get("label", "")).strip().lower()
    if not expected_label:
        return None

    for field in actual_fields:
        actual_label = str(field.get("label", "")).strip().lower()
        if actual_label == expected_label:
            return field

    for field in actual_fields:
        actual_label = str(field.get("label", "")).strip().lower()
        if expected_label and actual_label and (expected_label in actual_label or actual_label in expected_label):
            return field

    return None


def _normalize_compare_value(field: dict, value: str) -> str:
    normalized = " ".join(str(value or "").strip().split())
    if not normalized:
        return ""

    field_type = str(field.get("type", "")).strip().lower()
    semantic_type = str(field.get("semantic_type", "")).strip().lower()
    label = str(field.get("label", "")).strip().lower()

    if field_type in {"radio", "checkbox", "switch", "select", "combobox"}:
        bool_value = _canonical_boolean(normalized.lower())
        if bool_value:
            return bool_value

    if semantic_type == "email" or "email" in label:
        return normalized.lower()

    return normalized.lower()


def _canonical_boolean(value: str) -> str | None:
    normalized = str(value or "").strip().lower()
    if normalized in BOOLEAN_TRUE:
        return "true"
    if normalized in BOOLEAN_FALSE:
        return "false"
    return None

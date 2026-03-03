import json
import base64
from typing import Dict, Any
from google import genai
from google.genai import types

async def verify_filled_form(screenshot_b64: str, expected_values: list) -> Dict[str, Any]:
    """
    Phase 5: Self-verification loop.
    Takes the filled form screenshot and the list of expected values,
    and asks Gemini Vision to verify if the UI reflects these values.
    """
    if "," in screenshot_b64:
        screenshot_b64 = screenshot_b64.split(",")[1]
        
    try:
        image_bytes = base64.b64decode(screenshot_b64)
    except Exception as e:
        print(f"Error decoding verification image: {e}")
        return {"verified": False, "issues": [{"error": "Invalid image format"}]}

    client = genai.Client()
    
    # We pass the list of fields we expected to fill
    expected_summary = json.dumps([{ "label": f.get('label'), "value_we_injected": f.get('resolved_value') } for f in expected_values if f.get('status') == 'matched'])
    
    prompt = f"""
    You are an automated QA bot. I have just attempted to fill out the web form in this screenshot.
    Here is the data I injected: {expected_summary}.
    
    Look closely at the screenshot. Verify that the form fields actually display the data I injected.
    Return a strictly formatted JSON object with this schema:
    {{
        "verified": bool, // True if NO issues found, False otherwise
        "issues": [
            {{
                "field": "Field Label",
                "expected": "What we tried to inject",
                "actual": "What is currently visible on screen"
            }}
        ]
    }}
    If all fields look correctly filled, 'issues' should be an empty list.
    """
    
    try:
        response = client.models.generate_content(
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
        parsed = json.loads(response.text)
        return parsed
    except Exception as e:
        print(f"Gemini Verification Error: {e}")
        return {"verified": False, "issues": [{"error": str(e)}]}

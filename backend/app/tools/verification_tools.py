import json
import base64
import asyncio
from typing import Dict, Any
from google import genai
from google.genai import types

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


import os
import json
import base64
from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
from google.genai import types

class GeminiFormField(BaseModel):
    label: str = Field(description="The visible label or inferred name of the field.")
    type_of_field: str = Field(description="Types: text, email, password, date, dropdown, checkbox, radio, textarea")
    position: str = Field(description="Approximate position (e.g., 'top-left', 'center')")
    required: bool = Field(description="Is this field strictly required?")
    options: Optional[List[str]] = Field(description="If dropdown or radio, list available options")

class FormAnalysisResult(BaseModel):
    fields: List[GeminiFormField]

def call_gemini_vision(screenshot_b64: str) -> List[dict]:
    # Ensure correct base64 stripping
    if "," in screenshot_b64:
        screenshot_b64 = screenshot_b64.split(",")[1]
    
    try:
        image_bytes = base64.b64decode(screenshot_b64)
    except Exception as e:
        print(f"Error decoding image: {e}")
        return []
    
    client = genai.Client()
    
    prompt = """
    You are a form analysis specialist. Analyze this screenshot of a web form 
    and identify ALL form input fields, textareas, and dropdowns. 
    Be exceptionally precise. Even if there are no explicit labels, 
    infer the field's objective from adjacent text, placeholders, or headers. 
    Pay special attention to Google Forms or Devpost structures where labels are floating text.
    """
    
    try:
        # Note: Using gemini-2.5-flash as mandated by plan
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type='image/png'),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=FormAnalysisResult,
                temperature=0.1
            ),
        )
        parsed = json.loads(response.text)
        return parsed.get("fields", [])
    except Exception as e:
        print(f"Gemini Vision Error: {e}")
        return []

def reconcile_fields(dom_fields: list, vision_fields: list) -> list:
    """Merge DOM fields with Vision fields resolving 'Unknown field' errors."""
    merged = []
    
    # We assign vision labels sequentially or fallback to semantic matches
    v_idx = 0
    for dom in dom_fields:
        label = dom.get("label", "Unknown field")
        
        # If DOM label failed, trust the Gemini Vision label
        if "Unknown" in label or not label.strip():
            if v_idx < len(vision_fields):
                # Apply intelligent vision label
                label = vision_fields[v_idx].get("label", "Unknown field")
                v_idx += 1
                
        merged.append({
            "selector": dom.get("selector"),
            "label": label,
            "type": dom.get("type", "text"),
            "current_value": dom.get("value", ""),
            "required": dom.get("required", False),
            "options": dom.get("options", []),
        })
        
    return merged

def process_form_analysis(screenshot_b64: str, dom_fields: list) -> list:
    """Main Orchestrator Entrypoint for Form Analysis"""
    print(f"Starting Gemini Vision Analysis with {len(dom_fields)} DOM nodes...")
    vision_fields = call_gemini_vision(screenshot_b64)
    print(f"Gemini Vision detected {len(vision_fields)} fields visually.")
    
    merged_fields = reconcile_fields(dom_fields, vision_fields)
    return merged_fields

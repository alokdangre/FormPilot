import os
import json
import base64
from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
from google.genai import types
import asyncio

class GeminiFormField(BaseModel):
    label: str = Field(description="The visible label or inferred name of the field.")
    type_of_field: str = Field(description="Types: text, email, password, date, dropdown, checkbox, radio, textarea")
    position: str = Field(description="Approximate position (e.g., 'top-left', 'center')")
    required: bool = Field(description="Is this field strictly required?")
    options: Optional[List[str]] = Field(description="If dropdown or radio, list available options")

class FormAnalysisResult(BaseModel):
    fields: List[GeminiFormField]


def dom_fields_are_sufficient(dom_fields: list) -> bool:
    """Check if DOM extraction gave us enough labeled fields to skip Vision."""
    if not dom_fields or len(dom_fields) == 0:
        return False
    
    labeled = 0
    for f in dom_fields:
        label = f.get("label", "")
        # If label is real (not "Unknown field", not empty, not just the input name)
        if label and "Unknown" not in label and len(label) > 2:
            labeled += 1
    
    # If 70%+ of fields have real labels, DOM is sufficient
    ratio = labeled / len(dom_fields) if dom_fields else 0
    print(f"[FormAnalyzer] DOM label quality: {labeled}/{len(dom_fields)} ({ratio:.0%})")
    return ratio >= 0.7


async def call_gemini_vision_async(screenshot_b64: str) -> List[dict]:
    """Async version of Gemini Vision call — doesn't block the WebSocket."""
    if "," in screenshot_b64:
        screenshot_b64 = screenshot_b64.split(",")[1]
    
    try:
        image_bytes = base64.b64decode(screenshot_b64)
    except Exception as e:
        print(f"[FormAnalyzer] Error decoding image: {e}")
        return []
    
    client = genai.Client()
    
    prompt = """You are a form analysis specialist. Analyze this screenshot of a web form 
    and identify ALL form input fields, textareas, and dropdowns. 
    Be precise. Infer field purpose from adjacent text, placeholders, or headers.
    Pay special attention to Google Forms or Devpost structures."""
    
    try:
        # Run the blocking Gemini call in a thread pool so it doesn't block the event loop
        def _call():
            return client.models.generate_content(
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
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, _call)
        
        parsed = json.loads(response.text)
        return parsed.get("fields", [])
    except Exception as e:
        print(f"[FormAnalyzer] Gemini Vision Error: {e}")
        return []


def reconcile_fields(dom_fields: list, vision_fields: list) -> list:
    """Merge DOM fields with Vision fields.
    
    Key fix: When DOM extraction fails (empty list), use Vision fields
    directly instead of returning nothing.
    """
    merged = []
    
    # CASE 1: No DOM fields — use Vision fields as primary source
    if not dom_fields and vision_fields:
        print(f"[FormAnalyzer] DOM empty. Using {len(vision_fields)} Vision fields as primary.")
        for v in vision_fields:
            merged.append({
                "selector": None,  # No DOM selector available
                "label": v.get("label", "Unknown field"),
                "type": v.get("type_of_field", "text"),
                "current_value": "",
                "required": v.get("required", False),
                "options": v.get("options", []) or [],
                "needs_computer_use": True,  # Will need coordinate-based filling
            })
        return merged
    
    # CASE 2: Normal merge — DOM is primary, Vision supplements labels
    v_idx = 0
    for dom in dom_fields:
        label = dom.get("label", "Unknown field")
        
        # If DOM label is unclear, try to get from Vision
        if "Unknown" in label or not label.strip():
            if v_idx < len(vision_fields):
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


async def process_form_analysis_async(screenshot_b64: str, dom_fields: list, send_update=None) -> list:
    """
    Main form analysis — now async with smart DOM-first shortcut.
    
    If DOM gives us good labels, skip Vision entirely (instant).
    If DOM labels are poor, call Vision to supplement (5-10s).
    """
    
    # CHECK: Can we skip Vision entirely?
    if dom_fields_are_sufficient(dom_fields):
        print(f"[FormAnalyzer] DOM is sufficient! Skipping Vision (instant mode).")
        if send_update:
            await send_update("DOM Complete", "Labels are clear. Skipping Vision AI for speed. ⚡")
        
        # Just use DOM fields directly — no Gemini call needed
        merged = reconcile_fields(dom_fields, [])
        return merged
    
    # DOM labels are poor — we need Vision
    print(f"[FormAnalyzer] DOM labels insufficient. Running Gemini Vision...")
    if send_update:
        await send_update("Vision AI running...", "DOM labels unclear. Using Gemini Vision to identify fields...")
    
    vision_fields = await call_gemini_vision_async(screenshot_b64)
    print(f"[FormAnalyzer] Vision detected {len(vision_fields)} fields.")
    
    if send_update:
        await send_update("Merging results...", f"Vision found {len(vision_fields)} fields. Reconciling with DOM...")
    
    merged = reconcile_fields(dom_fields, vision_fields)
    return merged


# Keep synchronous version as fallback
def process_form_analysis(screenshot_b64: str, dom_fields: list) -> list:
    """Synchronous version (legacy). Use process_form_analysis_async instead."""
    import asyncio
    return asyncio.run(process_form_analysis_async(screenshot_b64, dom_fields))

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

# WebSocket callback — set by main.py when live WS connects
# This is how tools send commands BACK to the browser
_ws_send_callback = None

# User profile (will later come from chrome.storage.local)
USER_PROFILE = {
    "full_name": "Alok Dangre",
    "first_name": "Alok",
    "last_name": "Dangre",
    "email": "alokdangre@gmail.com",
    "phone": "+91 9876543210",
    "address": "123 ABC Colony",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "date_of_birth": "15/05/1999",
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
        }
    return {
        "fields": [],
        "count": 0,
        "message": "No form analyzed yet. Ask user to click Analyze first."
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
    # Send fill command to the browser through the WebSocket callback
    if _ws_send_callback:
        try:
            fill_command = {
                "type": "TOOL_FILL_FIELD",
                "label": field_label,
                "value": value,
            }
            payload = json.dumps(fill_command)
            
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
            
            logger.info(f"[Tool] Fill command sent: {field_label} = {value[:30]}")
            return {
                "status": "sent",
                "message": f"Filling '{field_label}' with '{value[:30]}'"
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
    global _current_form_fields, _current_screenshot
    _current_form_fields = fields
    _current_screenshot = screenshot


def set_ws_callback(callback):
    """Set the WebSocket send callback. Called by main.py when live WS connects."""
    global _ws_send_callback
    _ws_send_callback = callback
    logger.info("[Tools] WebSocket callback registered")


def clear_ws_callback():
    """Clear the callback when WS disconnects."""
    global _ws_send_callback
    _ws_send_callback = None

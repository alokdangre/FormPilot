import json

# Pre-populated mock profile for Phase 3 testing
MOCK_PROFILE = {
    "full name": "Alok Dangre",
    "name": "Alok Dangre",
    "email": "alokdangre@gmail.com",
    "email address": "alokdangre@gmail.com",
    "phone": "+91 9876543210",
    "address": "123 ABC Colony",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "resident of": "India",
    "date of birth": "15/05/1999",
    "project id": "formpilot-hackathon-1234",
    "user id": "alokd-devpost-77",
    "initial idea": "I am building FormPilot, an autonomous browser agent that uses Gemini Vision and Computer Use along with Google ADK to dynamically fill complex forms via voice commands without relying on fragile DOM selectors. I plan to build this under the UI Navigator category."
}

def resolve_field_data(merged_fields: list) -> list:
    """
    Receives fields reconciled by FormAnalyzer and assigns
    the absolute correct value from the user's profile.
    """
    resolved = []
    
    for f in merged_fields:
        label_lower = str(f["label"]).lower()
        matched_value = None
        
        # Simple intelligent string matching
        for key, value in MOCK_PROFILE.items():
            if key in label_lower or key.replace(" ", "") in label_lower.replace(" ", ""):
                matched_value = value
                # Stop on first strongest match
                if len(key) > 4: 
                    break
        
        # Category specific logic for known Hackathon edgecases
        if not matched_value:
             if "category" in label_lower or "2-3 sentences" in label_lower:
                  matched_value = MOCK_PROFILE["initial idea"]
        
        if matched_value:
            f["resolved_value"] = matched_value
            f["status"] = "matched" # Found securely in profile
            f["needs_user_input"] = False
        else:
            f["resolved_value"] = ""
            f["status"] = "pending" # Needs ADK voice interaction (Phase 5)
            f["needs_user_input"] = True
            
        resolved.append(f)
        
    return resolved

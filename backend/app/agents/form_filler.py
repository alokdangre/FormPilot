def build_fill_commands(resolved_fields: list) -> list:
    """
    Takes the resolved fields from DataResolver and creates specific 
    fill commands for the Chrome Extension to execute.
    """
    commands = []
    
    for i, field in enumerate(resolved_fields):
        if (
            field.get("status") == "matched"
            and field.get("resolved_value")
            and field.get("value_source") != "existing_form"
        ):
            commands.append({
                "type": "FILL_FIELD",
                "selector": field.get("selector"),   # CSS selector (may be None in vision-only)
                "value": field.get("resolved_value"),
                "label": field.get("label"),
                "name": field.get("name", ""),        # HTML name attribute
                "fieldType": field.get("type", "text"),  # text/email/radio/select/textarea
                "fieldIndex": field.get("index", i),  # Original DOM order index
            })
            
    return commands

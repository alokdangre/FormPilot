def build_fill_commands(resolved_fields: list) -> list:
    """
    Takes the resolved fields from DataResolver and creates specific 
    fill commands for the Chrome Extension to execute.
    """
    commands = []
    
    for field in resolved_fields:
        if field.get("status") == "matched" and field.get("resolved_value"):
            commands.append({
                "type": "FILL_FIELD",
                "selector": field.get("selector"),
                "value": field.get("resolved_value"),
                "label": field.get("label")
            })
            
    return commands

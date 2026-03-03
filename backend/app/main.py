import os
import json
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.agents.form_analyzer import process_form_analysis
from app.agents.data_resolver import resolve_field_data

app = FastAPI(title="FormPilot Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print("Client connected via WebSocket")
    try:
        while True:
            data = await ws.receive_text()
            message = json.loads(data)

            if message["type"] == "analyze_form":
                print("\n[Orchestrator] Received analyze_form request.")
                screenshot = message.get("screenshot", "")
                dom_fields = message.get("dom_fields", [])
                
                print(f"[Orchestrator] Routing to FormAnalyzer (Payload: {len(dom_fields)} DOM elements)")
                
                # Step 1: Analyze & Reconcile (Vision + DOM)
                merged = process_form_analysis(screenshot, dom_fields)
                
                print(f"[Orchestrator] Routing to DataResolver")
                # Step 2: Map Profile Data
                from app.agents.data_resolver import resolve_field_data
                resolved = resolve_field_data(merged)
                
                print(f"[Orchestrator] Routing to FormFiller")
                # Step 3: Generate Fill Commands
                from app.agents.form_filler import build_fill_commands
                fill_commands = build_fill_commands(resolved)
                
                # Step 4: Broadcast results back via WS
                await ws.send_text(json.dumps({
                    "type": "FORM_ANALYZED",
                    "status": "Ready",
                    "fields": resolved,
                    "fill_commands": fill_commands
                }))
                print(f"[Orchestrator] Sent resolved layout and {len(fill_commands)} fill commands back to extension.")
                
            elif message["type"] == "audio":
                print("[Voice-Engine] Received audio buffer from extension.")
                audio_b64 = message.get("data", "")
                if "," in audio_b64:
                    audio_b64 = audio_b64.split(",")[1]
                
                # In a full Bidi setup, this connects to Live API.
                # Here we process the audio clip with Gemini 2.5 Flash to extract intent text.
                try:
                    from google import genai
                    from google.genai import types
                    import base64
                    
                    audio_bytes = base64.b64decode(audio_b64)
                    client = genai.Client()
                    response = client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=[
                            "You are FormPilot, a voice AI. The user just spoke to you. Briefly respond as FormPilot, acknowledging their command or answering their missing field query in one short sentence.",
                            types.Part.from_bytes(data=audio_bytes, mime_type='audio/webm')
                        ]
                    )
                    reply_text = response.text.replace("\n", " ").strip()
                    print(f"[Voice-Engine] AI says: {reply_text}")
                    
                    await ws.send_text(json.dumps({
                        "type": "VOICE_REPLY",
                        "status": "Ready", 
                        "message": reply_text
                    }))
                except Exception as e:
                    print(f"Audio processing error: {e}")
                    await ws.send_text(json.dumps({
                        "type": "BACKEND_UPDATE",
                        "status": "Error",
                        "message": f"Voice error."
                    }))

            elif message["type"] == "verify_form":
                print("[Verification] Starting visual verification loop...")
                screenshot = message.get("screenshot", "")
                expected_fields = message.get("fields", [])
                
                from app.tools.verification_tools import verify_filled_form
                result = await verify_filled_form(screenshot, expected_fields)
                
                await ws.send_text(json.dumps({
                    "type": "VERIFICATION_RESULT",
                    "status": "Verified" if result.get("verified") else "Check Issues",
                    "result": result
                }))
                print(f"[Verification] Done. Verified: {result.get('verified')}")

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket Error: {e}")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "formpilot"}

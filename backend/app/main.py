"""
FormPilot Backend — ADK Bidi-Streaming Architecture.

Based on: https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo

Architecture:
    Extension → WebSocket → upstream_task → LiveRequestQueue → Runner.run_live()
    Runner.run_live() → downstream_task → WebSocket → Extension
"""

import os
import json
import base64
import asyncio
import logging
import warnings
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from google.adk.runners import Runner
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agents.formpilot_agent import agent
from app.agents.form_analyzer import process_form_analysis_async
from app.agents.data_resolver import resolve_field_data, resolve_field_data_async
from app.agents.form_filler import build_fill_commands
from app.tools.form_tools import set_form_context, set_ws_callback, clear_ws_callback

# ═══════════════════════════════════════════════════
# Logging
# ═══════════════════════════════════════════════════

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("FormPilot")
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

# ═══════════════════════════════════════════════════
# Phase 1: Application Initialization
# ═══════════════════════════════════════════════════

APP_NAME = "formpilot"
app = FastAPI(title="FormPilot Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ADK session service and runner
session_service = InMemorySessionService()
runner = Runner(
    app_name=APP_NAME,
    agent=agent,
    session_service=session_service,
)

# ═══════════════════════════════════════════════════
# WebSocket: ADK Bidi-Streaming Endpoint (Voice)
# ═══════════════════════════════════════════════════

@app.websocket("/ws/live/{user_id}/{session_id}")
async def live_endpoint(websocket: WebSocket, user_id: str, session_id: str):
    """
    Real-time bidi-streaming endpoint.
    Audio chunks stream in continuously, events stream out continuously.
    Based on the official ADK bidi-demo pattern.
    """
    await websocket.accept()
    logger.info(f"[Live] Connected: user={user_id}, session={session_id}")

    # ── Phase 2: Session Initialization ──
    # Native audio models REQUIRE AUDIO response modality
    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        session_resumption=types.SessionResumptionConfig(),
    )

    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

    live_request_queue = LiveRequestQueue()

    # Register WebSocket callback so tools can send messages to browser
    set_ws_callback(websocket.send_text)

    # ── Phase 3: Active Session ──

    async def upstream_task():
        """Receives messages from WebSocket → LiveRequestQueue."""
        logger.debug("[Live] upstream_task started")
        try:
            while True:
                message = await websocket.receive()

                # Binary frames = audio data (PCM Int16 at 16kHz)
                if "bytes" in message:
                    audio_data = message["bytes"]
                    logger.debug(f"[Live] Audio chunk: {len(audio_data)} bytes")
                    audio_blob = types.Blob(
                        mime_type="audio/pcm;rate=16000", data=audio_data
                    )
                    live_request_queue.send_realtime(audio_blob)

                # Text frames = JSON messages (text input, images, commands)
                elif "text" in message:
                    text_data = message["text"]
                    logger.debug(f"[Live] Text: {text_data[:100]}...")

                    try:
                        json_msg = json.loads(text_data)

                        if json_msg.get("type") == "text":
                            content = types.Content(
                                parts=[types.Part(text=json_msg["text"])]
                            )
                            live_request_queue.send_content(content)

                        elif json_msg.get("type") == "image":
                            image_data = base64.b64decode(json_msg["data"])
                            mime_type = json_msg.get("mimeType", "image/png")
                            image_blob = types.Blob(mime_type=mime_type, data=image_data)
                            live_request_queue.send_realtime(image_blob)

                        elif json_msg.get("type") == "form_context":
                            # Extension sends analyzed form fields for agent context
                            set_form_context(
                                json_msg.get("fields", []),
                                json_msg.get("screenshot")
                            )
                            logger.info(f"[Live] Form context updated: {len(json_msg.get('fields', []))} fields")

                    except json.JSONDecodeError:
                        # Plain text, send directly
                        content = types.Content(
                            parts=[types.Part(text=text_data)]
                        )
                        live_request_queue.send_content(content)

        except WebSocketDisconnect:
            logger.info("[Live] Client disconnected (upstream)")

    async def downstream_task():
        """Receives Events from run_live() → WebSocket."""
        logger.debug("[Live] downstream_task started")
        async for event in runner.run_live(
            user_id=user_id,
            session_id=session_id,
            live_request_queue=live_request_queue,
            run_config=run_config,
        ):
            event_json = event.model_dump_json(exclude_none=True, by_alias=True)
            logger.debug(f"[Live] Event: {event_json[:200]}...")
            await websocket.send_text(event_json)

        logger.debug("[Live] run_live() completed")

    # Run upstream and downstream concurrently
    try:
        await asyncio.gather(upstream_task(), downstream_task())
    except WebSocketDisconnect:
        logger.info("[Live] Client disconnected")
    except Exception as e:
        logger.error(f"[Live] Error: {e}", exc_info=True)
    finally:
        # ── Phase 4: Session Termination ──
        clear_ws_callback()
        live_request_queue.close()
        logger.info("[Live] Session closed")


# ═══════════════════════════════════════════════════
# WebSocket: Form Analysis Endpoint (Existing flow)
# ═══════════════════════════════════════════════════

@app.websocket("/ws")
async def form_endpoint(ws: WebSocket):
    """
    Form analysis WebSocket — handles screenshot + DOM analysis,
    data resolution, and fill command generation.
    This works alongside the /ws/live endpoint.
    """
    await ws.accept()
    logger.info("[Form] Client connected")

    async def send_update(status: str, message: str):
        try:
            await ws.send_text(json.dumps({
                "type": "BACKEND_UPDATE",
                "status": status,
                "message": message
            }))
        except Exception:
            pass

    try:
        while True:
            data = await ws.receive_text()
            message = json.loads(data)

            if message["type"] == "analyze_form":
                logger.info("[Form] Analyze request received")
                screenshot = message.get("screenshot", "")
                dom_fields = message.get("dom_fields", [])

                await send_update("Analyzing...", f"Received {len(dom_fields)} DOM fields...")

                # Step 1: Analyze
                merged = await process_form_analysis_async(
                    screenshot, dom_fields, send_update=send_update
                )
                logger.info(f"[Form] Analysis: {len(merged)} fields")

                # Step 2: Resolve (AI-powered matching)
                await send_update("Matching profile...", f"AI matching {len(merged)} fields to profile...")
                resolved = await resolve_field_data_async(merged)
                matched = sum(1 for f in resolved if f.get("status") == "matched")

                # Step 3: Build fill commands
                await send_update("Preparing fill...", f"Matched {matched} fields...")
                fill_commands = build_fill_commands(resolved)

                # Update agent context for voice interactions
                set_form_context(resolved, screenshot)

                # Step 4: Send back
                await ws.send_text(json.dumps({
                    "type": "FORM_ANALYZED",
                    "status": "Ready",
                    "fields": resolved,
                    "fill_commands": fill_commands
                }))
                logger.info(f"[Form] Sent {len(fill_commands)} fill commands")

            elif message["type"] == "verify_form":
                logger.info("[Verify] Starting verification")
                screenshot = message.get("screenshot", "")
                expected_fields = message.get("fields", [])

                await send_update("Verifying...", "Checking filled form...")

                try:
                    from app.tools.verification_tools import verify_filled_form
                    result = await verify_filled_form(screenshot, expected_fields)
                    await ws.send_text(json.dumps({
                        "type": "VERIFICATION_RESULT",
                        "status": "Verified" if result.get("verified") else "Issues Found",
                        "result": result
                    }))
                except Exception as e:
                    logger.error(f"[Verify] Error: {e}")
                    await ws.send_text(json.dumps({
                        "type": "VERIFICATION_RESULT",
                        "status": "Error",
                        "result": {"verified": False, "issues": [{"error": str(e)}]}
                    }))

    except WebSocketDisconnect:
        logger.info("[Form] Client disconnected")
    except Exception as e:
        logger.error(f"[Form] Error: {e}", exc_info=True)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "formpilot", "adk": True}

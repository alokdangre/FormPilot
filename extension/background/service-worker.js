// service-worker.js — FormPilot Background Service Worker
// Manages TWO WebSocket connections:
//   1. /ws         — Form analysis (screenshot + DOM → fill commands)
//   2. /ws/live/   — ADK bidi-streaming (real-time voice)

const BACKEND_URL = "ws://localhost:8000";

let formWs = null;     // Form analysis WebSocket
let liveWs = null;     // ADK bidi-streaming WebSocket
let isLiveActive = false;

// ═══════════════════════════════════════════════════
// Form Analysis WebSocket (/ws)
// ═══════════════════════════════════════════════════

function connectFormWS() {
    try {
        formWs = new WebSocket(`${BACKEND_URL}/ws`);
        formWs.onopen = () => {
            console.log("[SW] Form WS connected");
            broadcast({ type: "WS_STATUS", connected: true });
        };
        formWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                broadcast(data);
            } catch (err) {
                console.error("[SW] Form WS parse error:", err);
            }
        };
        formWs.onerror = (err) => console.error("[SW] Form WS error:", err);
        formWs.onclose = () => {
            console.log("[SW] Form WS disconnected, reconnecting...");
            broadcast({ type: "WS_STATUS", connected: false });
            setTimeout(connectFormWS, 3000);
        };
    } catch (err) {
        console.error("[SW] Form WS failed:", err);
        setTimeout(connectFormWS, 5000);
    }
}

connectFormWS();

function sendToFormWS(message) {
    if (formWs && formWs.readyState === WebSocket.OPEN) {
        try {
            const payload = JSON.stringify(message);
            console.log(`[SW] Sending to form WS: type=${message.type}, size=${(payload.length / 1024).toFixed(1)}KB`);
            formWs.send(payload);
        } catch (err) {
            console.error("[SW] Form WS send error:", err);
        }
    } else {
        console.warn("[SW] Form WS not open, state:", formWs?.readyState, "type:", message.type);
    }
}

// ═══════════════════════════════════════════════════
// ADK Bidi-Streaming WebSocket (/ws/live)
// ═══════════════════════════════════════════════════

function connectLiveWS() {
    if (liveWs && liveWs.readyState === WebSocket.OPEN) return;

    const userId = "user_" + Date.now();
    const sessionId = "session_" + Date.now();

    try {
        liveWs = new WebSocket(`${BACKEND_URL}/ws/live/${userId}/${sessionId}`);
        liveWs.binaryType = "arraybuffer";

        liveWs.onopen = () => {
            console.log("[SW] Live WS connected");
            isLiveActive = true;
            broadcast({ type: "LIVE_STATUS", connected: true });
        };
        liveWs.onmessage = (event) => {
            try {
                const eventData = JSON.parse(event.data);

                // ── Tool fill command from backend (via fill_field_tool) ──
                if (eventData.type === "TOOL_FILL_FIELD") {
                    console.log("[SW] Tool fill command:", eventData.label, "=", eventData.value);
                    // Forward to content script on active tab
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                type: "FILL_FIELD",
                                label: eventData.label,
                                value: eventData.value,
                                selector: eventData.selector || null,
                                name: eventData.name || "",
                                fieldType: eventData.fieldType || "text",
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error("[SW] Fill failed:", chrome.runtime.lastError);
                                    sendToFormWS({
                                        type: "fill_result",
                                        label: eventData.label,
                                        value: eventData.value,
                                        success: false,
                                        error: chrome.runtime.lastError.message,
                                    });
                                    broadcast({
                                        type: "VOICE_FIELD_FILL_FAILED",
                                        label: eventData.label,
                                        value: eventData.value,
                                        error: chrome.runtime.lastError.message,
                                    });
                                } else if (!response?.success) {
                                    const error = response?.error || "Fill rejected by content script";
                                    sendToFormWS({
                                        type: "fill_result",
                                        label: eventData.label,
                                        value: eventData.value,
                                        success: false,
                                        actual_value: response?.actualValue || "",
                                        error,
                                    });
                                    broadcast({
                                        type: "VOICE_FIELD_FILL_FAILED",
                                        label: eventData.label,
                                        value: eventData.value,
                                        actualValue: response?.actualValue || "",
                                        error,
                                    });
                                } else {
                                    sendToFormWS({
                                        type: "fill_result",
                                        label: eventData.label,
                                        value: eventData.value,
                                        success: true,
                                        actual_value: response?.actualValue || eventData.value,
                                    });
                                    broadcast({
                                        type: "VOICE_FIELD_FILLED",
                                        label: eventData.label,
                                        value: response?.actualValue || eventData.value,
                                    });
                                }
                            });
                        } else {
                            sendToFormWS({
                                type: "fill_result",
                                label: eventData.label,
                                value: eventData.value,
                                success: false,
                                error: "No active tab found",
                            });
                            broadcast({
                                type: "VOICE_FIELD_FILL_FAILED",
                                label: eventData.label,
                                value: eventData.value,
                                error: "No active tab found",
                            });
                        }
                    });
                    return;
                }

                // ── Normal ADK events ──
                handleADKEvent(eventData);
            } catch (err) {
                console.error("[SW] Live WS parse error:", err);
            }
        };
        liveWs.onerror = (err) => {
            console.error("[SW] Live WS error:", err);
            isLiveActive = false;
        };
        liveWs.onclose = () => {
            console.log("[SW] Live WS closed");
            isLiveActive = false;
            broadcast({ type: "LIVE_STATUS", connected: false });
        };
    } catch (err) {
        console.error("[SW] Live WS failed:", err);
    }
}

function handleADKEvent(event) {
    // Based on official ADK bidi-demo event handling (app.js)
    // Native audio models emit: inputTranscription, outputTranscription, 
    // content (with inlineData for audio), turnComplete, interrupted, actions

    // ── User's speech transcription (what the user said) ──
    if (event.inputTranscription && event.inputTranscription.text) {
        broadcast({
            type: "INPUT_TRANSCRIPTION",
            text: event.inputTranscription.text,
            finished: event.inputTranscription.finished || false,
        });
    }

    // ── AI's speech transcription (what the AI is saying — TEXT of audio) ──
    if (event.outputTranscription && event.outputTranscription.text) {
        broadcast({
            type: "VOICE_REPLY",
            status: "Ready",
            message: event.outputTranscription.text,
            streaming: !event.outputTranscription.finished,
            finished: event.outputTranscription.finished || false,
        });
    }

    // ── Turn complete (AI finished speaking) ──
    if (event.turnComplete === true) {
        broadcast({ type: "TURN_COMPLETE" });
    }

    // ── Interrupted (user spoke while AI was talking) ──
    if (event.interrupted === true) {
        broadcast({ type: "INTERRUPTED" });
    }

    // ── Content parts (text for half-cascade, audio for native-audio) ──
    if (event.content && event.content.parts) {
        for (const part of event.content.parts) {
            // Text (half-cascade models or thinking text)
            if (part.text && !part.thought) {
                broadcast({
                    type: "VOICE_REPLY",
                    status: "Ready",
                    message: part.text,
                    streaming: event.partial !== false,
                });
            }
            // Audio data (native-audio models send PCM audio)
            // We can't easily play this in service worker context,
            // so we forward it to the side panel
            if (part.inlineData && part.inlineData.data) {
                broadcast({
                    type: "AUDIO_PLAYBACK",
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                });
            }
        }
    }

    // ── Tool calls from agent ──
    if (event.actions && event.actions.tool_calls) {
        for (const call of event.actions.tool_calls) {
            handleToolCall(call);
        }
    }
}

function handleToolCall(toolCall) {
    console.log("[SW] Tool call:", toolCall.name, toolCall.args);
}

function sendToLiveWS(data) {
    if (liveWs && liveWs.readyState === WebSocket.OPEN) {
        if (data instanceof ArrayBuffer) {
            liveWs.send(data); // Binary audio data
        } else {
            liveWs.send(JSON.stringify(data)); // Text/JSON
        }
    } else {
        console.warn("[SW] Live WS not open");
    }
}

// ═══════════════════════════════════════════════════
// Offscreen Document for Microphone
// ═══════════════════════════════════════════════════

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
    const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
    try {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [offscreenUrl]
        });
        if (contexts.length > 0) return;
    } catch (e) { /* older Chrome */ }

    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }

    creatingOffscreen = chrome.offscreen.createDocument({
        url: 'offscreen/offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'FormPilot needs microphone for voice-controlled form filling',
    });
    await creatingOffscreen;
    creatingOffscreen = null;
    console.log("[SW] Offscreen document created");
}

// ═══════════════════════════════════════════════════
// Side Panel Setup
// ═══════════════════════════════════════════════════

try {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch(e => console.error("[SW] sidePanel error:", e));
} catch (e) {
    console.warn("[SW] sidePanel not available:", e);
}

// ═══════════════════════════════════════════════════
// Message Handler
// ═══════════════════════════════════════════════════

function broadcast(data) {
    chrome.runtime.sendMessage(data).catch(() => { });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        // ── Screenshot capture ──
        if (request.type === "CAPTURE_SCREENSHOT") {
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ dataUrl });
                }
            });
            return true;
        }

        // ── Start mic via offscreen + connect live WS ──
        if (request.type === "START_MIC") {
            // First ensure Live WS is connected
            connectLiveWS();

            // Then start mic capture
            ensureOffscreenDocument().then(() => {
                chrome.runtime.sendMessage({
                    target: 'offscreen',
                    type: 'START_MIC'
                }).then(resp => {
                    sendResponse(resp || { success: true });
                }).catch(err => {
                    sendResponse({ success: false, error: err.message });
                });
            }).catch(err => {
                sendResponse({ success: false, error: err.message });
            });
            return true;
        }

        // ── Stop mic ──
        if (request.type === "STOP_MIC") {
            chrome.runtime.sendMessage({
                target: 'offscreen',
                type: 'STOP_MIC'
            }).catch(() => { });
            sendResponse({ success: true });
            return false;
        }

        // ── Audio chunk from offscreen → forward to Live WS as binary ──
        if (request.type === "AUDIO_CHUNK") {
            if (liveWs && liveWs.readyState === WebSocket.OPEN) {
                // Decode base64 back to ArrayBuffer and send as binary
                const binaryString = atob(request.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                liveWs.send(bytes.buffer);
            }
            return false;
        }

        // ── Send text to Live WS ──
        if (request.type === "SEND_TEXT_TO_LIVE") {
            sendToLiveWS({ type: "text", text: request.text });
            sendResponse({ success: true });
            return false;
        }

        // ── Form analysis data → form WS ──
        if (request.type === "SEND_FORM_DATA") {
            sendToFormWS({
                type: "analyze_form",
                screenshot: request.screenshot,
                dom_fields: request.dom_fields || []
            });
            // Also update the live agent's context
            sendToLiveWS({
                type: "form_context",
                fields: request.dom_fields || [],
                screenshot: request.screenshot
            });
            sendResponse({ success: true });
            return false;
        }

        // ── Verification → form WS ──
        if (request.type === "SEND_VERIFY") {
            sendToFormWS({
                type: "verify_form",
                screenshot: request.screenshot,
                fields: request.fields || [],
                dom_fields: request.dom_fields || [],
            });
            sendResponse({ success: true });
            return false;
        }

    } catch (e) {
        console.error("[SW] Error:", e);
        sendResponse({ success: false, error: e.message });
    }
});

let ws = null;
const BACKEND_URL = "ws://localhost:8000/ws";

function connectWebSocket() {
    try {
        ws = new WebSocket(BACKEND_URL);
        ws.onopen = () => console.log("Connected to FormPilot backend");
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleBackendResponse(data);
            } catch (err) {
                console.error("Non-JSON backend response:", event.data);
            }
        };
        ws.onerror = (err) => console.error("WebSocket error:", err);
        ws.onclose = () => {
            console.log("Disconnected, reconnecting in 3s...");
            setTimeout(connectWebSocket, 3000);
        };
    } catch (err) {
        console.error("WebSocket connection failed:", err);
    }
}

// Connect immediately
connectWebSocket();

function sendToBackend(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.warn("WebSocket not open. Msg:", message);
    }
}

function handleBackendResponse(data) {
    console.log("Backend response received:", data);
    // Relay completely to sidepanel dynamically via chrome storage
    chrome.runtime.sendMessage(data).catch(() => { });
}

// Setup side panel to open on action click if possible
try {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));
} catch (e) {
    console.warn("sidePanel behavior issue:", e);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.type === "CAPTURE_SCREENSHOT") {
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    console.error("Capture failed:", chrome.runtime.lastError.message);
                    sendResponse({ error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ dataUrl: dataUrl });
                }
            });
            return true;
        }

        // Handle Phase 3 Combined Payload
        if (request.type === "SEND_FORM_DATA") {
            console.log("Relaying combined form image and DOM to backend.");
            sendToBackend({
                type: "analyze_form",
                screenshot: request.screenshot,
                dom_fields: request.dom_fields || []
            });
            sendResponse({ success: true });
            return false;
        }

        // Handle Phase 5 Verification Post-Fill
        if (request.type === "SEND_VERIFY") {
            console.log("Relaying filled form screenshot for verification.");
            sendToBackend({
                type: "verify_form",
                screenshot: request.screenshot,
                fields: request.fields || []
            });
            sendResponse({ success: true });
            return false;
        }

        // Relay raw audio buffer from sidepanel to backend
        if (request.type === "SEND_AUDIO") {
            console.log("Relaying audio to backend.");
            sendToBackend({ type: "audio", data: request.data });
            sendResponse({ success: true });
            return false;
        }
    } catch (e) {
        console.error("onMessage error:", e);
        sendResponse({ success: false, error: "Internal crash" });
    }
});

let isRecording = false;
let streamingText = ""; // Accumulates streaming text from ADK

document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const micBtn = document.getElementById('mic-btn');

    analyzeBtn.addEventListener('click', handleAnalyze);
    micBtn.addEventListener('click', toggleRecording);

    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener((msg, sender) => {
        if (msg.target === 'offscreen') return; // Not for us

        // ── Connection status ──
        if (msg.type === "WS_STATUS") {
            updateStatus(msg.connected ? "Connected" : "Reconnecting...", msg.connected);
        }
        if (msg.type === "LIVE_STATUS") {
            if (msg.connected) {
                addActivityLog("🟢 Live voice connection established");
            }
        }

        // ── Backend progress updates ──
        if (msg.type === "BACKEND_UPDATE") {
            updateStatus(msg.status || "Processing...", true);
            addActivityLog(msg.message || msg.status);
        }

        // ── Form analysis complete ──
        if (msg.type === "FORM_ANALYZED") {
            document.getElementById('analyze-btn').innerText = "⚡ Re-Analyze & Fill";
            document.getElementById('analyze-btn').disabled = false;
            updateStatus("Ready to Fill", true);
            updateResolvedFieldList(msg.fields);

            if (msg.fill_commands && msg.fill_commands.length > 0) {
                addActivityLog(`Starting to fill ${msg.fill_commands.length} fields...`);
                executeFillCommands(msg.fill_commands, msg.fields);
            } else {
                addActivityLog("No fields to auto-fill. Use voice to provide missing data.");
            }
        }

        // ── User's speech transcription (what they said) ──
        if (msg.type === "INPUT_TRANSCRIPTION") {
            if (msg.finished) {
                // Final transcription — show in activity log
                addActivityLog(`🎤 You: "${msg.text}"`);
            }
            updateUserTranscript(msg.text, msg.finished);
        }

        // ── AI voice reply (outputTranscription or text) ──
        if (msg.type === "VOICE_REPLY") {
            // REPLACE (not append) — each event contains accumulated text
            streamingText = msg.message;
            updateLiveTranscript(streamingText);

            // Only log final (finished) responses to avoid spam
            if (msg.finished) {
                addActivityLog(`🤖 AI: ${msg.message}`);
            }
            // NOTE: Native audio models handle their own audio output.
            // We do NOT use SpeechSynthesis — the AI speaks directly.
        }

        // ── Turn complete (AI finished responding) ──
        if (msg.type === "TURN_COMPLETE") {
            streamingText = "";
            // Don't clear the transcript immediately — let user read it
        }

        // ── Interrupted (user spoke while AI was talking) ──
        if (msg.type === "INTERRUPTED") {
            streamingText = "";
            addActivityLog("⏸️ Interrupted — listening to you...");
        }

        // ── Verification result ──
        if (msg.type === "VERIFICATION_RESULT") {
            if (msg.result?.verified) {
                updateStatus("✅ Verified", true);
                addActivityLog("✅ All fields verified correctly!");
            } else {
                updateStatus("⚠️ Issues Found", true);
                addActivityLog(`⚠️ ${msg.result?.issues?.length || 0} issue(s) found.`);
            }
        }
    });
});

// ═══════════════════════════════════════════════════
// Status & Activity Log
// ═══════════════════════════════════════════════════

function updateStatus(text, isConnected) {
    const el = document.getElementById('status-indicator');
    el.textContent = text;
    el.classList.toggle("connected", isConnected);
}

function addActivityLog(message) {
    const log = document.getElementById('activity-log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    entry.innerHTML = `<span class="log-time">${time}</span> ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function updateLiveTranscript(text) {
    const el = document.getElementById('live-transcript');
    if (el) {
        el.textContent = text;
        el.style.display = text ? 'block' : 'none';
    }
}

function updateUserTranscript(text, finished) {
    const el = document.getElementById('user-transcript');
    if (el) {
        el.textContent = finished ? `🎤 "${text}"` : `🎤 ${text}...`;
        el.style.display = text ? 'block' : 'none';
        if (finished) {
            setTimeout(() => { el.style.display = 'none'; }, 4000);
        }
    }
}

// ═══════════════════════════════════════════════════
// Form Analysis
// ═══════════════════════════════════════════════════

async function handleAnalyze() {
    const analyzeBtn = document.getElementById('analyze-btn');
    analyzeBtn.innerText = "Analyzing...";
    analyzeBtn.disabled = true;
    addActivityLog("📸 Capturing screenshot...");

    chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
        if (chrome.runtime.lastError || !response || response.error) {
            analyzeBtn.innerText = "⚡ Analyze & Fill This Form";
            analyzeBtn.disabled = false;
            addActivityLog("❌ Screenshot failed. Make sure you're on a webpage.");
            return;
        }

        addActivityLog("📋 Extracting DOM fields...");

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
                addActivityLog("❌ No active tab found.");
                analyzeBtn.innerText = "⚡ Analyze & Fill This Form";
                analyzeBtn.disabled = false;
                return;
            }

            // Try extracting DOM fields from the content script
            chrome.tabs.sendMessage(tabs[0].id, { type: "EXTRACT_FIELDS" }, (resp) => {
                if (chrome.runtime.lastError || !resp || !resp.fields) {
                    // Content script might not be injected — inject it now and retry
                    addActivityLog("⚠️ Content script not ready. Injecting...");

                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ["content/content.js"]
                    }, () => {
                        if (chrome.runtime.lastError) {
                            addActivityLog("⚠️ Cannot inject on this page. Using vision-only...");
                            chrome.runtime.sendMessage({
                                type: "SEND_FORM_DATA",
                                screenshot: response.dataUrl,
                                dom_fields: []
                            });
                            return;
                        }

                        // Retry after injection
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabs[0].id, { type: "EXTRACT_FIELDS" }, (retry) => {
                                const fields = retry?.fields || [];
                                addActivityLog(`Retry found ${fields.length} DOM fields. Sending to AI...`);
                                chrome.runtime.sendMessage({
                                    type: "SEND_FORM_DATA",
                                    screenshot: response.dataUrl,
                                    dom_fields: fields
                                });
                            });
                        }, 300);
                    });
                    return;
                }

                const fieldCount = resp?.fields?.length || 0;
                addActivityLog(`Found ${fieldCount} DOM fields. Sending to AI...`);

                chrome.runtime.sendMessage({
                    type: "SEND_FORM_DATA",
                    screenshot: response.dataUrl,
                    dom_fields: resp?.fields || []
                });
            });
        });
    });
}

// ═══════════════════════════════════════════════════
// Form Filling
// ═══════════════════════════════════════════════════

async function executeFillCommands(commands, originalFields) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) return;
        let filledCount = 0;

        for (const cmd of commands) {
            await new Promise(resolve => {
                chrome.tabs.sendMessage(tabs[0].id, cmd, (resp) => {
                    if (resp && resp.success) {
                        filledCount++;
                        updateFillProgress(filledCount, commands.length);
                        addActivityLog(`✅ Filled: ${cmd.label || 'field'}`);
                    } else {
                        addActivityLog(`⚠️ Failed: ${cmd.label || 'field'}`);
                    }
                    setTimeout(resolve, 400);
                });
            });
        }

        addActivityLog(`🎉 Done! Filled ${filledCount}/${commands.length} fields.`);

        // Auto-verify
        setTimeout(() => {
            addActivityLog("🔍 Verifying...");
            chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
                if (!chrome.runtime.lastError && response?.dataUrl) {
                    chrome.runtime.sendMessage({
                        type: "SEND_VERIFY",
                        screenshot: response.dataUrl,
                        fields: originalFields
                    });
                }
            });
        }, 1500);
    });
}

function updateFillProgress(filledCount, totalCount) {
    document.getElementById('progress-text').innerText = `Filling: ${filledCount}/${totalCount}`;
    const width = totalCount > 0 ? (filledCount / totalCount) * 100 : 0;
    document.getElementById('progress-bar').style.width = `${width}%`;
}

// ═══════════════════════════════════════════════════
// Field List
// ═══════════════════════════════════════════════════

function updateResolvedFieldList(fields) {
    const list = document.getElementById('field-list');
    list.innerHTML = '';

    let matchedCount = fields.filter(f => f.status === 'matched').length;
    document.getElementById('progress-text').innerText = `${matchedCount}/${fields.length} matched`;
    const width = fields.length > 0 ? (matchedCount / fields.length) * 100 : 0;
    document.getElementById('progress-bar').style.width = `${width}%`;

    fields.forEach(field => {
        const li = document.createElement('li');
        let cls = field.status === 'matched' ? 'filled' : field.status === 'pending' ? 'pending' : 'empty';
        let icon = field.status === 'matched' ? '✅' : '⏳';

        li.className = `field-item ${cls}`;
        li.innerHTML = `
            <div class="field-info">
                <span class="field-label">${icon} ${field.label || 'Unnamed'}</span>
                <span class="field-value">${field.resolved_value || 'Needs input'}</span>
            </div>
        `;
        list.appendChild(li);
    });
}

// ═══════════════════════════════════════════════════
// Microphone (via Offscreen → Live WS)
// ═══════════════════════════════════════════════════

async function toggleRecording() {
    const micBtn = document.getElementById('mic-btn');

    if (!isRecording) {
        addActivityLog("🎤 Starting voice connection...");
        chrome.runtime.sendMessage({ type: "START_MIC" }, (resp) => {
            if (chrome.runtime.lastError || !resp?.success) {
                addActivityLog("❌ Mic failed. Check extension permissions.");
                return;
            }
            isRecording = true;
            streamingText = "";
            micBtn.textContent = '⏹ Stop Listening';
            micBtn.classList.add('recording');
            addActivityLog("🎤 Listening... speak naturally!");
        });
    } else {
        chrome.runtime.sendMessage({ type: "STOP_MIC" });
        isRecording = false;
        micBtn.textContent = '🎤 Start Listening';
        micBtn.classList.remove('recording');
        addActivityLog("🎤 Stopped listening");
    }
}

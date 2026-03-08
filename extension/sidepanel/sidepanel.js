let isRecording = false;
let streamingText = ""; // Accumulates streaming text from ADK
let liveConnected = false;
let currentAnalyzedFields = [];
let lastVoiceKickoffKey = "";
let lastAutoVerifyKey = "";
let playbackContext = null;
let playbackCursorTime = 0;
let pendingVoiceStart = false;
let lastReviewPromptKey = "";
let lastFillFailurePromptKey = "";
let pendingLiveInstruction = "";

document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');

    analyzeBtn.addEventListener('click', handleAnalyze);

    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener((msg, sender) => {
        if (msg.target === 'offscreen') return; // Not for us

        // ── Connection status ──
        if (msg.type === "WS_STATUS") {
            updateStatus(msg.connected ? "Connected" : "Reconnecting...", msg.connected);
        }
        if (msg.type === "LIVE_STATUS") {
            liveConnected = !!msg.connected;
            if (msg.connected) {
                pendingVoiceStart = false;
                addActivityLog("🟢 Live voice connection established");
                flushPendingLiveInstruction();
                maybeKickoffVoiceFormFlow();
            } else if (pendingVoiceStart) {
                addActivityLog("⚠️ Live voice connection dropped.");
            }
        }

        // ── Backend progress updates ──
        if (msg.type === "BACKEND_UPDATE") {
            updateStatus(msg.status || "Processing...", true);
            addActivityLog(msg.message || msg.status);
        }

        // ── Form analysis complete ──
        if (msg.type === "FORM_ANALYZED") {
            currentAnalyzedFields = msg.fields || [];
            lastVoiceKickoffKey = "";
            lastAutoVerifyKey = "";
            lastReviewPromptKey = "";
            lastFillFailurePromptKey = "";
            resetHeardLog();
            document.getElementById('analyze-btn').innerText = "⚡ Re-Analyze & Fill";
            document.getElementById('analyze-btn').disabled = false;
            updateStatus("Ready to Fill", true);
            updateResolvedFieldList(currentAnalyzedFields);

            if (msg.fill_commands && msg.fill_commands.length > 0) {
                addActivityLog(`Starting to fill ${msg.fill_commands.length} fields...`);
                executeFillCommands(msg.fill_commands, currentAnalyzedFields);
            } else if (hasPendingFields()) {
                addActivityLog("No fields to auto-fill. Starting voice completion...");
                maybeStartAutonomousVoiceSession();
            } else {
                addActivityLog("✅ Nothing is pending.");
            }
        }

        // ── User's speech transcription (what they said) ──
        if (msg.type === "INPUT_TRANSCRIPTION") {
            if (msg.finished) {
                // Final transcription — show in activity log
                addActivityLog(`🎤 You: "${msg.text}"`);
                addHeardLog(msg.text);
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

        if (msg.type === "AUDIO_PLAYBACK") {
            playAudioChunk(msg.data, msg.mimeType);
        }

        if (msg.type === "VOICE_FIELD_FILLED") {
            applyVoiceFillToFieldList(msg.label, msg.value);
            addActivityLog(`✅ Voice filled: ${msg.label}`);
        }

        if (msg.type === "VOICE_FIELD_FILL_FAILED") {
            const suffix = msg.error ? ` — ${msg.error}` : "";
            addActivityLog(`⚠️ Voice fill failed: ${msg.label || 'field'}${suffix}`);
            reopenFieldForRetry(msg.label, msg.actualValue || "");
            maybePromptImmediateFillRetry(msg);
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
                const warnings = msg.result?.warnings || [];
                warnings.forEach((issue) => {
                    const field = issue?.field || issue?.label || "Unknown field";
                    addActivityLog(`ℹ️ Could not visually confirm ${field} because it was not visible in the screenshot.`);
                });
                maybePromptPostVerificationReview();
            } else {
                updateStatus("⚠️ Issues Found", true);
                const issues = msg.result?.issues || [];
                const warnings = msg.result?.warnings || [];
                addActivityLog(`⚠️ ${issues.length} issue(s) found.`);
                warnings.forEach((issue) => {
                    const field = issue?.field || issue?.label || "Unknown field";
                    addActivityLog(`ℹ️ Could not visually confirm ${field} because it was not visible in the screenshot.`);
                });
                applyVerificationIssuesToFieldList(issues);
                issues.forEach((issue) => {
                    const field = issue?.field || issue?.label || "Unknown field";
                    const expected = issue?.expected || issue?.value_we_injected || "";
                    const actual = issue?.actual || "";
                    const error = issue?.error || "";

                    if (error) {
                        addActivityLog(`⚠️ Verify error: ${error}`);
                        return;
                    }

                    const parts = [`⚠️ ${field}`];
                    if (expected) parts.push(`expected "${expected}"`);
                    if (actual) parts.push(`saw "${actual}"`);
                    addActivityLog(parts.join(" — "));
                });
                maybePromptCorrectionReview(issues);
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

function addHeardLog(message) {
    const log = document.getElementById('heard-log');
    if (!log || !message) return;

    const muted = log.querySelector('.heard-entry.muted');
    if (muted) muted.remove();

    const entry = document.createElement('div');
    entry.className = 'heard-entry';
    const time = new Date().toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    entry.textContent = `${time} ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function resetHeardLog() {
    const log = document.getElementById('heard-log');
    if (!log) return;
    log.innerHTML = '<div class="heard-entry muted">Your speech-to-text transcript will appear here.</div>';
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

function ensurePlaybackContext() {
    if (!playbackContext) {
        playbackContext = new AudioContext();
    }
    if (playbackContext.state === 'suspended') {
        playbackContext.resume().catch(() => { });
    }
    if (playbackCursorTime < playbackContext.currentTime) {
        playbackCursorTime = playbackContext.currentTime;
    }
    return playbackContext;
}

function playAudioChunk(base64Data, mimeType) {
    if (!base64Data) return;

    const ctx = ensurePlaybackContext();
    const pcmBuffer = base64ToArrayBuffer(base64Data);
    const sampleRate = parseSampleRate(mimeType);
    const audioBuffer = pcm16ToAudioBuffer(ctx, pcmBuffer, sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startAt = Math.max(playbackCursorTime, ctx.currentTime);
    source.start(startAt);
    playbackCursorTime = startAt + audioBuffer.duration;
}

function parseSampleRate(mimeType) {
    const match = /rate=(\d+)/i.exec(mimeType || '');
    return match ? Number(match[1]) : 24000;
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function pcm16ToAudioBuffer(ctx, buffer, sampleRate) {
    const pcm = new Int16Array(buffer);
    const audioBuffer = ctx.createBuffer(1, pcm.length, sampleRate);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) {
        channel[i] = pcm[i] / 0x8000;
    }
    return audioBuffer;
}

// ═══════════════════════════════════════════════════
// Form Analysis
// ═══════════════════════════════════════════════════

async function handleAnalyze() {
    const analyzeBtn = document.getElementById('analyze-btn');
    ensurePlaybackContext();
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
                        applyFilledCommandToFieldList(cmd);
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
        if (hasPendingFields()) {
            addActivityLog("🎤 Switching to voice for the remaining fields...");
            maybeStartAutonomousVoiceSession();
            return;
        }

        triggerVerification(originalFields, "🔍 Verifying...");
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

function findFieldInListByLabel(label) {
    if (!label) return null;

    const desired = String(label || '').toLowerCase().trim();
    return currentAnalyzedFields.find((field) => {
        const fieldLabel = (field.label || '').toLowerCase().trim();
        return fieldLabel === desired || fieldLabel.includes(desired) || desired.includes(fieldLabel);
    }) || null;
}

function applyVoiceFillToFieldList(label, value) {
    if (!currentAnalyzedFields.length || !label) return;

    const target = findFieldInListByLabel(label);
    if (!target) return;

    target.resolved_value = value;
    target.current_value = value;
    target.status = 'matched';
    target.needs_user_input = false;
    delete target.verification_issue;
    delete target.last_attempted_value;
    updateResolvedFieldList(currentAnalyzedFields);

    maybeVerifyVoiceCompletion();
}

function reopenFieldForRetry(label, actualValue) {
    if (!currentAnalyzedFields.length || !label) return;

    const target = findFieldInListByLabel(label);
    if (!target) return;

    lastAutoVerifyKey = "";
    target.status = 'pending';
    target.needs_user_input = true;
    target.last_attempted_value = target.resolved_value || '';
    target.resolved_value = '';
    if (actualValue) {
        target.current_value = actualValue;
    }
    updateResolvedFieldList(currentAnalyzedFields);
}

function applyVerificationIssuesToFieldList(issues) {
    if (!currentAnalyzedFields.length || !issues?.length) return;
    lastAutoVerifyKey = "";

    issues.forEach((issue) => {
        const target = currentAnalyzedFields.find((field) => {
            const fieldLabel = (field.label || '').toLowerCase().trim();
            const issueLabel = String(issue?.field || issue?.label || '').toLowerCase().trim();
            return issueLabel && (fieldLabel === issueLabel || fieldLabel.includes(issueLabel) || issueLabel.includes(fieldLabel));
        });

        if (!target) return;

        target.status = 'pending';
        target.needs_user_input = true;
        target.last_attempted_value = target.resolved_value || '';
        target.current_value = issue?.actual || target.current_value || '';
        target.resolved_value = '';
        target.verification_issue = issue;
    });

    updateResolvedFieldList(currentAnalyzedFields);
}

function applyFilledCommandToFieldList(cmd) {
    if (!cmd) return;

    const target = currentAnalyzedFields.find((field) => {
        if (cmd.selector && field.selector && field.selector === cmd.selector) return true;
        if (cmd.name && field.name && field.name === cmd.name) return true;

        const fieldLabel = String(field.label || '').toLowerCase().trim();
        const desired = String(cmd.label || '').toLowerCase().trim();
        return desired && (fieldLabel === desired || fieldLabel.includes(desired) || desired.includes(fieldLabel));
    });

    if (!target) return;

    target.resolved_value = cmd.value;
    target.current_value = cmd.value;
    target.status = 'matched';
    target.needs_user_input = false;
    delete target.verification_issue;
    delete target.last_attempted_value;
    updateResolvedFieldList(currentAnalyzedFields);
}

function hasPendingFields() {
    return currentAnalyzedFields.some((field) => field.status !== 'matched');
}

function maybeKickoffVoiceFormFlow() {
    if (!isRecording || !liveConnected) return;

    const pendingFields = currentAnalyzedFields.filter((field) => field.status !== 'matched');
    if (!pendingFields.length) return;

    const kickoffKey = pendingFields
        .map((field) => `${field.label}:${field.status}:${field.resolved_value || ''}`)
        .join('|');

    if (kickoffKey && kickoffKey === lastVoiceKickoffKey) return;
    lastVoiceKickoffKey = kickoffKey;

    chrome.runtime.sendMessage({
        type: "SEND_TEXT_TO_LIVE",
        text: "A form is already analyzed. Start voice-guided completion now. Ask exactly one pending field at a time, wait for my answer, fill it immediately, and continue until no pending fields remain."
    });
}

function maybeStartAutonomousVoiceSession() {
    if (!hasPendingFields()) return;
    if (isRecording) {
        maybeKickoffVoiceFormFlow();
        return;
    }

    startLiveConversationSession("🎤 Starting autonomous voice completion...", () => {
        maybeKickoffVoiceFormFlow();
    });
}

function maybeVerifyVoiceCompletion() {
    if (hasPendingFields()) return;

    const verifyKey = currentAnalyzedFields
        .map((field) => `${field.label}:${field.resolved_value || ''}`)
        .join('|');

    if (!verifyKey || verifyKey === lastAutoVerifyKey) return;
    lastAutoVerifyKey = verifyKey;

    triggerVerification(currentAnalyzedFields, "🔍 Verifying voice-filled form...");
}

function maybePromptCorrectionReview(issues) {
    if (!issues?.length) return;

    const promptKey = issues
        .map((issue) => `${issue.field || issue.label}:${issue.actual || ''}`)
        .join('|');
    if (!promptKey || promptKey === lastReviewPromptKey) return;
    lastReviewPromptKey = promptKey;

    const labels = issues.map((issue) => issue.field || issue.label).filter(Boolean).join(', ');
    const instruction = `Verification found issues with these fields: ${labels}. Start an interactive correction flow now. Ask about the first incorrect field, wait for my answer, update only one field for each answer, and continue until the issues are fixed.`;
    queueLiveInstruction(instruction);
    if (!isRecording) {
        startLiveConversationSession("🎤 Starting voice review for verification issues...");
    } else {
        flushPendingLiveInstruction();
    }
}

function maybePromptPostVerificationReview() {
    const promptKey = currentAnalyzedFields
        .map((field) => `${field.label}:${field.resolved_value || ''}`)
        .join('|');
    if (!promptKey || promptKey === lastReviewPromptKey) return;
    lastReviewPromptKey = promptKey;

    queueLiveInstruction("Verification looks good. In one short sentence, ask the user if everything looks good or if anything should be updated.");
    if (!isRecording) {
        startLiveConversationSession("🎤 Starting live review...");
    } else {
        flushPendingLiveInstruction();
    }
}

function triggerVerification(fields, logMessage) {
    if (logMessage) {
        addActivityLog(logMessage);
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            addActivityLog("⚠️ DOM verification skipped: no active tab found.");
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, { type: "EXTRACT_FIELDS" }, (resp) => {
            if (chrome.runtime.lastError || !resp?.fields) {
                addActivityLog("⚠️ DOM verification skipped: could not read current form state.");
                return;
            }

            chrome.runtime.sendMessage({
                type: "SEND_VERIFY",
                screenshot: "",
                fields: fields,
                dom_fields: resp.fields || [],
            });
        });
    });
}

function startLiveConversationSession(startLogMessage, onReady) {
    if (isRecording) {
        if (typeof onReady === 'function') onReady();
        return;
    }

    pendingVoiceStart = true;
    ensurePlaybackContext();
    updateStatus("Starting voice...", true);
    if (startLogMessage) {
        addActivityLog(startLogMessage);
    }

    chrome.runtime.sendMessage({ type: "START_MIC" }, (resp) => {
        if (chrome.runtime.lastError || !resp?.success) {
            pendingVoiceStart = false;
            updateStatus("Voice start failed", false);
            addActivityLog("❌ Voice start failed. Check extension microphone permission.");
            return;
        }

        isRecording = true;
        pendingVoiceStart = false;
        streamingText = "";
        updateStatus("Listening...", true);
        addActivityLog("🎤 Listening for your answer...");
        if (typeof onReady === 'function') onReady();
        flushPendingLiveInstruction();
    });
}

function queueLiveInstruction(text) {
    pendingLiveInstruction = text || "";
}

function flushPendingLiveInstruction() {
    if (!pendingLiveInstruction || !liveConnected) return;

    const text = pendingLiveInstruction;
    pendingLiveInstruction = "";
    chrome.runtime.sendMessage({
        type: "SEND_TEXT_TO_LIVE",
        text
    });
}

// ═══════════════════════════════════════════════════
// Microphone (via Offscreen → Live WS)
// ═══════════════════════════════════════════════════

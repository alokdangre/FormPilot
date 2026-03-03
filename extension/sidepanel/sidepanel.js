let mediaRecorder;
let audioChunks = [];
let isRecording = false;

document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const micBtn = document.getElementById('mic-btn');

    analyzeBtn.addEventListener('click', handleAnalyze);
    micBtn.addEventListener('click', toggleRecording);

    // Listen for updates pushed from the backend WebSocket
    chrome.runtime.onMessage.addListener((msg, sender) => {
        if (msg.type === "BACKEND_UPDATE") {
            const statusEl = document.getElementById('status-indicator');
            statusEl.textContent = msg.status || msg.data?.status || "Ready";
            statusEl.classList.add("connected");
            console.log("Backend said:", msg.message || msg.data?.message);
        } else if (msg.type === "FORM_ANALYZED") {
            document.getElementById('analyze-btn').innerText = "Re-Analyze & Fill";
            const statusEl = document.getElementById('status-indicator');
            statusEl.textContent = msg.status;
            statusEl.classList.add("connected");
            updateResolvedFieldList(msg.fields);

            // Start filling the form step-by-step
            if (msg.fill_commands && msg.fill_commands.length > 0) {
                executeFillCommands(msg.fill_commands, msg.fields);
            }
        } else if (msg.type === "VOICE_REPLY") {
            const statusEl = document.getElementById('status-indicator');
            statusEl.textContent = msg.status;
            statusEl.classList.add("connected");
            console.log("AI Audio Transcript:", msg.message);

            // Speak back to user!
            const audioMsg = new SpeechSynthesisUtterance(msg.message);
            window.speechSynthesis.speak(audioMsg);
        } else if (msg.type === "VERIFICATION_RESULT") {
            const statusEl = document.getElementById('status-indicator');
            statusEl.textContent = msg.status;
            statusEl.classList.add("connected");

            if (msg.result.verified) {
                const audioMsg = new SpeechSynthesisUtterance(`I have verified the form. All fields look perfect.`);
                window.speechSynthesis.speak(audioMsg);
                console.log("Verification Success:", msg.result);
            } else {
                const numIssues = msg.result.issues ? msg.result.issues.length : 'some';
                const audioMsg = new SpeechSynthesisUtterance(`I found ${numIssues} issues during verification. Please review manually.`);
                window.speechSynthesis.speak(audioMsg);
                console.warn("Verification Issues:", msg.result.issues);
            }
        }
    });
});

async function executeFillCommands(commands, original_fields) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) return;
        let filledCount = 0;

        for (const cmd of commands) {
            await new Promise(resolve => {
                chrome.tabs.sendMessage(tabs[0].id, cmd, (resp) => {
                    if (resp && resp.success) {
                        filledCount++;
                        updateFillProgress(filledCount, commands.length);
                    }
                    setTimeout(resolve, 600); // Wait between fills for visual effect
                });
            });
        }

        console.log("Finished executing", filledCount, "fill commands.");
        const audioMsg = new SpeechSynthesisUtterance(`I have filled ${filledCount} fields.`);
        window.speechSynthesis.speak(audioMsg);

        // Wait 1 second for react states to settle, then verify!
        setTimeout(() => {
            console.log("Taking post-fill verification screenshot...");
            chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
                if (!chrome.runtime.lastError && response.dataUrl) {
                    chrome.runtime.sendMessage({
                        type: "SEND_VERIFY",
                        screenshot: response.dataUrl,
                        fields: original_fields
                    });
                }
            });
        }, 1500);
    });
}

function updateFillProgress(filledCount, totalCount) {
    document.getElementById('progress-text').innerText = `Filling: ${filledCount}/${totalCount} completed`;
    const progressWidth = totalCount > 0 ? (filledCount / totalCount) * 100 : 0;
    document.getElementById('progress-bar').style.width = `${progressWidth}%`;
}

async function handleAnalyze() {
    console.log("Analyze clicked");
    document.getElementById('analyze-btn').innerText = "Vision Analysis Running...";

    // Request screenshot (which also triggers WebSocket relay in service-worker)
    chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Screenshot error:", chrome.runtime.lastError);
            document.getElementById('analyze-btn').innerText = "Error (See Console)";
            return;
        }

        // Then query the active tab to extract DOM fields
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: "EXTRACT_FIELDS" }, (resp) => {
                    if (chrome.runtime.lastError) {
                        console.warn("DOM check failed. Reload tab.", chrome.runtime.lastError);
                        return;
                    }
                    if (resp && resp.fields) {
                        // Forward combined data to backend
                        chrome.runtime.sendMessage({
                            type: "SEND_FORM_DATA",
                            screenshot: response.dataUrl,
                            dom_fields: resp.fields
                        });
                    }
                });
            }
        });
    });
}

function updateResolvedFieldList(fields) {
    const list = document.getElementById('field-list');
    list.innerHTML = '';

    let matchedCount = fields.filter(f => f.status === 'matched').length;
    document.getElementById('progress-text').innerText = `${matchedCount}/${fields.length} map directly to profile`;

    const maxBarWidth = 100;
    const progressWidth = fields.length > 0 ? (matchedCount / fields.length) * 100 : 0;
    document.getElementById('progress-bar').style.width = `${progressWidth}%`;

    fields.forEach(field => {
        const li = document.createElement('li');

        // Setup border status indicator
        let displayClass = 'empty';
        if (field.status === 'matched') displayClass = 'filled';
        else if (field.status === 'pending') displayClass = 'pending';

        li.className = `field-item ${displayClass}`;

        const infoDiv = document.createElement('div');
        infoDiv.style.display = "flex";
        infoDiv.style.flexDirection = "column";

        const nameSpan = document.createElement('span');
        nameSpan.textContent = field.label || 'Unnamed Field';
        nameSpan.style.fontWeight = "bold";
        nameSpan.style.marginBottom = "4px";

        const valueSpan = document.createElement('span');
        valueSpan.textContent = field.resolved_value ? `Matched: ${field.resolved_value}` : 'Needs context/voice setup';
        valueSpan.style.color = field.resolved_value ? '#a6e3a1' : '#fab387';
        valueSpan.style.fontSize = '0.75rem';

        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(valueSpan);
        li.appendChild(infoDiv);
        list.appendChild(li);
    });
}

async function requestPermissions() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return stream;
    } catch (err) {
        console.warn("Direct microphone request failed, opening in a full tab automatically.");
        chrome.tabs.create({ url: chrome.runtime.getURL("sidepanel/sidepanel.html") });
        throw err;
    }
}

async function toggleRecording() {
    const micBtn = document.getElementById('mic-btn');

    if (!isRecording) {
        try {
            const stream = await requestPermissions();
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64Audio = reader.result;
                    chrome.runtime.sendMessage({ type: "SEND_AUDIO", data: base64Audio });
                };
                stream.getTracks().forEach(track => track.stop());
            };

            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            micBtn.textContent = '⏹ Stop Recording';
            micBtn.classList.add('recording');
        } catch (err) {
            console.error("Mic initialization aborted:", err);
        }
    } else {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        isRecording = false;
        micBtn.textContent = '🎤 Start Recording';
        micBtn.classList.remove('recording');
    }
}

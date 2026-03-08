// offscreen.js — Real-time audio streaming via AudioContext
// Captures mic audio, converts to PCM Int16 at 16kHz, sends chunks continuously.
// This is the proper way per ADK bidi-streaming requirements.

let audioContext = null;
let mediaStream = null;
let workletNode = null;
let isStreaming = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.target !== 'offscreen') return;

    if (msg.type === 'START_MIC') {
        startStreaming()
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (msg.type === 'STOP_MIC') {
        stopStreaming();
        sendResponse({ success: true });
    }
});

async function startStreaming() {
    if (isStreaming) return;

    // Get mic audio in the extension's own context (one-time permission)
    mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
        }
    });

    // Create AudioContext at 16kHz (what Gemini Live API expects)
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);

    // Smaller chunks reduce speech-to-model latency.
    // Official Live API starters typically stream 1024-sample frames.
    const processor = audioContext.createScriptProcessor(1024, 1, 1);

    processor.onaudioprocess = (e) => {
        if (!isStreaming) return;

        const float32Data = e.inputBuffer.getChannelData(0);

        // Convert Float32 [-1,1] to Int16 [-32768,32767] — what Gemini expects
        const int16Data = new Int16Array(float32Data.length);
        for (let i = 0; i < float32Data.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Data[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send raw PCM bytes to service worker → WebSocket as binary
        chrome.runtime.sendMessage({
            type: 'AUDIO_CHUNK',
            // Convert Int16Array to base64 for message passing
            // Service worker will send as binary on the live WebSocket
            data: arrayBufferToBase64(int16Data.buffer),
        });
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    isStreaming = true;
    console.log('[Offscreen] Audio streaming started at 16kHz PCM');
}

function stopStreaming() {
    isStreaming = false;

    if (audioContext) {
        audioContext.close().catch(() => { });
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    console.log('[Offscreen] Audio streaming stopped');
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

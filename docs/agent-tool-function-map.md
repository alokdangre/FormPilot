# FormPilot Agent, Tool, and Function Map

This document maps the current codebase as implemented in this repository.

It covers:
- active runtime agents and tools
- supporting modules and placeholder modules
- function inventory by file
- message and WebSocket contracts
- full click-flow breakdowns for `Analyze` and `Recording`, including fallback and failure paths

## 1. Runtime Topology

```mermaid
flowchart LR
    SP[Side Panel UI]
    SW[Extension Service Worker]
    CS[Content Script]
    OS[Offscreen Document]
    FWS[Backend /ws]
    LWS[Backend /ws/live/{user_id}/{session_id}]
    FA[Form Analysis Pipeline]
    ADK[ADK Live Agent]
    GEM[Gemini APIs]

    SP -->|CAPTURE_SCREENSHOT / SEND_FORM_DATA / START_MIC| SW
    SW -->|EXTRACT_FIELDS / FILL_FIELD| CS
    SW -->|START_MIC / STOP_MIC| OS
    OS -->|AUDIO_CHUNK| SW
    SW <--> FWS
    SW <--> LWS
    FWS --> FA
    LWS --> ADK
    FA --> GEM
    ADK --> GEM
    ADK -->|TOOL_FILL_FIELD| SW
```

## 2. Agents

### 2.1 Active runtime agent

| Agent | File | Active | Purpose |
| --- | --- | --- | --- |
| `FormPilot` ADK agent | `backend/app/agents/formpilot_agent.py` | Yes | Live voice agent used by `Runner.run_live()` on `/ws/live/...`. It can call `analyze_form_tool`, `fill_field_tool`, and `get_user_profile_tool`. |

### 2.2 Backend analysis modules that act like specialist agents

These are not registered as ADK sub-agents in the running app, but they implement the analysis pipeline used by `/ws`.

| Module | File | Active | Purpose |
| --- | --- | --- | --- |
| Form analyzer | `backend/app/agents/form_analyzer.py` | Yes | Decides whether DOM labels are good enough, optionally calls Gemini Vision, then reconciles DOM and vision fields. |
| Data resolver | `backend/app/agents/data_resolver.py` | Yes | Matches analyzed fields to user profile data using fast heuristics, then Gemini for unmatched fields. |
| Form filler | `backend/app/agents/form_filler.py` | Yes | Converts resolved fields into extension fill commands. |

### 2.3 Architectural / unused agent code

| Module | File | Active | Notes |
| --- | --- | --- | --- |
| Orchestrator factory | `backend/app/agents/orchestrator.py` | No | Present for the original multi-agent design, but `backend/app/main.py` does not instantiate or use it. |

## 3. Tools

### 3.1 Active backend tools

| Tool / helper | File | Used by | Purpose |
| --- | --- | --- | --- |
| `analyze_form_tool()` | `backend/app/tools/form_tools.py` | Live ADK agent | Returns the current in-memory analyzed field summary. |
| `fill_field_tool(field_label, value)` | `backend/app/tools/form_tools.py` | Live ADK agent | Sends a `TOOL_FILL_FIELD` command back to the browser through the live WebSocket callback. |
| `get_user_profile_tool()` | `backend/app/tools/form_tools.py` | Live ADK agent | Returns the in-memory `USER_PROFILE`. |
| `set_form_context(fields, screenshot)` | `backend/app/tools/form_tools.py` | `/ws` and `/ws/live` handlers | Stores analyzed field state for later voice interactions. |
| `set_ws_callback(callback)` | `backend/app/tools/form_tools.py` | `/ws/live` handler | Registers the live WebSocket sender used by tool calls. |
| `clear_ws_callback()` | `backend/app/tools/form_tools.py` | `/ws/live` handler | Removes the callback when live WS closes. |
| `verify_filled_form()` | `backend/app/tools/verification_tools.py` | `/ws` verify path | Uses Gemini Vision to compare the screenshot against expected injected values. |

### 3.2 Placeholder / empty tool modules

These files currently contain no functions:
- `backend/app/tools/dom_tools.py`
- `backend/app/tools/filling_tools.py`
- `backend/app/tools/profile_tools.py`
- `backend/app/tools/screenshot_tools.py`

## 4. File-by-File Function Inventory

## 4.1 Backend entrypoints

### `backend/app/main.py`

| Function | Role |
| --- | --- |
| `live_endpoint(websocket, user_id, session_id)` | Live bidi-streaming WebSocket endpoint for voice. Creates ADK run config, session, request queue, and the WS callback used by tools. |
| `form_endpoint(ws)` | Form analysis WebSocket endpoint. Handles `analyze_form` and `verify_form`. |
| `health()` | Simple health check endpoint. |

Internal nested functions inside `live_endpoint`:
- `upstream_task()`: receives browser messages, audio bytes, text, image blobs, and `form_context`, then forwards them into `LiveRequestQueue`.
- `downstream_task()`: consumes `runner.run_live(...)` events and streams them back to the extension.

Internal nested function inside `form_endpoint`:
- `send_update(status, message)`: sends `BACKEND_UPDATE` progress messages to the extension.

## 4.2 Backend analysis pipeline

### `backend/app/agents/form_analyzer.py`

| Function | Role |
| --- | --- |
| `dom_fields_are_sufficient(dom_fields)` | Returns `True` when at least 70% of DOM fields have good labels. |
| `call_gemini_vision_async(screenshot_b64)` | Calls Gemini Vision asynchronously and returns inferred fields from the screenshot. |
| `reconcile_fields(dom_fields, vision_fields)` | Merges DOM-first data with vision labels. Also handles vision-only mode when DOM extraction is empty. |
| `process_form_analysis_async(screenshot_b64, dom_fields, send_update=None)` | Main async analysis pipeline. DOM-only fast path or DOM+Vision merge path. |
| `process_form_analysis(screenshot_b64, dom_fields)` | Legacy sync wrapper around the async function. |

### `backend/app/agents/data_resolver.py`

| Function | Role |
| --- | --- |
| `resolve_field_data(merged_fields)` | Runs fast matching first, then Gemini matching for remaining unresolved fields. |
| `_fast_match(label, field_type)` | Direct keyword/type-based mapping against `USER_PROFILE`. |
| `_ai_match(unmatched_fields)` | Single Gemini call that semantically matches unresolved fields to profile values. |
| `resolve_field_data_async(merged_fields)` | Async executor wrapper for `resolve_field_data`. |

### `backend/app/agents/form_filler.py`

| Function | Role |
| --- | --- |
| `build_fill_commands(resolved_fields)` | Converts matched fields into extension `FILL_FIELD` commands. |

### `backend/app/agents/formpilot_agent.py`

| Symbol | Role |
| --- | --- |
| `agent` | ADK `Agent` definition used by the live runner. |

### `backend/app/agents/orchestrator.py`

| Function | Role |
| --- | --- |
| `create_orchestrator(form_analyzer, data_resolver, form_filler)` | Creates a conceptual ADK orchestrator agent. Not used by the current runtime. |

## 4.3 Extension: side panel UI

### `extension/sidepanel/sidepanel.js`

| Function | Role |
| --- | --- |
| `updateStatus(text, isConnected)` | Updates the connection/progress pill. |
| `addActivityLog(message)` | Appends activity entries in the side panel. |
| `updateLiveTranscript(text)` | Shows the AI transcript currently streaming. |
| `updateUserTranscript(text, finished)` | Shows user speech transcription. |
| `handleAnalyze()` | Full Analyze button flow: capture screenshot, extract DOM fields, inject content script if needed, send data to backend. |
| `executeFillCommands(commands, originalFields)` | Sends sequential `FILL_FIELD` commands to the content script and triggers verification. |
| `updateFillProgress(filledCount, totalCount)` | Updates the progress bar while auto-filling. |
| `updateResolvedFieldList(fields)` | Renders resolved fields and matched/pending status. |
| `toggleRecording()` | Starts or stops microphone capture through the service worker and offscreen document. |

Event listeners:
- `DOMContentLoaded` wires the Analyze and microphone buttons.
- `chrome.runtime.onMessage` consumes all extension-wide status, progress, transcript, verification, and final analysis messages.

## 4.4 Extension: service worker

### `extension/background/service-worker.js`

| Function | Role |
| --- | --- |
| `connectFormWS()` | Maintains the `/ws` connection used for screenshot/DOM analysis and verification. Auto-reconnects on close. |
| `sendToFormWS(message)` | Sends JSON messages to `/ws` when available. |
| `connectLiveWS()` | Opens the `/ws/live/...` voice WebSocket and forwards ADK events back into the extension. |
| `handleADKEvent(event)` | Normalizes ADK events into extension messages such as `VOICE_REPLY`, `INPUT_TRANSCRIPTION`, `TURN_COMPLETE`, and `INTERRUPTED`. |
| `handleToolCall(toolCall)` | Handles ADK tool call metadata and forwards `fill_field_tool` to the page. |
| `sendToLiveWS(data)` | Sends binary audio or JSON to the live WebSocket. |
| `ensureOffscreenDocument()` | Creates or reuses the offscreen document used for microphone capture. |
| `broadcast(data)` | Broadcasts messages back to extension views such as the side panel. |

Top-level behavior:
- calls `connectFormWS()` immediately when the service worker loads
- sets side panel behavior through `chrome.sidePanel.setPanelBehavior(...)`
- registers `chrome.runtime.onMessage` for screenshot, mic, audio chunk, text, form data, and verification routing

## 4.5 Extension: content script

### `extension/content/content.js`

| Function | Role |
| --- | --- |
| `extractFormFields()` | Scans visible inputs/selects/textareas, builds field metadata, and groups radio buttons. |
| `findLabelForElement(el)` | Attempts multiple label discovery strategies. |
| `generateUniqueSelector(el)` | Builds a selector for later targeting. |
| `isElementVisible(el)` | Filters out hidden or visually absent elements. |
| `findFieldElement(selector, label, name, fieldType)` | Five-level locator strategy for finding the correct element to fill. |
| `markElementAsFilled(el)` | Tracks filled DOM elements to avoid duplicate fills. |
| `resetFilledTracking()` | Clears the fill tracker at the start of a new analysis. |
| `fillElement(el, value)` | Performs the actual DOM interaction for text, select, and radio fields. |

Message listener handles:
- `EXTRACT_FIELDS`
- `FILL_FIELD`
- `CLICK_ELEMENT`
- `SCROLL_PAGE`

## 4.6 Extension: offscreen audio capture

### `extension/offscreen/offscreen.js`

| Function | Role |
| --- | --- |
| `startStreaming()` | Requests microphone access, creates a 16kHz audio context, converts samples to PCM Int16, and emits chunks back to the service worker. |
| `stopStreaming()` | Stops mic tracks and closes the audio context. |
| `arrayBufferToBase64(buffer)` | Converts PCM bytes for Chrome runtime message transport. |

Message listener handles:
- `START_MIC`
- `STOP_MIC`

## 5. Message and Event Contracts

## 5.1 Side panel to service worker

| Message | Sent by | Purpose |
| --- | --- | --- |
| `CAPTURE_SCREENSHOT` | side panel | Capture visible tab as a PNG data URL. |
| `START_MIC` | side panel | Start voice mode. |
| `STOP_MIC` | side panel | Stop voice mode. |
| `SEND_FORM_DATA` | side panel | Send screenshot + extracted DOM fields to backend analysis. |
| `SEND_VERIFY` | side panel | Send screenshot + expected field values for verification. |

## 5.2 Service worker to content script

| Message | Sent by | Purpose |
| --- | --- | --- |
| `EXTRACT_FIELDS` | service worker or side panel route | Request DOM field inventory. |
| `FILL_FIELD` | service worker | Fill a field on the active page. |

Additional supported but currently secondary:
- `CLICK_ELEMENT`
- `SCROLL_PAGE`

## 5.3 Service worker to backend `/ws`

| Message | Purpose |
| --- | --- |
| `{"type":"analyze_form","screenshot", "dom_fields":[]}` | Analyze current form, resolve values, and return fill commands. |
| `{"type":"verify_form","screenshot", "fields":[]}` | Verify whether previously filled values appear on screen. |

## 5.4 Service worker to backend `/ws/live/...`

| Message / payload | Purpose |
| --- | --- |
| binary PCM audio frames | Live microphone streaming to ADK. |
| `{"type":"text","text":"..."}` | Text input into the live agent. |
| `{"type":"image","data":"...","mimeType":"image/png"}` | Image blob into the live agent. |
| `{"type":"form_context","fields":[],"screenshot":"..."}` | Gives the live agent current analyzed form context. |

## 5.5 Backend to extension

### From `/ws`

| Message | Purpose |
| --- | --- |
| `BACKEND_UPDATE` | Progress UI updates such as analyzing, matching, preparing fill, verifying. |
| `FORM_ANALYZED` | Final analysis result with `fields` and `fill_commands`. |
| `VERIFICATION_RESULT` | Verification outcome and issues. |

### From `/ws/live/...`

| Message / event | Purpose |
| --- | --- |
| ADK `inputTranscription` | Forwarded as `INPUT_TRANSCRIPTION`. |
| ADK `outputTranscription` or `content.parts[].text` | Forwarded as `VOICE_REPLY`. |
| ADK `turnComplete` | Forwarded as `TURN_COMPLETE`. |
| ADK `interrupted` | Forwarded as `INTERRUPTED`. |
| ADK tool-driven `TOOL_FILL_FIELD` | Fill a browser field during voice interaction. |

## 6. Analyze Button Flow

Source entrypoint: `extension/sidepanel/sidepanel.js -> handleAnalyze()`

## 6.1 Happy path

1. User clicks `Analyze & Fill This Form`.
2. Side panel changes button text to `Analyzing...`, disables the button, and logs screenshot capture.
3. Side panel asks the service worker to `CAPTURE_SCREENSHOT`.
4. Service worker calls `chrome.tabs.captureVisibleTab(...)` and returns a PNG data URL.
5. Side panel queries the active tab.
6. Side panel asks the content script for `EXTRACT_FIELDS`.
7. Content script:
   - clears the filled-element tracker
   - scans all visible form inputs
   - builds field objects with selector, label, value, options, required, and type
   - groups radio buttons into a single field entry
   - returns `fields`
8. Side panel sends `SEND_FORM_DATA` to the service worker with:
   - `screenshot`
   - `dom_fields`
9. Service worker sends two messages:
   - `/ws`: `analyze_form`
   - `/ws/live/...`: `form_context` if live WS is open; otherwise it logs a warning and analysis still continues
10. Backend `/ws` receives `analyze_form`.
11. Backend sends `BACKEND_UPDATE` with initial analysis status.
12. Backend runs `process_form_analysis_async(...)`.
13. `process_form_analysis_async(...)` chooses one path:
   - DOM sufficient: skip Gemini Vision and reconcile DOM directly
   - DOM insufficient: call Gemini Vision, then merge DOM and vision output
14. Backend runs `resolve_field_data_async(...)`.
15. `resolve_field_data(...)` chooses one path per field:
   - fast heuristic match
   - pending, then AI semantic match
   - still pending if AI returns empty or errors
16. Backend runs `build_fill_commands(...)`.
17. Backend updates the shared form context via `set_form_context(...)`.
18. Backend returns `FORM_ANALYZED` with:
   - `fields`
   - `fill_commands`
19. Side panel:
   - restores button text to `Re-Analyze & Fill`
   - re-enables the button
   - updates the field list and progress bar
20. If there are fill commands, side panel calls `executeFillCommands(...)`.
21. `executeFillCommands(...)` sends each `FILL_FIELD` command to the content script sequentially.
22. Content script locates each element with the robust locator stack and fills it.
23. Side panel updates fill progress and activity log after each response.
24. After the fill loop completes, side panel captures another screenshot and sends `SEND_VERIFY`.
25. Backend calls `verify_filled_form(...)` and returns `VERIFICATION_RESULT`.
26. Side panel shows either:
   - `✅ Verified`
   - `⚠️ Issues Found`

## 6.2 Analyze flow branches and edge cases

### A. Screenshot capture fails

Path:
- `CAPTURE_SCREENSHOT` returns an error or no `dataUrl`

Current behavior:
- side panel resets button text to `⚡ Analyze & Fill This Form`
- side panel re-enables the button
- logs `Screenshot failed. Make sure you're on a webpage.`
- flow stops before any backend call

### B. No active tab is returned

Path:
- `chrome.tabs.query(...)` returns no active tab

Current behavior:
- logs `No active tab found.`
- button resets and is re-enabled
- flow stops

### C. Content script extraction works normally

Path:
- `EXTRACT_FIELDS` returns `fields`

Current behavior:
- fields are sent to backend
- backend may still choose DOM-only or DOM+Vision

### D. Content script is not ready or not injected

Path:
- `EXTRACT_FIELDS` fails with `chrome.runtime.lastError`
- or response missing `fields`

Current behavior:
1. side panel logs `Content script not ready. Injecting...`
2. side panel calls `chrome.scripting.executeScript(...)`

Then one of two sub-paths happens.

#### D1. Injection succeeds

Current behavior:
- side panel waits 300ms
- retries `EXTRACT_FIELDS`
- sends whatever field list it gets, including an empty array

Result:
- analysis still proceeds

#### D2. Injection fails

Likely causes:
- restricted pages
- Chrome internal pages
- host restrictions

Current behavior:
- logs `Cannot inject on this page. Using vision-only...`
- sends `dom_fields: []`

Result:
- backend can still analyze the screenshot
- `reconcile_fields(...)` sets `selector: null` and `needs_computer_use: true` for vision-only fields
- auto-fill may later fail because the content script still has no targetable DOM element

### E. DOM extraction returns zero fields

Current behavior:
- side panel still sends screenshot + empty `dom_fields`
- backend falls back to vision-only analysis if Gemini Vision finds fields

### F. DOM labels are good enough

Condition:
- `dom_fields_are_sufficient(...)` returns `True`

Current behavior:
- backend skips Gemini Vision
- fastest path

### G. DOM labels are poor

Condition:
- `dom_fields_are_sufficient(...)` returns `False`

Current behavior:
- backend sends progress update that Vision is running
- backend calls Gemini Vision
- backend merges vision labels into DOM fields, or uses vision-only when DOM is empty

### H. Screenshot base64 decode fails in analysis

Path:
- `call_gemini_vision_async(...)` cannot decode the screenshot

Current behavior:
- returns an empty vision field list
- merge falls back to DOM-only reconciliation if DOM fields exist
- if DOM is also empty, the final merged result is empty

### I. Gemini Vision call fails

Current behavior:
- `call_gemini_vision_async(...)` returns `[]`
- backend continues with whatever DOM data exists
- if there is no usable DOM data either, analysis completes with few or no fields

### J. Data resolver finds direct profile matches

Current behavior:
- matching fields are marked `matched`
- `build_fill_commands(...)` creates commands for them

### K. Data resolver cannot match directly

Current behavior:
- unresolved fields are marked `pending`
- `_ai_match(...)` attempts semantic matching
- if AI also fails or returns empty strings, those fields remain `pending`

Result in UI:
- field list shows `Needs input`
- no fill command is generated for those fields
- user must use voice later if they want to complete them

### K2. Data resolver throws because profile keys are missing

Current code path:
- `_fast_match(...)` uses direct dictionary indexing such as `profile["email"]`, `profile["phone"]`, `profile["full_name"]`
- `USER_PROFILE` is initialized as `{}` in `backend/app/agents/data_resolver.py`

Impact:
- for some common field types or labels, `_fast_match(...)` can raise `KeyError`
- that exception is not caught inside `resolve_field_data(...)`
- control bubbles up to the outer `/ws` handler exception block

Current behavior:
- backend logs `[Form] Error: ...`
- there is no structured error response back to the side panel for this branch
- from the UI perspective, analysis can appear to stall after backend progress messages

### L. Form analysis finishes with zero fill commands

Current behavior:
- side panel does not call `executeFillCommands(...)`
- logs `No fields to auto-fill. Use voice to provide missing data.`

### M. Auto-fill command cannot find its element

Path:
- content script `findFieldElement(...)` returns `null`

Current behavior:
- content script returns `{ success: false }`
- side panel logs `Failed: <label>`
- loop continues to remaining commands

### N. Verification screenshot fails

Path:
- post-fill screenshot capture fails

Current behavior:
- verify request is simply not sent
- no explicit verification error is shown in the side panel

### O. Verification call errors on backend

Current behavior:
- backend catches the error
- returns `VERIFICATION_RESULT` with `verified: false` and embedded error info
- side panel shows warning status

## 7. Recording / Voice Flow

Source entrypoint: `extension/sidepanel/sidepanel.js -> toggleRecording()`

## 7.1 Happy path

1. User clicks `Start Listening`.
2. Side panel sends `START_MIC` to the service worker.
3. Service worker calls `connectLiveWS()`.
4. `connectLiveWS()` creates a fresh live WebSocket using timestamp-based `userId` and `sessionId`.
5. Backend `/ws/live/...` accepts the WebSocket and:
   - creates or resumes ADK session state
   - creates `LiveRequestQueue`
   - registers the live WS callback via `set_ws_callback(websocket.send_text)`
6. Service worker ensures the offscreen document exists with `ensureOffscreenDocument()`.
7. Service worker sends `START_MIC` to the offscreen document.
8. Offscreen document runs `startStreaming()`:
   - requests microphone permission with `getUserMedia(...)`
   - creates a 16kHz `AudioContext`
   - attaches a `ScriptProcessor`
   - converts Float32 samples into PCM Int16
   - base64-encodes the audio buffer
   - sends `AUDIO_CHUNK` messages to the service worker
9. Service worker receives `AUDIO_CHUNK`, decodes base64 back into bytes, and sends binary audio frames over the live WebSocket.
10. Backend live endpoint receives binary frames in `upstream_task()` and forwards them into `LiveRequestQueue` as `audio/pcm;rate=16000`.
11. `Runner.run_live(...)` yields ADK/Gemini events.
12. Backend `downstream_task()` streams those events to the service worker.
13. Service worker converts ADK events into extension messages:
   - `INPUT_TRANSCRIPTION`
   - `VOICE_REPLY`
   - `TURN_COMPLETE`
   - `INTERRUPTED`
   - tool-call handling
14. Side panel updates the transcript and activity log in real time.
15. If the live agent decides to call `fill_field_tool(...)`:
   - backend tool emits `TOOL_FILL_FIELD`
   - service worker forwards `FILL_FIELD` to the active tab
   - content script fills the field
   - service worker broadcasts success or failure status back to the side panel
16. When the user clicks the mic button again, side panel sends `STOP_MIC`.
17. Service worker forwards `STOP_MIC` to offscreen.
18. Offscreen stops the mic stream and closes audio resources.
19. Side panel resets its button state to `Start Listening`.

## 7.2 Recording flow branches and edge cases

### A. Live WebSocket is not yet open when `START_MIC` is requested

Current behavior:
- service worker still calls `connectLiveWS()`
- offscreen start proceeds in parallel
- if audio chunks arrive before the socket reaches `OPEN`, the `AUDIO_CHUNK` handler silently drops them because it only sends when `readyState === OPEN`

Impact:
- initial speech may be lost during startup

### B. Live WebSocket fails to connect

Current behavior:
- `liveWs.onerror` sets `isLiveActive = false`
- side panel may already show mic started if offscreen succeeded
- audio chunks continue being produced locally but are not delivered until a new connection exists
- there is no automatic reconnect loop for the live socket

### C. Offscreen document creation fails

Current behavior:
- `START_MIC` returns `{ success: false, error }`
- side panel logs `Mic failed. Check extension permissions.`
- side panel does not enter recording state

### D. Microphone permission is denied or `getUserMedia(...)` fails

Current behavior:
- `startStreaming()` rejects
- service worker returns failure
- side panel logs mic failure and does not switch to recording mode

### E. User clicks stop after a failed start

Current behavior:
- side panel only sets `isRecording = true` after a successful start response
- so stop is not exposed unless start succeeded

### F. Live agent receives `form_context`

Path:
- after Analyze, service worker sends the current fields and screenshot to `/ws/live/...`

Current behavior:
- backend `upstream_task()` stores those fields through `set_form_context(...)`
- later `analyze_form_tool()` can summarize the analyzed form for the voice agent

### G. Voice agent asks for user input instead of filling immediately

Path:
- user profile data is missing
- or no matched fields exist in context

Current behavior:
- ADK agent can call `analyze_form_tool()`
- it can inspect pending fields
- it asks the user for missing values
- once the user answers, it can call `fill_field_tool(...)`

### H. `fill_field_tool(...)` has no WebSocket callback

Path:
- live WS disconnected
- callback cleared in backend
- or live session never connected

Current behavior:
- tool returns `status: "no_connection"`
- browser field is not updated

### I. Agent tool call reaches service worker but active tab fill fails

Possible causes:
- no active tab
- content script not available
- element not found

Current behavior:
- service worker broadcasts a `BACKEND_UPDATE` warning
- voice UI shows fill failed for that field

### J. User interrupts the AI while it is speaking

Current behavior:
- ADK event includes `interrupted: true`
- service worker broadcasts `INTERRUPTED`
- side panel clears streaming text and logs interruption

### K. AI finishes a response

Current behavior:
- ADK event includes `turnComplete: true`
- side panel clears the transient streaming state but leaves the final transcript visible briefly

### L. User stops mic capture but live WebSocket remains open

Current behavior:
- offscreen stops
- live WS is not explicitly closed by the extension
- backend session remains until WS lifecycle ends externally

## 8. Important Current Implementation Notes

These are worth knowing while reading the flows:

1. The active runtime does not use the conceptual `orchestrator.py`; voice uses `formpilot_agent.py`, while form analysis uses direct Python module calls from `main.py`.
2. `form_context` sent to the live agent currently carries raw DOM fields from the extension when sent by `SEND_FORM_DATA`; later, `/ws` also updates backend memory with resolved fields through `set_form_context(...)`.
3. Vision-only analysis can detect fields without selectors, but current auto-fill still depends on finding a real DOM element in the content script, so some vision-only cases analyze successfully but cannot be auto-filled.
4. The form analysis WebSocket auto-reconnects. The live voice WebSocket does not auto-reconnect.
5. Several tool modules exist as placeholders and are currently empty.
6. `backend/app/agents/data_resolver.py` currently assumes profile keys exist during `_fast_match(...)`; with an empty profile, some analyze requests can fail before pending-field fallback is reached.

## 9. Suggested Reading Order

If you want to inspect the implementation quickly, read in this order:

1. `extension/sidepanel/sidepanel.js`
2. `extension/background/service-worker.js`
3. `extension/content/content.js`
4. `backend/app/main.py`
5. `backend/app/agents/form_analyzer.py`
6. `backend/app/agents/data_resolver.py`
7. `backend/app/agents/form_filler.py`
8. `backend/app/tools/form_tools.py`
9. `backend/app/tools/verification_tools.py`

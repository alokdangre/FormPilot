# 🛠️ FormPilot: Phase-Wise Implementation Plan

> **Start Date:** March 1, 2026
> **Deadline:** March 16, 2026 (5:00 PM PT)
> **Total Days:** 16
> **Total Phases:** 7 (each with a manual test checkpoint)

---

## How To Use This Plan

Each phase ends with a **✅ CHECKPOINT** section. After completing a phase:

1. Run every test in the checkpoint
2. Mark each test as PASS ✅ or FAIL ❌
3. Do NOT move to the next phase until all tests PASS
4. If a test fails, the "Fix" column tells you what to do

---

## Phase Overview

```
Phase 0  ─── Project Setup & Structure ──────────── Day 1 (Mar 1)
Phase 1  ─── Chrome Extension Shell ─────────────── Days 2-3 (Mar 2-3)
Phase 2  ─── Backend + ADK Agent Foundation ──────── Days 4-5 (Mar 4-5)
Phase 3  ─── Form Analysis Engine ───────────────── Days 6-7 (Mar 6-7)
Phase 4  ─── Form Filling Engine ────────────────── Days 8-9 (Mar 8-9)
Phase 5  ─── Voice Conversation + Verification ──── Days 10-11 (Mar 10-11)
Phase 6  ─── Cloud Deployment + Polish ──────────── Days 12-13 (Mar 12-13)
Phase 7  ─── Demo, Blog, Submit ─────────────────── Days 14-16 (Mar 14-16)
```

---

# Phase 0: Project Setup & Structure

**📅 Day 1 (March 1)**
**⏱️ Time: ~4-5 hours**

### What You're Building

The project skeleton — folder structure, dependencies, and configuration. Nothing functional yet, just the foundation.

### Tasks

- [ ] **0.1** Create new project directory (rename or create fresh repo)

```
formpilot/
├── extension/              # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup/              # Extension popup (minimal)
│   │   ├── popup.html
│   │   └── popup.js
│   ├── sidepanel/          # Side panel UI
│   │   ├── sidepanel.html
│   │   ├── sidepanel.css
│   │   └── sidepanel.js
│   ├── content/            # Content scripts (injected into pages)
│   │   └── content.js
│   ├── background/         # Service worker
│   │   └── service-worker.js
│   ├── icons/              # Extension icons
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── utils/
│       └── constants.js
├── backend/                # Python FastAPI + ADK
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # FastAPI app + WebSocket endpoint
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── orchestrator.py    # Root FormPilot agent
│   │   │   ├── form_analyzer.py   # FormAnalyzer sub-agent
│   │   │   ├── data_resolver.py   # DataResolver sub-agent
│   │   │   └── form_filler.py     # FormFiller sub-agent
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   ├── screenshot_tools.py
│   │   │   ├── dom_tools.py
│   │   │   ├── filling_tools.py
│   │   │   └── profile_tools.py
│   │   └── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── blog/                   # Existing reviews + new blog post
├── docs/
│   └── architecture.md     # Architecture diagram for submission
├── scripts/
│   └── deploy.sh           # Automated deployment script
├── .gitignore
└── README.md
```

- [ ] **0.2** Initialize git repo (if not already done)

```bash
git init
git checkout -b main
```

- [ ] **0.3** Create `backend/requirements.txt`

```
google-genai>=1.0.0
google-adk>=0.3.0
fastapi>=0.110.0
uvicorn>=0.27.0
websockets>=12.0
python-dotenv>=1.0.0
Pillow>=10.0.0
```

- [ ] **0.4** Create `backend/.env.example`

```
GOOGLE_API_KEY=your_gemini_api_key_here
GOOGLE_CLOUD_PROJECT=your_project_id
```

- [ ] **0.5** Create `extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "FormPilot",
  "version": "1.0.0",
  "description": "Voice-controlled AI that fills any web form for you",
  "permissions": ["activeTab", "sidePanel", "tabs", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **0.6** Create placeholder icons (use solid color squares for now, replace later)

- [ ] **0.7** Set up Python virtual environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

- [ ] **0.8** Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

- [ ] **0.9** Create `backend/.env` with your real API key (DO NOT commit this)

- [ ] **0.10** Update `.gitignore`

```
backend/venv/
backend/.env
__pycache__/
*.pyc
.DS_Store
node_modules/
```

### ✅ CHECKPOINT 0: Project Structure Verified

| #   | Test                    | How to Verify                                                                                                                                   | Expected Result                                   | Pass? |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----- |
| 0.1 | Folder structure exists | `find formpilot -type f \| head -20`                                                                                                            | All folders and placeholder files present         | ☐     |
| 0.2 | Python env works        | `cd backend && source venv/bin/activate && python -c "import google.genai; print('OK')"`                                                        | Prints "OK"                                       | ☐     |
| 0.3 | Gemini API key works    | `python -c "from google import genai; c=genai.Client(); print(c.models.generate_content(model='gemini-2.5-flash', contents='Say hello').text)"` | Returns a greeting                                | ☐     |
| 0.4 | Extension loads         | Open `chrome://extensions` → Enable Developer mode → Load unpacked → select `extension/` folder                                                 | Extension appears with icon, no errors in console | ☐     |
| 0.5 | Git clean               | `git status`                                                                                                                                    | All files tracked, `.env` is ignored              | ☐     |

---

# Phase 1: Chrome Extension Shell

**📅 Days 2-3 (March 2-3)**
**⏱️ Time: ~8-10 hours**

### What You're Building

A working Chrome extension with:

- A side panel that opens
- Audio capture from microphone
- Screenshot capture of the active tab
- Content script that can read/manipulate DOM
- Message passing between all components

### Tasks

- [ ] **1.1** Build the Side Panel UI
  - HTML layout with: mic button, status indicator, field progress list, profile section
  - CSS styling: dark theme, clean, professional
  - Basic JavaScript: mic button toggles recording state

- [ ] **1.2** Implement audio capture in Side Panel
  - Use `navigator.mediaDevices.getUserMedia({audio: true})`
  - Record audio using `MediaRecorder` API
  - Encode audio chunks as base64
  - Store chunks in a buffer, ready to send

- [ ] **1.3** Implement screenshot capture
  - In the service worker: `chrome.tabs.captureVisibleTab(null, {format: 'png'})`
  - Returns base64 PNG data URL
  - Expose via message passing: content script or side panel can request a screenshot

- [ ] **1.4** Build Content Script: DOM form extraction

```javascript
// content/content.js
function extractFormFields() {
  const fields = [];
  const inputs = document.querySelectorAll("input, select, textarea");
  inputs.forEach((el, index) => {
    const label = findLabelForElement(el);
    fields.push({
      index: index,
      tag: el.tagName.toLowerCase(),
      type: el.type || "text",
      name: el.name || "",
      id: el.id || "",
      label: label,
      placeholder: el.placeholder || "",
      value: el.value || "",
      required: el.required,
      options:
        el.tagName === "SELECT"
          ? Array.from(el.options).map((o) => ({
              value: o.value,
              text: o.text,
            }))
          : [],
      boundingBox: el.getBoundingClientRect(),
      visible: isElementVisible(el),
      selector: generateUniqueSelector(el),
    });
  });
  return fields;
}

function findLabelForElement(el) {
  // 1. Check for associated <label>
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.textContent.trim();
  }
  // 2. Check parent label
  const parentLabel = el.closest("label");
  if (parentLabel) return parentLabel.textContent.trim();
  // 3. Check aria-label
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
  // 4. Check preceding sibling text
  // 5. Fall back to placeholder or name
  return el.placeholder || el.name || "Unknown field";
}

function generateUniqueSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.name) return `[name="${el.name}"]`;
  // Fallback: nth-of-type path
  // ... generate a unique CSS path
}

function isElementVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXTRACT_FIELDS") {
    sendResponse({ fields: extractFormFields() });
  }
  if (msg.type === "FILL_FIELD") {
    const el = document.querySelector(msg.selector);
    if (el) {
      el.focus();
      el.value = msg.value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Element not found" });
    }
  }
  if (msg.type === "CLICK_ELEMENT") {
    const el = document.querySelector(msg.selector);
    if (el) {
      el.click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  }
  if (msg.type === "SCROLL_PAGE") {
    window.scrollBy(0, msg.amount || 300);
    sendResponse({ success: true });
  }
  return true; // Keep message channel open for async
});
```

- [ ] **1.5** Build Message Passing System
  - Service Worker ↔ Content Script: `chrome.tabs.sendMessage(tabId, msg)`
  - Service Worker ↔ Side Panel: `chrome.runtime.sendMessage(msg)`
  - Define message types as constants

- [ ] **1.6** Build "Capture & Display" test flow
  - Side panel button: "Analyze This Form"
  - Clicking it → takes screenshot + extracts DOM fields
  - Displays field list in side panel

### ✅ CHECKPOINT 1: Extension Works Standalone

| #   | Test                 | How to Verify                                                | Expected Result                                    | Pass? |
| --- | -------------------- | ------------------------------------------------------------ | -------------------------------------------------- | ----- |
| 1.1 | Side panel opens     | Click extension icon → side panel slides in                  | Panel visible with mic button, empty field list    | ☐     |
| 1.2 | Audio captures       | Click mic → speak "Hello" → click stop                       | Console shows base64 audio chunks logged           | ☐     |
| 1.3 | Screenshot works     | Open any page → click "Analyze"                              | Console shows base64 PNG data (long string)        | ☐     |
| 1.4 | DOM extraction works | Open a form page (e.g., Google Forms) → click "Analyze"      | Side panel shows list of fields with labels, types | ☐     |
| 1.5 | DOM filling works    | Open the form page → run test: fill a text field via message | Field on the page fills with test data             | ☐     |
| 1.6 | Click action works   | Send CLICK_ELEMENT message for a button                      | Button gets clicked                                | ☐     |
| 1.7 | No console errors    | Open DevTools → check for extension errors                   | Zero errors in console                             | ☐     |

#### Test Forms for Phase 1:

- **Simple:** [Google Forms (create a test form)](https://docs.google.com/forms/)
- **Medium:** Any contact form page
- **Complex (for later):** A mock passport form or multi-step wizard

---

# Phase 2: Backend + ADK Agent Foundation

**📅 Days 4-5 (March 4-5)**
**⏱️ Time: ~10-12 hours**

### What You're Building

A FastAPI backend with WebSocket support, connected to ADK agents, that can receive audio + screenshots from the extension and send back responses.

### Tasks

- [ ] **2.1** Build FastAPI server with WebSocket endpoint

```python
# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json, base64

app = FastAPI(title="FormPilot Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print("Client connected")
    try:
        while True:
            data = await ws.receive_text()
            message = json.loads(data)

            if message["type"] == "screenshot":
                # Process screenshot with FormAnalyzer
                result = await process_screenshot(message["data"])
                await ws.send_text(json.dumps(result))

            elif message["type"] == "audio":
                # Process audio with ADK bidi-streaming
                result = await process_audio(message["data"])
                await ws.send_text(json.dumps(result))

            elif message["type"] == "dom_fields":
                # Receive DOM field data from extension
                result = await process_dom_fields(message["data"])
                await ws.send_text(json.dumps(result))

    except WebSocketDisconnect:
        print("Client disconnected")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "formpilot"}
```

- [ ] **2.2** Build the Orchestrator Agent (root agent)

```python
# backend/app/agents/orchestrator.py
from google.adk import Agent

def create_orchestrator(form_analyzer, data_resolver, form_filler):
    return Agent(
        model="gemini-2.5-flash",
        name="FormPilot",
        instruction="""You are FormPilot, a voice-controlled AI that fills
        web forms for users. You coordinate three specialists:

        1. FormAnalyzer: Analyzes screenshots/DOM to identify form fields
        2. DataResolver: Matches fields to user profile data
        3. FormFiller: Executes the actual form filling actions

        WORKFLOW:
        - When user says "fill this form", delegate to FormAnalyzer first
        - Then send field list to DataResolver for value mapping
        - Then send field+value pairs to FormFiller for execution
        - After filling, verify by taking a new screenshot

        VOICE RULES:
        - Keep responses SHORT (under 15 seconds of speech)
        - Always tell user what you're doing: "Analyzing the form..."
        - Report progress: "Filled 5 of 8 fields..."
        - Ask for confirmation before submitting

        NEVER make up personal data. Always use profile or ask user.""",
        sub_agents=[form_analyzer, data_resolver, form_filler],
    )
```

- [ ] **2.3** Build FormAnalyzer Agent (stub — will be completed in Phase 3)

- [ ] **2.4** Build DataResolver Agent (stub — will be completed in Phase 4)

- [ ] **2.5** Build FormFiller Agent (stub — will be completed in Phase 4)

- [ ] **2.6** Connect WebSocket in the Chrome Extension service worker

```javascript
// background/service-worker.js
let ws = null;
const BACKEND_URL = "ws://localhost:8000/ws";

function connectWebSocket() {
  ws = new WebSocket(BACKEND_URL);
  ws.onopen = () => console.log("Connected to FormPilot backend");
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleBackendResponse(data);
  };
  ws.onerror = (err) => console.error("WebSocket error:", err);
  ws.onclose = () => {
    console.log("Disconnected, reconnecting in 3s...");
    setTimeout(connectWebSocket, 3000);
  };
}

function sendToBackend(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
```

- [ ] **2.7** Build the user profile system
  - Store profile as JSON in `chrome.storage.local`
  - Side panel has a "Profile" tab where user enters their info
  - Profile fields: name, email, phone, DOB, address, education, work

- [ ] **2.8** Test the round-trip: Extension → Backend → Extension
  - Send a test message from extension to backend
  - Backend echoes it back
  - Extension receives the echo

### ✅ CHECKPOINT 2: Extension ↔ Backend Communication

| #   | Test                  | How to Verify                                  | Expected Result                                         | Pass? |
| --- | --------------------- | ---------------------------------------------- | ------------------------------------------------------- | ----- |
| 2.1 | Backend starts        | `cd backend && uvicorn app.main:app --reload`  | Server running on `http://localhost:8000`               | ☐     |
| 2.2 | Health check          | Open `http://localhost:8000/health` in browser | Returns `{"status": "ok"}`                              | ☐     |
| 2.3 | WebSocket connects    | Open extension → check service worker console  | "Connected to FormPilot backend" logged                 | ☐     |
| 2.4 | Screenshot → Backend  | Click "Analyze" → check backend logs           | Backend receives base64 PNG, logs "Received screenshot" | ☐     |
| 2.5 | Backend → Extension   | Backend sends test response                    | Extension side panel shows "Connected ✅" status        | ☐     |
| 2.6 | Profile saves         | Fill in profile form → refresh extension       | Profile data persists (stored in chrome.storage.local)  | ☐     |
| 2.7 | ADK agent initializes | Backend logs show ADK agent creation           | "FormPilot agent created with 3 sub-agents"             | ☐     |

---

# Phase 3: Form Analysis Engine

**📅 Days 6-7 (March 6-7)**
**⏱️ Time: ~10-12 hours**

### What You're Building

The dual-engine form analysis: DOM extraction (fast) + Gemini Vision analysis (smart). This is the FormAnalyzer agent becoming real.

### Tasks

- [ ] **3.1** Complete FormAnalyzer Agent with Gemini Vision
  - Receive screenshot from extension
  - Send to Gemini with structured output schema
  - Get back: field labels, types, positions, required/optional
  - Merge with DOM data for completeness

- [ ] **3.2** Build the DOM → Gemini field reconciliation logic

```python
def reconcile_fields(dom_fields, vision_fields):
    """Merge DOM-detected fields with Vision-detected fields.
    DOM is the source of truth for selectors and values.
    Vision fills in labels/types that DOM missed."""

    merged = []
    for dom_field in dom_fields:
        # Try to match with a vision field by position/label
        matching_vision = find_matching_vision_field(dom_field, vision_fields)

        merged_field = {
            "selector": dom_field["selector"],      # From DOM (ground truth)
            "label": matching_vision["label"] if matching_vision
                     else dom_field["label"],         # Vision label preferred
            "type": dom_field["type"],                # From DOM (ground truth)
            "current_value": dom_field["value"],      # From DOM
            "required": dom_field["required"],        # From DOM
            "options": dom_field["options"],           # From DOM (for selects)
            "position": dom_field["boundingBox"],     # From DOM
        }
        merged.append(merged_field)

    # Add any vision-only fields (hidden from DOM, e.g., visual-only buttons)
    for v_field in vision_fields:
        if not any_dom_match(v_field, dom_fields):
            merged.append({
                "selector": None,  # No DOM selector — need Computer Use
                "label": v_field["label"],
                "type": v_field["type"],
                "position_description": v_field["position"],
                "needs_computer_use": True,
            })

    return merged
```

- [ ] **3.3** Build DataResolver Agent (real implementation)
  - Receive merged field list
  - Load user profile from storage
  - Map each field to profile data intelligently:
    - "Full Name" → `profile.full_name`
    - "Email Address" → `profile.email`
    - "Date of Birth" → `profile.dob` (formatted appropriately)
    - "State" → `profile.address.state`
  - Flag fields with no matching profile data as `needs_user_input`
  - For open-ended questions, prepare a contextual answer to confirm with user

- [ ] **3.4** Build the format_date tool
  - Detect target date format from field context (DD/MM/YYYY, MM-DD-YYYY, etc.)
  - Convert user's DOB to the right format

- [ ] **3.5** Display analyzed fields in the side panel
  - After analysis, side panel shows field list:
    - ✅ Matched fields (green) — have profile data
    - ⚠️ Pending fields (yellow) — need user input
    - ⬜ Unfilled fields (gray) — waiting

### ✅ CHECKPOINT 3: Form Analysis Works

| #   | Test                            | How to Verify                                          | Expected Result                                                         | Pass? |
| --- | ------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- | ----- |
| 3.1 | DOM extraction returns fields   | Open Google Form → click Analyze                       | Side panel shows all form fields with labels                            | ☐     |
| 3.2 | Gemini Vision identifies fields | Send screenshot to backend → check response            | Returns JSON with field labels, types, positions                        | ☐     |
| 3.3 | Merged fields are complete      | Compare DOM fields + Vision fields                     | All form fields accounted for, no duplicates                            | ☐     |
| 3.4 | Profile matching works          | Given fields ["Full Name", "Email", "Phone"] + profile | Returns [{field: "Full Name", value: "Alok Dangre", source: "profile"}] | ☐     |
| 3.5 | Missing fields flagged          | Field "Mother's Maiden Name" not in profile            | Flagged as `needs_user_input: true`                                     | ☐     |
| 3.6 | Date format detected            | Field labeled "DOB (DD/MM/YYYY)"                       | Correctly formats as "15/05/1999"                                       | ☐     |
| 3.7 | Side panel shows analysis       | After analysis completes                               | All fields listed with color-coded status                               | ☐     |

#### Test on these forms:

1. **Your own Google Form** (create one with: Name, Email, Phone, DOB, Address, Dropdown)
2. **A contact form** on any website
3. **A multi-field form** (find one with 10+ fields)

---

# Phase 4: Form Filling Engine

**📅 Days 8-9 (March 8-9)**
**⏱️ Time: ~12-14 hours**

### What You're Building

The FormFiller agent — actually filling fields on the page via DOM manipulation, with Computer Use as fallback for complex widgets.

### Tasks

- [ ] **4.1** Implement DOM-based field filling
  - Text/email/phone: `el.value = data; el.dispatchEvent(new Event('input', {bubbles: true}))`
  - **Key detail:** Many React/Angular forms don't detect `.value =` changes. Use the `InputEvent` approach:

```javascript
function fillFieldReliably(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return false;

  // Focus the element
  el.focus();
  el.click();

  // Clear existing value
  el.value = "";

  // Use execCommand for React/Angular compatibility
  document.execCommand("insertText", false, value);

  // Also dispatch events for frameworks that listen to them
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));

  return el.value === value;
}
```

- [ ] **4.2** Implement dropdown selection

```javascript
function selectDropdownOption(selector, optionText) {
  const el = document.querySelector(selector);
  if (!el || el.tagName !== "SELECT") return false;

  const option = Array.from(el.options).find(
    (o) => o.text.trim().toLowerCase() === optionText.trim().toLowerCase(),
  );

  if (option) {
    el.value = option.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  return false;
}
```

- [ ] **4.3** Implement checkbox/radio selection

```javascript
function selectCheckboxOrRadio(selector, shouldCheck = true) {
  const el = document.querySelector(selector);
  if (!el) return false;
  if (el.checked !== shouldCheck) {
    el.click();
  }
  return true;
}
```

- [ ] **4.4** Implement sequential field filling with visual feedback
  - Fill one field at a time with a small delay (200-500ms)
  - After each fill, update side panel progress
  - Add a subtle highlight (green border flash) on the field being filled

- [ ] **4.5** Implement "Next" / "Continue" button detection and clicking

```javascript
function findAndClickNextButton() {
  const buttonTexts = [
    "next",
    "continue",
    "proceed",
    "submit",
    "next step",
    "save and continue",
    "आगे",
  ];

  // Search buttons and links
  const clickables = [
    ...document.querySelectorAll('button, input[type="submit"], a'),
  ];

  for (const el of clickables) {
    const text = (el.textContent || el.value || "").trim().toLowerCase();
    if (buttonTexts.some((btn) => text.includes(btn))) {
      el.click();
      return { success: true, clicked: text };
    }
  }
  return { success: false, message: "No next button found" };
}
```

- [ ] **4.6** Implement Computer Use fallback (for when DOM methods fail)
  - When DOM fill fails → take screenshot → send to Gemini Computer Use
  - Gemini returns `click_at(x, y)` or `type_text_at(x, y, text)`
  - Content script executes: `document.elementFromPoint(x, y).click()`
  - **Note:** This is the complex widget handler for custom date pickers, Material UI dropdowns, etc.

- [ ] **4.7** Build the end-to-end fill flow
  - Orchestrator coordinates: Analyze → Resolve → Fill (field by field) → Report

### ✅ CHECKPOINT 4: Forms Get Filled

| #   | Test                              | How to Verify                     | Expected Result                              | Pass? |
| --- | --------------------------------- | --------------------------------- | -------------------------------------------- | ----- |
| 4.1 | Text field fills                  | Open Google Form → trigger fill   | Name field shows "Alok Dangre"               | ☐     |
| 4.2 | Email field fills                 | Same form                         | Email field shows user's email               | ☐     |
| 4.3 | Dropdown selects                  | Form has a dropdown (e.g., State) | Correct option selected                      | ☐     |
| 4.4 | Multiple fields fill sequentially | Form has 5+ fields                | All fill one-by-one with visible progress    | ☐     |
| 4.5 | Side panel progress updates       | During filling                    | Progress bar moves: "3/8 fields filled"      | ☐     |
| 4.6 | "Next" button detection           | Open a multi-page form            | AI finds and clicks "Next"                   | ☐     |
| 4.7 | Page 2 fills after navigation     | Multi-page form                   | Fields on page 2 also get filled             | ☐     |
| 4.8 | React form compatibility          | Test on a React-based form        | Fields fill correctly (no blank fields)      | ☐     |
| 4.9 | Green flash highlight             | During filling                    | Each field briefly flashes green when filled | ☐     |

#### Test forms for Phase 4:

1. **Your own Google Form** (simple)
2. **A multi-page Google Form** (with sections)
3. **A React contact form** (find any React website contact page)
4. **A form with dropdowns** (state/country selectors)

---

# Phase 5: Voice Conversation + Verification

**📅 Days 10-11 (March 10-11)**
**⏱️ Time: ~12-14 hours**

### What You're Building

The "Live" factor: real-time voice conversation with the AI during form filling, plus the self-verification loop.

### Tasks

- [ ] **5.1** Implement ADK Bidi-streaming for voice
  - Extension captures audio → sends base64 chunks via WebSocket
  - Backend feeds audio into ADK's Bidi-streaming runner
  - ADK processes audio → Gemini understands speech
  - Gemini generates audio response → sent back via WebSocket
  - Extension plays audio response

- [ ] **5.2** Implement the "ask user" voice flow
  - When DataResolver flags a missing field:
    1. AI speaks: "I need your mother's maiden name. What is it?"
    2. User speaks: "Sharma"
    3. AI confirms: "Got it. Sharma."
    4. DataResolver receives the value → FormFiller fills it

- [ ] **5.3** Implement barge-in (user interruption)
  - If user speaks while AI is filling: pause filling, listen
  - User says: "Wait, use my office address instead"
  - AI: "Sure, switching to office address."
  - Re-resolve and re-fill the address field

- [ ] **5.4** Implement voice trigger
  - "Hey FormPilot" or button press → starts listening
  - "Fill this form" → triggers the full flow
  - "Stop" / "Cancel" → stops current operation

- [ ] **5.5** Build the self-verification loop

```python
async def verify_filled_form(expected_values: dict) -> dict:
    """Take a screenshot of the filled form and verify all fields."""
    screenshot = await capture_screenshot()

    response = await gemini_vision.generate_content(
        contents=[
            f"I filled a form with these values: {json.dumps(expected_values)}. "
            f"Look at this screenshot and verify each field is filled correctly. "
            f"Return JSON: {{verified: bool, issues: [{{field, expected, actual}}]}}",
            screenshot
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )
    return json.loads(response.text)
```

- [ ] **5.6** Implement the voice summary report
  - After filling + verification: "All 12 fields are filled correctly. The form is ready. Would you like me to submit it, or do you want to review first?"

- [ ] **5.7** Add audio cues
  - Subtle _ding_ sound when a field is filled
  - _chime_ when all fields are complete
  - _alert_ sound if verification finds issues

### ✅ CHECKPOINT 5: Voice Works + Verification Works

| #   | Test                      | How to Verify                                                       | Expected Result                                           | Pass? |
| --- | ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- | ----- |
| 5.1 | Voice input captured      | Speak "Hello FormPilot"                                             | Backend logs received audio                               | ☐     |
| 5.2 | AI understands speech     | Say "Fill this form"                                                | AI starts executing the fill flow                         | ☐     |
| 5.3 | AI speaks back            | AI completes analysis                                               | Hear AI say "I found 8 fields. Starting to fill..."       | ☐     |
| 5.4 | Missing data conversation | Form has a field not in profile                                     | AI asks via voice, user responds, field fills             | ☐     |
| 5.5 | Barge-in works            | Start filling → say "Wait"                                          | AI pauses and listens                                     | ☐     |
| 5.6 | Verification screenshot   | After filling all fields                                            | AI says "All fields verified correctly" or reports issues | ☐     |
| 5.7 | Audio cues play           | During filling                                                      | Hear ding/chime sounds at appropriate moments             | ☐     |
| 5.8 | Full voice flow works     | Open form → "Hey FormPilot, fill this form" → hands-free completion | Entire form fills via voice only, no clicking needed      | ☐     |

---

# Phase 6: Cloud Deployment + Polish

**📅 Days 12-13 (March 12-13)**
**⏱️ Time: ~10-12 hours**

### What You're Building

Deploy to Google Cloud Run, add Secret Manager, polish the UI, handle edge cases.

### Tasks

- [ ] **6.1** Create Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app/ ./app/
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

- [ ] **6.2** Create deploy script (`scripts/deploy.sh`)

```bash
#!/bin/bash
set -e

PROJECT_ID="your-project-id"
REGION="us-central1"
SERVICE_NAME="formpilot-backend"

# Build and push container
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME backend/

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --session-affinity \
  --timeout 300 \
  --set-env-vars "GOOGLE_API_KEY=$(gcloud secrets versions access latest --secret=gemini-api-key)"

echo "Deployed! URL:"
gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'
```

- [ ] **6.3** Set up Secret Manager for the API key

```bash
echo -n "YOUR_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
```

- [ ] **6.4** Deploy to Cloud Run and test
  - Update extension's WebSocket URL from `ws://localhost:8000/ws` to production URL
  - Test full flow against deployed backend

- [ ] **6.5** Polish side panel UI
  - Smooth animations for field filling progress
  - Mic button pulse animation when listening
  - Clean typography and spacing
  - FormPilot logo/branding

- [ ] **6.6** Handle edge cases
  - WebSocket reconnection on disconnect
  - Timeout handling (if Gemini is slow)
  - Error messages (if form analysis fails)
  - Graceful fallback when Computer Use is unavailable

- [ ] **6.7** Record Cloud deployment proof
  - Screen record: GCP Console → Cloud Run → show the service running
  - Or show `gcloud run services describe` output
  - Save as `proof_of_deployment.mp4`

### ✅ CHECKPOINT 6: Production Ready

| #   | Test                      | How to Verify                                             | Expected Result                                                  | Pass? |
| --- | ------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- | ----- |
| 6.1 | Docker builds             | `docker build -t formpilot backend/`                      | Image builds without errors                                      | ☐     |
| 6.2 | Container runs locally    | `docker run -p 8080:8080 formpilot` → test with extension | Full flow works against containerized backend                    | ☐     |
| 6.3 | Cloud Run deployed        | `gcloud run services describe formpilot-backend`          | SERVICE is ACTIVE, URL available                                 | ☐     |
| 6.4 | Extension → Cloud Run     | Switch WebSocket URL → test full flow                     | Form fills correctly against cloud backend                       | ☐     |
| 6.5 | Deployment proof recorded | Check `proof_of_deployment.mp4`                           | Shows Cloud Run console with service running                     | ☐     |
| 6.6 | UI looks polished         | Visual review of side panel                               | Professional, dark theme, animations smooth                      | ☐     |
| 6.7 | Error recovery            | Kill backend → extension handles gracefully               | Shows "Reconnecting..." message, reconnects when backend is back | ☐     |

---

# Phase 7: Demo, Blog, Submit

**📅 Days 14-16 (March 14-16)**
**⏱️ Time: ~12-15 hours**

### What You're Building

The submission materials: demo video, blog post, architecture diagram, README.

### Tasks

- [ ] **7.1** Write the demo script (3.5 minutes max)

```
SCENE 1 — THE PROBLEM (30 sec)
"Every year, millions of people struggle with web forms.
Government applications, job portals, healthcare registrations.
For visually impaired users, it's nearly impossible.
What if AI could fill any form — just by listening to you?"

SCENE 2 — SETUP (20 sec)
Show FormPilot extension installed.
Quick profile setup: "I've already added my basic info."
Navigate to a Google Form (simple, 6 fields).

SCENE 3 — SIMPLE FORM (60 sec)
Voice: "Hey FormPilot, fill this form for me."
AI responds: "I see 6 fields. Let me fill them."
Watch AI fill fields one by one (with green flashes).
AI: "All 6 fields filled. Everything looks correct."

SCENE 4 — COMPLEX FORM (60 sec)
Navigate to a mock multi-page form.
Voice: "Fill this passport application."
AI fills page 1 (name, DOB, address, dropdown for state).
AI: "I need your mother's maiden name."
User speaks: "Sharma"
AI fills it → clicks Next → fills page 2.
AI: "Both pages complete. 14 fields filled correctly."

SCENE 5 — ARCHITECTURE (30 sec)
Show architecture diagram.
Explain: multi-agent system, dual-engine filling, Cloud Run.

SCENE 6 — ACCESSIBILITY PITCH (30 sec)
"FormPilot makes the inaccessible web accessible.
For anyone who struggles with forms — the elderly,
the visually impaired, non-tech-savvy users —
FormPilot is their hands on screen."
```

- [ ] **7.2** Film the demo video
  - Use OBS or screen recording
  - Record full screen with audio (your voice + AI voice)
  - Edit for pacing (cut dead time, but keep it REAL — no mockups)
  - Upload to YouTube (public)

- [ ] **7.3** Create architecture diagram
  - Use draw.io, Excalidraw, or Mermaid
  - Show: Extension → WebSocket → Cloud Run → ADK Agents → Gemini
  - Save as PNG for Devpost upload

- [ ] **7.4** Write blog post (dev.to or Medium)
  - Title: "Building FormPilot: How I Used Gemini + ADK to Create a Voice-Controlled Form Filler"
  - Include: problem statement, architecture, technical challenges, code snippets
  - Must include: "I created this content for the purposes of entering the #GeminiLiveAgentChallenge hackathon"
  - Publish publicly

- [ ] **7.5** Write comprehensive README.md
  - Project description
  - Demo video link
  - Architecture diagram
  - Setup instructions (step-by-step)
  - Tech stack
  - How it works
  - Screenshots

- [ ] **7.6** Create deploy automation proof
  - Include `scripts/deploy.sh` in repo
  - Show it works in deployment proof video

- [ ] **7.7** Join GDG and get profile link
  - [developers.google.com/community/gdg](https://developers.google.com/community/gdg)
  - Get public profile URL for +0.2 bonus

- [ ] **7.8** Submit on Devpost
  - [ ] Text description
  - [ ] GitHub repo URL (public)
  - [ ] Demo video (YouTube link)
  - [ ] Architecture diagram (image upload)
  - [ ] Cloud deployment proof
  - [ ] Blog post link (optional bonus)
  - [ ] Deploy automation (in repo)
  - [ ] GDG profile link (optional bonus)
  - [ ] Select category: **UI Navigator**

### ✅ CHECKPOINT 7: SUBMITTED

| #   | Test                          | How to Verify                          | Expected Result                               | Pass? |
| --- | ----------------------------- | -------------------------------------- | --------------------------------------------- | ----- |
| 7.1 | Demo video < 4 min            | Check video length                     | Under 4 minutes                               | ☐     |
| 7.2 | Video shows real software     | Watch video                            | No mockups — actual AI filling actual forms   | ☐     |
| 7.3 | Video has pitch               | Watch intro                            | Problem + solution clearly explained          | ☐     |
| 7.4 | Architecture diagram clear    | View the image                         | Shows all components and connections          | ☐     |
| 7.5 | README has setup instructions | Follow README steps on a fresh machine | Project can be set up and run                 | ☐     |
| 7.6 | Blog post published           | Visit the URL                          | Post is public with hackathon mention         | ☐     |
| 7.7 | Repo is public                | Visit GitHub URL in incognito          | Code visible without login                    | ☐     |
| 7.8 | Devpost submission complete   | Check Devpost                          | All required fields filled, category selected | ☐     |

---

# 🎯 Risk Destruction Checklist

This is your TODO for eliminating every identified risk. Complete these throughout the build.

## 🔴 CRITICAL RISKS

- [ ] **RISK: Computer Use Latency (2-5s per action)**
  - [ ] Implement DOM-based filling as primary engine (instant)
  - [ ] Use Computer Use ONLY for dropdowns/date pickers that DOM can't handle
  - [ ] Pre-warm Gemini by sending screenshot during audio processing (parallel, not sequential)
  - [ ] In demo, show 3-4 fields via DOM (fast!) then 1 via Computer Use (impressive but slower)
  - [ ] Set realistic user expectations in voice: "Filling... this dropdown needs a moment..."
  - [ ] **Test:** Time the full fill cycle. Target: < 30 seconds for 10-field form

- [ ] **RISK: React/Angular form compatibility**
  - [ ] Use `document.execCommand('insertText')` instead of `.value =`
  - [ ] Dispatch `input`, `change`, AND `blur` events after filling
  - [ ] Test on at least 3 frameworks: vanilla HTML, React, Angular/Vue
  - [ ] Have content script detect the framework and use appropriate fill method
  - [ ] **Test:** Fill a field on a React form → value persists after clicking away

- [ ] **RISK: Complex UI widgets (date pickers, custom dropdowns)**
  - [ ] For `<select>` elements: pure DOM manipulation (works 99% of the time)
  - [ ] For Material UI Select/Autocomplete: click to open → find option → click
  - [ ] For date pickers: try setting `.value` first, fall back to Computer Use
  - [ ] **Mitigation for demo:** Use forms with standard HTML elements, not custom widgets
  - [ ] **Test:** Fill a form with a `<select>` dropdown → option selected

- [ ] **RISK: WebSocket breaks on Cloud Run**
  - [ ] Enable session affinity: `gcloud run deploy --session-affinity`
  - [ ] Set timeout: `--timeout=300`
  - [ ] Implement auto-reconnect in extension (with exponential backoff)
  - [ ] Test WebSocket stability for 5+ minute sessions
  - [ ] **Test:** Leave connection open 5 min → still responsive

- [ ] **RISK: Scope creep (building too much)**
  - [ ] ❌ NO file upload support
  - [ ] ❌ NO CAPTCHA solving
  - [ ] ❌ NO multi-language (English only)
  - [ ] ❌ NO resume PDF parsing (JSON profile only)
  - [ ] ❌ NO authentication system
  - [ ] ❌ NO form history/saving
  - [ ] ✅ ONLY build what's in the demo script
  - [ ] **Check:** Every feature you build, ask: "Is this in my demo video?"

## 🟡 MEDIUM RISKS

- [ ] **RISK: Audio quality / speech recognition accuracy**
  - [ ] Test in quiet environment (for demo)
  - [ ] Test with clear, slow speech
  - [ ] Have a fallback: side panel text input if voice fails
  - [ ] **Test:** Say 5 commands → AI understands at least 4/5

- [ ] **RISK: Demo form changes or breaks**
  - [ ] Create your OWN Google Form for the demo (you control it)
  - [ ] Also create a mock multi-page form (using a simple HTML file)
  - [ ] Host the mock form on GitHub Pages or localhost
  - [ ] Don't rely on third-party forms you don't control
  - [ ] **Test:** Verify demo forms work 3 days before filming

- [ ] **RISK: Gemini API rate limits / downtime**
  - [ ] Monitor your API usage at [aistudio.google.com](https://aistudio.google.com/)
  - [ ] Use `gemini-2.5-flash` (higher rate limits than Pro)
  - [ ] Implement retry logic with exponential backoff
  - [ ] Have a pre-recorded backup demo video in case API is down during filming
  - [ ] **Test:** Run 20 consecutive analysis calls → all succeed

- [ ] **RISK: Multi-page form navigation fails**
  - [ ] Test "Next" button detection on 3+ different forms
  - [ ] Wait for page load after clicking (use `setTimeout` or `MutationObserver`)
  - [ ] Re-extract DOM fields after each page navigation
  - [ ] Handle form validation errors (if form doesn't let you proceed)
  - [ ] **Test:** Fill page 1 → click Next → page 2 loads → fill page 2

## 🟢 LOW RISKS (But Still Handle Them)

- [ ] **RISK: Side panel UI performance**
  - [ ] Don't re-render the entire field list on every update
  - [ ] Use incremental DOM updates
  - [ ] **Test:** Fill 20 fields → UI stays responsive

- [ ] **RISK: Profile data edge cases**
  - [ ] Handle missing optional fields gracefully
  - [ ] Handle special characters in names (apostrophes, hyphens)
  - [ ] Handle international phone number formats
  - [ ] **Test:** Profile with special chars → fills correctly

- [ ] **RISK: Blog post quality**
  - [ ] Write it on Day 15 (not last minute)
  - [ ] Include code snippets, architecture diagram, screenshots
  - [ ] Include the required hackathon mention
  - [ ] Proofread for clarity
  - [ ] **Test:** Read it out loud → does it make sense to a stranger?

- [ ] **RISK: GitHub repo cleanup**
  - [ ] Remove all console.log debug statements
  - [ ] Remove test credentials
  - [ ] Add code comments
  - [ ] Ensure `.env` is in `.gitignore`
  - [ ] **Test:** Clone repo on different machine → setup instructions work

---

## 🏁 Pre-Submission Final Checklist

Before hitting "Submit" on Devpost, verify EVERYTHING:

### Submission Requirements

- [ ] Demo video uploaded to YouTube (public, not unlisted)
- [ ] Demo video is under 4 minutes
- [ ] Demo video shows REAL software (no mockups)
- [ ] Demo video includes the pitch (problem + solution)
- [ ] Demo video is in English (or has English subtitles)
- [ ] GitHub repo is PUBLIC
- [ ] README has setup instructions
- [ ] Architecture diagram is included (in repo or image upload)
- [ ] Cloud deployment proof (screen recording or code link)
- [ ] Text description is complete and detailed
- [ ] Category selected: **UI Navigator**

### Bonus Points

- [ ] Blog post published (public, with hackathon mention) → +0.6
- [ ] `scripts/deploy.sh` in repo (automated deployment) → +0.2
- [ ] GDG profile link provided → +0.2

### Quality Checks

- [ ] Extension loads without errors
- [ ] Backend health check works (`/health` endpoint)
- [ ] WebSocket connects successfully
- [ ] Full voice → fill → verify flow works end-to-end
- [ ] No API keys in the codebase
- [ ] Code is reasonably commented
- [ ] Architecture diagram matches actual implementation

---

> **Remember: Film the demo video on Day 14 (March 14). NOT the last day.**
> If something breaks, you have 2 days to fix it and re-film.
> The demo video IS the product. Everything else supports it.

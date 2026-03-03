# 🏆 FormPilot: The Definitive Plan — Architecture, Differentiation, and Winning Strategy

> **Author:** Critical Review Agent (Final Edition)
> **Date:** 2026-02-28
> **Status:** CONFIRMED — FormPilot is the project.
> **Goal:** Build the best form-filling AI agent in the Gemini Live Agent Challenge.

---

## Table of Contents

1. [Competitor Landscape (Exhaustive)](#1-competitor-landscape-exhaustive)
2. [The Gap Nobody Has Filled](#2-the-gap-nobody-has-filled)
3. [What Makes FormPilot Impossible To Copy Easily](#3-what-makes-formpilot-impossible-to-copy-easily)
4. [Multi-Agent Architecture (Production Grade)](#4-multi-agent-architecture-production-grade)
5. [User Experience Design: Voice-First UX Best Practices](#5-user-experience-design-voice-first-ux-best-practices)
6. [Technical Stack (Every Piece)](#6-technical-stack-every-piece)
7. [The Agent Loop: How It Actually Works](#7-the-agent-loop-how-it-actually-works)
8. [Tool Definitions (Complete)](#8-tool-definitions-complete)
9. [Hackathon Scoring Optimization](#9-hackathon-scoring-optimization)
10. [Final Criticism: What Can STILL Kill This Project](#10-final-criticism-what-can-still-kill-this-project)
11. [Implementation Timeline (16 Days)](#11-implementation-timeline-16-days)
12. [Links & Resources](#12-links--resources)

---

## 1. Competitor Landscape (Exhaustive)

### Direct Competitors: AI Form Fillers

| Product              | What It Does                      | Voice? | Vision? | Any Form?     | Multi-page? | Conversational? | Open Source? |
| -------------------- | --------------------------------- | ------ | ------- | ------------- | ----------- | --------------- | ------------ |
| **Chrome Autofill**  | Fills name/email/address          | ❌     | ❌      | ❌ Basic only | ❌          | ❌              | ❌           |
| **AI Form Fill**     | GPT-4 powered field completion    | ❌     | ❌      | ⚠️ Partial    | ❌          | ❌              | ❌           |
| **FillApp**          | AI autofill with natural language | ❌     | ❌      | ⚠️ Partial    | ❌          | ❌              | ❌           |
| **Autofillr**        | AI browser form filler            | ❌     | ❌      | ⚠️ Partial    | ❌          | ❌              | ❌           |
| **WebFill**          | AI data entry extension           | ❌     | ❌      | ⚠️            | ❌          | ❌              | ❌           |
| **Simplify Copilot** | Job application autofill          | ❌     | ❌      | ❌ Jobs only  | ❌          | ❌              | ❌           |
| **JobFill**          | Job form autofill                 | ❌     | ❌      | ❌ Jobs only  | ❌          | ❌              | ❌           |
| **Magical AI**       | Data entry from any tab           | ❌     | ❌      | ⚠️            | ❌          | ❌              | ❌           |
| **Thunderbit**       | Autofill + web scraping           | ❌     | ❌      | ⚠️            | ⚠️          | ❌              | ❌           |
| **Form Solver AI**   | Gemini/GPT form filling           | ❌     | ❌      | ⚠️            | ❌          | ❌              | ❌           |

### Broader AI Browser Agents

| Product       | Form Filling?      | Voice?   | Vision? | Notes                                          |
| ------------- | ------------------ | -------- | ------- | ---------------------------------------------- |
| **HARPA AI**  | ⚠️ Scripted        | ❌       | ❌      | Requires user-written macros; not autonomous   |
| **Monica AI** | ⚠️ Basic           | ❌       | ❌      | General purpose AI assistant, not form-focused |
| **Axiom.ai**  | ⚠️ Record & replay | ❌       | ❌      | Not intelligent; replays exact steps           |
| **Sista AI**  | ✅                 | ✅ Voice | ❌      | Voice agents but no visual form understanding  |
| **Zipifil**   | ✅                 | ❌       | ❌      | Has "Agentic Mouse" but no voice, no vision    |

### The Competitive Gap

```
                    Voice Input
                        │
                   ✅   │   ❌
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    │   FormPilot       │   Form Solver AI  │
    │   (YOURS)         │   FillApp         │
    │                   │   AI Form Fill    │
    │   ★ Only one      │   Thunderbit      │
    │     in this       │                   │
✅  │     quadrant      │                   │  Visual
    │                   │                   │  Understanding
    ├───────────────────┼───────────────────┤
    │                   │                   │
    │   Sista AI        │   Chrome Autofill │
    │   (voice but      │   Simplify        │
    │    no vision)     │   Magical AI      │
    │                   │   HARPA           │
❌  │                   │   Axiom.ai        │
    │                   │                   │
    └───────────────────┴───────────────────┘
```

> [!IMPORTANT]
> **FormPilot is the ONLY product that combines: Voice Input + Visual Form Understanding + Autonomous Action + Conversational AI + Multi-page Navigation.** No existing product occupies this space. This is your moat.

---

## 2. The Gap Nobody Has Filled

### What Every Competitor Gets Wrong

1. **Text-only interaction.** Every form filler requires clicking a button or typing. None let you just TALK.
2. **No visual understanding.** They all rely on DOM/HTML parsing. When the HTML is messy, they break. They can't "see" a form the way a human can.
3. **Single-page only.** None handle multi-page wizard forms (passport applications, university admissions, government portals).
4. **No conversation.** When a field is ambiguous or info is missing, existing tools skip it or fill garbage. None ASK the user.
5. **No autonomy.** Chrome Autofill fills fields but can't click "Next", can't scroll to find the submit button, can't handle CAPTCHAs.

### What FormPilot Does That Nobody Else Does

| Capability                               | How                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Visual Form Understanding**            | Gemini Vision analyzes screenshot → identifies ALL fields including unlabeled/visual-only ones |
| **Autonomous Actions**                   | Gemini Computer Use clicks, types, scrolls, selects dropdowns, navigates pages                 |
| **Voice-First Interaction**              | ADK Bidi-streaming with Gemini Live API for natural voice conversation                         |
| **Conversational Missing-Data Handling** | AI asks user via voice when info is missing mid-fill                                           |
| **Multi-Page Wizard Navigation**         | AI clicks "Next", handles page transitions, continues filling across pages                     |
| **Self-Verification**                    | After filling, AI screenshots the result and verifies every field is correct                   |

---

## 3. What Makes FormPilot Impossible To Copy Easily

You asked: _"many can build the same project for the hackathon."_ Let me show you how to build technical moats that make yours the BEST even if others try the same idea.

### Moat 1: Multi-Agent Architecture (Not Just One Agent)

**What others will do:** Single agent that tries to do everything.
**What you'll do:** Multi-agent system with specialized agents.

```
┌──────────────────────────────────────────────────────────┐
│                FORMPILOT MULTI-AGENT SYSTEM               │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           ORCHESTRATOR AGENT (Root)                  │ │
│  │  • Receives user voice input                        │ │
│  │  • Decides which specialist to delegate to           │ │
│  │  • Manages conversation state                       │ │
│  │  • Synthesizes results from sub-agents              │ │
│  └──┬──────────────┬──────────────┬────────────────────┘ │
│     │              │              │                       │
│  ┌──▼───────────┐ ┌▼────────────┐ ┌▼────────────────────┐│
│  │ FormAnalyzer │ │ FormFiller  │ │ DataResolver        ││
│  │ Agent        │ │ Agent       │ │ Agent               ││
│  │              │ │             │ │                     ││
│  │ • Screenshot │ │ • Computer  │ │ • Matches user      ││
│  │   analysis   │ │   Use API   │ │   profile to fields ││
│  │ • Field      │ │ • click_at  │ │ • Handles date      ││
│  │   detection  │ │ • type_text │ │   format conversion ││
│  │ • Field type │ │ • scroll    │ │ • Generates answers  ││
│  │   inference  │ │ • navigate  │ │   for open questions ││
│  │   (text,     │ │ • Uses DOM  │ │ • Asks user for     ││
│  │   dropdown,  │ │   as fast   │ │   missing data       ││
│  │   date, file)│ │   fallback  │ │   via voice          ││
│  │ • Returns    │ │             │ │                     ││
│  │   structured │ │             │ │                     ││
│  │   field map  │ │             │ │                     ││
│  └──────────────┘ └─────────────┘ └─────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Why this is hard to copy:**

- ADK multi-agent with `sub_agents` requires understanding ADK's agent hierarchy, delegation, and context passing
- Most hackathon participants will build a single monolithic agent
- Multi-agent scores MUCH higher on "Agent Architecture" (30% criterion)

### Moat 2: Dual-Engine Form Interaction (Vision + DOM)

**What others will do:** Use EITHER screenshots OR DOM parsing.
**What you'll do:** Both, with intelligent fallback.

```python
# Dual-Engine Strategy
async def fill_form(page_url):
    # ENGINE 1: DOM analysis (fast, for known patterns)
    dom_fields = await extract_dom_fields()  # CSS selectors, labels, input types

    if dom_fields.confidence > 0.8:
        # DOM gave us clear field mapping → use direct DOM manipulation (instant)
        await fill_via_dom(dom_fields)
    else:
        # ENGINE 2: Vision analysis (smart, for complex/unknown forms)
        screenshot = await capture_screenshot()
        vision_fields = await gemini_analyze_form(screenshot)
        # Use Computer Use to click + type at visual coordinates
        await fill_via_computer_use(vision_fields)

    # ALWAYS: Visual verification (take screenshot, verify all fields are filled)
    verification = await verify_filled_form()
    if verification.issues:
        await fix_issues(verification.issues)
```

**Why this matters for judges:**

- Line 210 of hackathon rules: _"Robustness: Does the agent avoid hallucinations? Is there evidence of grounding?"_
- DOM data = ground truth = zero hallucination on field labels
- Vision = handles forms that DOM can't parse (scanned PDFs, image-based CAPTCHAs info)
- Double-engine = robustness judges will love

### Moat 3: Self-Verification Loop

**What others won't do:** Verify the form after filling.
**What you'll do:** Screenshot → AI checks every field → corrects errors.

```
Fill Form → Screenshot → Gemini Vision Verification
                              │
                    ┌─────────┴─────────┐
                    │                   │
              All correct?          Issues found
                    │                   │
              ✅ "Done! All 12     🔄 "I noticed the
              fields are filled     date format is wrong
              correctly."           in field 3. Fixing..."
                                        │
                                    Fix → Re-verify
```

**Why this is a killer feature for the demo:**

- The AI says: _"Let me verify everything... Done. All 12 fields are correctly filled. The date of birth is in DD/MM/YYYY format as required. Would you like me to submit?"_
- This PROVES robustness to judges. They can see the AI double-checking itself.

### Moat 4: Voice-Driven Data Resolution

**What others won't do:** Talk to the user when data is missing.
**What you'll do:** Natural voice conversation mid-fill.

```
AI filling a passport form...

AI: "I've filled your name, date of birth, and address.
     This form asks for your mother's maiden name.
     I don't have that in your profile. What is it?"

User: "Sharma"

AI: "Got it. Mother's maiden name: Sharma.
     Next field is 'Emergency Contact Number.'
     Should I use your father's number?"

User: "No, use my wife's number."

AI: "Using your wife's number: +91 98765 43210.
     All fields on page 1 are done. Moving to page 2."
```

**This is the "Live" factor.** The AI doesn't just fill — it CONVERSES. This is what the hackathon means by "natural, interruptible conversation" and scores on "Fluidity" (40% weight).

---

## 4. Multi-Agent Architecture (Production Grade)

### ADK Agent Definitions

```python
from google.adk import Agent

# Sub-Agent 1: FormAnalyzer
form_analyzer = Agent(
    model="gemini-2.5-flash",
    name="FormAnalyzer",
    instruction="""You are a form analysis specialist. When given a screenshot
    of a web form, you identify ALL form fields and return structured data.

    For each field, identify:
    1. field_label: The label text (or inferred purpose if unlabeled)
    2. field_type: text, email, phone, date, dropdown, checkbox, radio, textarea, file
    3. is_required: boolean
    4. position: approximate position on screen (top-left, center, etc.)
    5. current_value: if already filled, what's in it
    6. options: for dropdowns/radio, list all visible options

    Return as JSON array. Be precise — missed fields mean incomplete forms.""",
    tools=[analyze_screenshot, get_dom_fields],
)

# Sub-Agent 2: DataResolver
data_resolver = Agent(
    model="gemini-2.5-flash",
    name="DataResolver",
    instruction="""You resolve form field values from the user's profile data.

    Given a list of form fields and a user profile, you:
    1. Map each field to the correct profile value
    2. Convert formats (e.g., date to DD/MM/YYYY if needed)
    3. For fields not in profile, flag them as 'needs_user_input'
    4. For open-ended fields (e.g., 'Why do you want this?'), generate
       a contextual response or ask the user

    NEVER make up personal data. If it's not in the profile, ASK.""",
    tools=[get_user_profile, ask_user_voice, format_date, generate_answer],
)

# Sub-Agent 3: FormFiller
form_filler = Agent(
    model="gemini-2.5-flash",
    name="FormFiller",
    instruction="""You execute form-filling actions on the webpage.

    Given a field map with values, you:
    1. For text/email/phone fields: click the field, clear it, type the value
    2. For dropdowns: click to open, find the matching option, click it
    3. For date pickers: handle calendar widgets or type formatted date
    4. For checkboxes/radio: click the correct option
    5. For file uploads: click the file input (cannot actually upload files)
    6. For multi-page forms: click 'Next'/'Continue'/'Submit' buttons

    After filling each field, verify it was entered correctly.
    Prefer DOM-based filling (faster) when selectors are available.
    Fall back to Computer Use click_at/type_text_at for complex widgets.""",
    tools=[
        click_element, type_in_field, select_dropdown_option,
        click_at_coordinates, type_at_coordinates, scroll_page,
        click_next_button, capture_screenshot,
    ],
)

# ROOT AGENT: Orchestrator
formpilot = Agent(
    model="gemini-2.5-flash",
    name="FormPilot",
    instruction="""You are FormPilot, a voice-controlled AI assistant that fills
    web forms autonomously. You are the user's hands on screen.

    WORKFLOW:
    1. When the user asks you to fill a form, first screenshot the page
    2. Send to FormAnalyzer to identify all fields
    3. Send field list to DataResolver to get values from user profile
    4. For any missing values, ask the user via voice
    5. Send the complete field-value map to FormFiller to execute
    6. After all fields are filled, take a verification screenshot
    7. Report results to user in voice: what was filled, what to review

    RULES:
    - Keep voice responses SHORT and clear
    - Always confirm before clicking 'Submit'
    - If the form has multiple pages, announce page transitions
    - If unsure about a field, ASK the user
    - NEVER make up personal information

    PERSONA:
    - Friendly, efficient, professional
    - Like a helpful assistant who handles paperwork for you
    - Use simple language, avoid jargon""",
    sub_agents=[form_analyzer, data_resolver, form_filler],
)
```

### Architecture Diagram (For Submission)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER (Voice + Browser)                        │
│  🎤 Microphone Audio → MediaRecorder API → Base64 Audio Chunks     │
│  🖥️ Browser Tab → chrome.tabs.captureVisibleTab() → Screenshot     │
└────────────────┬───────────────────────────────────┬────────────────┘
                 │ WebSocket (Audio + Screenshots)   │
                 │                                   │
┌────────────────▼───────────────────────────────────▼────────────────┐
│              CHROME EXTENSION (Manifest V3)                          │
│                                                                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Side Panel UI   │  │  Content Script  │  │  Background SW   │   │
│  │  • Status        │  │  • Screenshot    │  │  • WebSocket     │   │
│  │  • Profile mgmt  │  │  • DOM read      │  │    connection    │   │
│  │  • Field log     │  │  • Click/Type    │  │  • Audio routing │   │
│  │  • Voice viz     │  │  • Scroll        │  │  • Message bus   │   │
│  └─────────────────┘  └──────────────────┘  └───────┬──────────┘   │
│                                                      │              │
└──────────────────────────────────────────────────────┼──────────────┘
                                                       │
                                           WebSocket (wss://)
                                                       │
┌──────────────────────────────────────────────────────▼──────────────┐
│                    GOOGLE CLOUD RUN                                   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  FastAPI Server (uvicorn)                                      │  │
│  │                                                                │  │
│  │  /ws → WebSocket endpoint                                     │  │
│  │      → ADK Bidi-Streaming Runner                              │  │
│  │      → Handles audio in/out + tool calls                      │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  ADK MULTI-AGENT SYSTEM                                  │  │  │
│  │  │                                                          │  │  │
│  │  │  FormPilot (Orchestrator)                                │  │  │
│  │  │     ├── FormAnalyzer Agent                               │  │  │
│  │  │     │     └── Tools: analyze_screenshot, get_dom_fields  │  │  │
│  │  │     ├── DataResolver Agent                               │  │  │
│  │  │     │     └── Tools: get_profile, ask_user, format_date  │  │  │
│  │  │     └── FormFiller Agent                                 │  │  │
│  │  │           └── Tools: click, type, scroll, select, next   │  │  │
│  │  │                                                          │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Secret Mgr   │  │ Cloud Log    │  │ Ephemeral Tokens         │  │
│  │ (API keys)   │  │ (debugging)  │  │ (Gemini auth)            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │   GEMINI MODELS          │
              │                          │
              │  • gemini-2.5-flash      │
              │    (agent reasoning +    │
              │     voice + vision)      │
              │                          │
              │  • Computer Use model    │
              │    (click_at,            │
              │     type_text_at,        │
              │     scroll_at, etc.)     │
              │    Used when DOM         │
              │    interaction fails     │
              └──────────────────────────┘
```

---

## 5. User Experience Design: Voice-First UX Best Practices

### The Golden Rules of Voice UX (From Research)

| Rule                                               | Implementation in FormPilot                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Progressive disclosure** — reveal info gradually | "I see 15 fields. Starting with your personal info. Name... done. Address... done." |
| **Confirm, don't assume**                          | "I'll use your home address at 123 ABC Colony. Is that correct?"                    |
| **Keep responses under 15 seconds**                | Short voice feedback: "Filled. Next field." Not long narrations.                    |
| **Provide audio cues**                             | Subtle sound effects: _ding_ when a field is filled, _chime_ when page is done      |
| **Allow barge-in**                                 | User can interrupt: "Wait, use my office address instead"                           |
| **Indicate listening state**                       | Visual pulsing mic icon in side panel when AI is listening                          |
| **Error recovery**                                 | "I couldn't click the dropdown. Let me try scrolling to it first."                  |
| **Context awareness**                              | Remember user corrections: "You said office address — I'll use that for the rest."  |

### Side Panel UI Design

```
┌─────────────────────────────────┐
│  🤖 FormPilot                    │
│  ─────────────────────────────  │
│                                  │
│  ● Listening...                  │
│  ◉ [animated waveform]          │
│                                  │
│  ─────────────────────────────  │
│  📋 Current Form                │
│  ─────────────────────────────  │
│                                  │
│  ✅ Full Name: Alok Dangre       │
│  ✅ Email: alok@example.com      │
│  ✅ Phone: +91 98765 43210       │
│  🔄 Date of Birth: Filling...   │
│  ⬜ Address Line 1               │
│  ⬜ City                         │
│  ⬜ State (dropdown)             │
│  ⬜ Emergency Contact            │
│                                  │
│  Progress: ████████░░ 5/8        │
│                                  │
│  ─────────────────────────────  │
│  👤 Profile                     │
│  [Edit Profile] [Import Resume] │
│                                  │
│  ─────────────────────────────  │
│  📌 "Say 'Hey FormPilot' or     │
│      click the mic to start"    │
│                                  │
└─────────────────────────────────┘
```

### The "Show, Don't Just Tell" Principle

As the AI fills each field, the side panel updates in real-time. The user SEES a checklist progressing, hears brief voice confirmations, and watches the AI click and type on the actual form. This triple-feedback (visual panel + voice + on-screen action) is the premium experience that wins.

---

## 6. Technical Stack (Every Piece)

### Mandatory Tech (Per Hackathon Rules)

| Requirement             | Your Solution                                                    |
| ----------------------- | ---------------------------------------------------------------- |
| ✅ Gemini model         | `gemini-2.5-flash` for agents, Computer Use model for UI actions |
| ✅ GenAI SDK or ADK     | ADK (Agent Development Kit) with multi-agent sub_agents          |
| ✅ Google Cloud service | Cloud Run (hosting), Secret Manager (API keys), Cloud Logging    |

### Full Stack

| Layer                 | Technology                                | Purpose                                                   |
| --------------------- | ----------------------------------------- | --------------------------------------------------------- |
| **Frontend**          | Chrome Extension (Manifest V3)            | Side panel UI, content scripts, background service worker |
| **Audio Capture**     | Web Audio API + MediaRecorder             | Capture mic → encode as base64 audio chunks               |
| **Screenshot**        | `chrome.tabs.captureVisibleTab()`         | Capture visible tab as PNG for Gemini Vision              |
| **DOM Interaction**   | Content Script + `document.querySelector` | Fast field identification and direct DOM filling          |
| **Communication**     | WebSocket (Background SW ↔ Cloud Run)     | Bidi-streaming for audio + data                           |
| **Backend Framework** | FastAPI (Python)                          | WebSocket endpoint, serves ADK agents                     |
| **Agent Framework**   | Google ADK                                | Multi-agent orchestration, tool calling, bidi-streaming   |
| **AI Models**         | Gemini 2.5 Flash + Computer Use           | Reasoning, vision, and UI automation                      |
| **Voice**             | Gemini Live API (native audio)            | Speech-to-text + text-to-speech natively                  |
| **Cloud**             | Google Cloud Run                          | Containerized backend deployment                          |
| **Security**          | Secret Manager + Ephemeral Tokens         | API key management, secure Gemini auth                    |
| **CI/CD**             | Dockerfile + `gcloud run deploy`          | Automated deployment (bonus points!)                      |

---

## 7. The Agent Loop: How It Actually Works

### Step-by-Step Flow

```
1. User opens a form page in Chrome (e.g., passport application)
2. User clicks FormPilot icon or says "Hey FormPilot"
3. Extension captures screenshot + DOM structure
4. Background SW sends screenshot + audio over WebSocket to Cloud Run

5. Cloud Run → ADK Orchestrator receives the screenshot
6. Orchestrator delegates to FormAnalyzer:
   a. FormAnalyzer analyzes screenshot with Gemini Vision →
      Returns: [{field: "Full Name", type: "text", position: "top-left"},
                {field: "DOB", type: "date", position: "center"},
                {field: "State", type: "dropdown", options: ["MH","KA",...]}]

7. Orchestrator delegates to DataResolver:
   a. DataResolver matches fields to user profile →
      Returns: [{field: "Full Name", value: "Alok Dangre", source: "profile"},
                {field: "DOB", value: "15/05/1999", source: "profile"},
                {field: "Mother's Name", value: null, source: "ask_user"}]
   b. For missing fields → triggers voice question via ADK:
      "What is your mother's maiden name?"
   c. User responds via voice → DataResolver receives answer

8. Orchestrator delegates to FormFiller:
   a. FormFiller receives field-value pairs
   b. For each field:
      - TRY DOM first: querySelector + .value = data (instant, <10ms)
      - IF DOM fails: Use Computer Use click_at(x,y) + type_text_at()
   c. For dropdowns: click to open → screenshot → find option → click
   d. After all fields: click "Next" if multi-page

9. After filling, Orchestrator:
   a. Takes verification screenshot
   b. Gemini Vision compares filled values vs intended values
   c. Reports to user: "All 12 fields filled correctly.
      Review the form and say 'Submit' when ready."

10. User says "Submit" → FormFiller clicks submit button
    Or: "Wait, change the address" → DataResolver + FormFiller re-do field
```

---

## 8. Tool Definitions (Complete)

```python
from google.adk.tools import FunctionTool

# ═══════════════════════════════════════════
# FORM ANALYZER TOOLS
# ═══════════════════════════════════════════

def analyze_screenshot(screenshot_base64: str) -> dict:
    """Analyze a screenshot of a web form to identify all form fields.

    Args:
        screenshot_base64: Base64-encoded screenshot image of the form page

    Returns:
        Dictionary with detected fields, their types, labels, positions,
        and whether they're required. Also includes page metadata.
    """
    # Sends to Gemini Vision with structured output schema
    pass

def get_dom_fields() -> dict:
    """Extract form fields from the page DOM via content script.

    Returns:
        Dictionary of form fields found via CSS selectors, including
        input names, labels, types, current values, and bounding boxes.
    """
    # Sends message to content script → returns DOM analysis
    pass

# ═══════════════════════════════════════════
# DATA RESOLVER TOOLS
# ═══════════════════════════════════════════

def get_user_profile() -> dict:
    """Retrieve the user's stored profile data.

    Returns:
        User profile including name, email, phone, address, education,
        work experience, and other personal details.
    """
    pass

def ask_user_voice(question: str) -> str:
    """Ask the user a question via voice and wait for their response.

    Args:
        question: The question to ask the user

    Returns:
        The user's spoken response as text
    """
    # Uses ADK bidi-streaming to speak + listen
    pass

def format_date(date_string: str, target_format: str) -> str:
    """Convert a date to the required format.

    Args:
        date_string: Input date (e.g., "1999-05-15")
        target_format: Required format (e.g., "DD/MM/YYYY", "MM-DD-YYYY")

    Returns:
        Formatted date string
    """
    pass

def generate_contextual_answer(question: str, context: str) -> str:
    """Generate an appropriate answer for an open-ended form field.

    Args:
        question: The form field question (e.g., "Why do you want this visa?")
        context: Context about what form this is and user's details

    Returns:
        A contextually appropriate answer. Always confirms with user first.
    """
    pass

# ═══════════════════════════════════════════
# FORM FILLER TOOLS
# ═══════════════════════════════════════════

def click_element(selector: str) -> dict:
    """Click a DOM element using CSS selector (fast, DOM-based).

    Args:
        selector: CSS selector of the element to click
    """
    pass

def type_in_field(selector: str, text: str, clear_first: bool = True) -> dict:
    """Type text into a form field using CSS selector (fast, DOM-based).

    Args:
        selector: CSS selector of the input field
        text: Text to type
        clear_first: Whether to clear the field before typing
    """
    pass

def select_dropdown_option(selector: str, option_text: str) -> dict:
    """Select an option from a dropdown/select element (DOM-based).

    Args:
        selector: CSS selector of the <select> element
        option_text: Text of the option to select
    """
    pass

def click_at_coordinates(x: int, y: int) -> dict:
    """Click at specific screen coordinates (Computer Use fallback).

    Args:
        x: X coordinate
        y: Y coordinate
    """
    pass

def type_at_coordinates(x: int, y: int, text: str, press_enter: bool = False) -> dict:
    """Type text at specific screen coordinates (Computer Use fallback).

    Args:
        x: X coordinate
        y: Y coordinate
        text: Text to type
        press_enter: Whether to press Enter after typing
    """
    pass

def scroll_page(direction: str = "down", amount: int = 300) -> dict:
    """Scroll the page.

    Args:
        direction: 'up' or 'down'
        amount: Pixels to scroll
    """
    pass

def click_next_button() -> dict:
    """Find and click the 'Next', 'Continue', or 'Proceed' button.

    Searches DOM for common next-page buttons, then falls back
    to Computer Use visual identification.
    """
    pass

def capture_screenshot() -> str:
    """Capture a screenshot of the current visible tab.

    Returns:
        Base64-encoded PNG screenshot
    """
    pass

def verify_filled_form(expected_values: dict, screenshot_base64: str) -> dict:
    """Verify that all form fields were filled correctly.

    Args:
        expected_values: Dictionary of field names to expected values
        screenshot_base64: Screenshot of the filled form

    Returns:
        Verification result with any mismatches or issues found.
    """
    pass
```

---

## 9. Hackathon Scoring Optimization

### Judging Criteria → How FormPilot Scores

#### Innovation & Multimodal UX (40%) — THE BIGGEST WEIGHT

| Sub-criterion            | FormPilot's Score | How                                                                |
| ------------------------ | ----------------- | ------------------------------------------------------------------ |
| "Beyond Text" Factor     | ⭐⭐⭐⭐⭐        | Voice in, visual actions out, no text typing at all                |
| UI Navigator Execution   | ⭐⭐⭐⭐⭐        | AI demonstrates visual precision: identifies EXACT field locations |
| Fluidity / "Live" Factor | ⭐⭐⭐⭐⭐        | Real-time voice conversation + real-time form filling. Truly live. |

#### Technical Implementation & Agent Architecture (30%)

| Sub-criterion                   | FormPilot's Score | How                                                                           |
| ------------------------------- | ----------------- | ----------------------------------------------------------------------------- |
| Google Cloud Native             | ⭐⭐⭐⭐⭐        | ADK + Cloud Run + Secret Manager + Cloud Logging                              |
| System Design                   | ⭐⭐⭐⭐⭐        | Multi-agent with Orchestrator → 3 specialists. Error handling in every tool.  |
| Robustness / Anti-hallucination | ⭐⭐⭐⭐⭐        | User's own data (zero hallucination) + DOM ground truth + visual verification |

#### Demo & Presentation (30%)

| Sub-criterion           | FormPilot's Score | How                                                                  |
| ----------------------- | ----------------- | -------------------------------------------------------------------- |
| Story / Problem Clarity | ⭐⭐⭐⭐⭐        | "700M people can't fill forms they can't see. Everyone hates forms." |
| Architecture Proof      | ⭐⭐⭐⭐⭐        | Multi-agent diagram + Cloud Run console screenshot                   |
| "Live" Factor           | ⭐⭐⭐⭐⭐        | Live voice → AI fills form → verification → all on camera            |

### Bonus Points (Up to +1.0)

| Bonus                | Points | How                                                                                           |
| -------------------- | ------ | --------------------------------------------------------------------------------------------- |
| Blog post            | +0.6   | Write a dev.to post about building with ADK + Computer Use                                    |
| Automated deployment | +0.2   | Dockerfile + `deploy.sh` with `gcloud run deploy` in repo                                     |
| GDG Membership       | +0.2   | Sign up at [developers.google.com/community/gdg](https://developers.google.com/community/gdg) |

> [!TIP]
> **Total possible: 6.0.** The base max is 5.0 + up to 1.0 bonus. Writing the blog post alone gives you +0.6 — that's a MASSIVE advantage. Most participants won't bother.

---

## 10. Final Criticism: What Can STILL Kill This Project

### Risk #1: Gemini Computer Use Latency (CRITICAL)

**The problem:** Each Computer Use action (screenshot → Gemini → action) takes **2-5 seconds**. A form with 15 fields = **30-75 seconds** of waiting.

**The mitigation:**

- Use DOM-based filling for 80% of fields (instant)
- Only use Computer Use for complex widgets (dropdowns, date pickers)
- In the demo, show a mix: some instant (DOM), some visual (Computer Use)
- Pre-warm the model by sending the first screenshot early

**Residual risk:** 🟡 MEDIUM — manageable with the hybrid approach

### Risk #2: Complex Widgets (Date Pickers, Custom Dropdowns)

**The problem:** Modern UI components (Material UI date pickers, React Select dropdowns) are notoriously hard to automate.

**The mitigation:**

- DOM-first: Try `element.value = "2025-05-15"` + dispatch `change` event
- If DOM fails: Computer Use visual approach (click, find, select)
- For demo: test on 2-3 specific forms where you KNOW the widgets work

**Residual risk:** 🟡 MEDIUM — pick demo forms carefully

### Risk #3: Someone Builds the Same Thing

**The problem:** You're worried other participants build a similar form filler.

**What makes yours BETTER:**
| Your Advantage | Why Others Won't Have It |
|---------------|------------------------|
| Multi-agent architecture | Most will use a single agent |
| Dual-engine (DOM + Vision) | Most will use only one |
| Self-verification loop | Nobody will think of this |
| Voice conversation for missing data | Others will just skip empty fields |
| Accessibility pitch | Most will pitch "productivity" |
| Blog post + automated deploy | Free +0.8 bonus points |

**Residual risk:** 🟢 LOW — your depth makes you the best version

### Risk #4: Audio/WebSocket Issues on Cloud Run

**The problem:** Cloud Run has request timeouts and WebSocket support can be tricky.

**The mitigation:**

- Cloud Run supports WebSockets natively (set `--session-affinity`)
- Set `--timeout=300` for long-running sessions
- Test WebSocket connectivity early (Day 3-4)

**Residual risk:** 🟢 LOW — well-documented, solvable

### Risk #5: Scope Creep (YOUR BIGGEST ENEMY)

**The problem:** You want to make it "the best from all" which can lead to overbuilding.

> [!CAUTION]
> **The #1 reason hackathon projects fail is building too much and demoing too little.**
>
> Here's what you MUST NOT build:
>
> - ❌ File upload support (too complex for 16 days)
> - ❌ CAPTCHA solving (ethically problematic, unreliable)
> - ❌ Multi-language form support (English-only for demo)
> - ❌ Resume PDF parsing (just use a JSON profile)
> - ❌ User authentication / login system (unnecessary for hackathon)
>
> Here's what you MUST build:
>
> - ✅ Voice input → AI fills form (core flow)
> - ✅ Screenshot-based form analysis
> - ✅ DOM-based field filling (fast path)
> - ✅ Multi-page "Next" button navigation
> - ✅ Voice conversation for missing data
> - ✅ Verification screenshot
> - ✅ Side panel UI with progress
> - ✅ Cloud Run deployment

---

## 11. Implementation Timeline (16 Days)

### Week 1: Foundation (Mar 1-7)

| Day               | Task                                                                        | Deliverable                                                |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Day 1** (Mar 1) | Setup project: Chrome extension skeleton, FastAPI backend, ADK dependencies | Working extension + backend that communicate via WebSocket |
| **Day 2** (Mar 2) | Audio capture in extension + ADK Bidi-streaming setup                       | User speaks → audio reaches Cloud Run → Gemini hears it    |
| **Day 3** (Mar 3) | Screenshot capture + Gemini Vision form analysis                            | Screenshot → Gemini → JSON field list                      |
| **Day 4** (Mar 4) | User profile system + DataResolver agent                                    | Profile JSON → field matching                              |
| **Day 5** (Mar 5) | DOM-based form filling (content script)                                     | Fields get filled via DOM manipulation                     |
| **Day 6** (Mar 6) | Computer Use integration for dropdowns/complex widgets                      | AI clicks dropdowns visually                               |
| **Day 7** (Mar 7) | Multi-page navigation (click "Next")                                        | AI handles 2-page forms                                    |

### Week 2: Polish & Demo (Mar 8-14)

| Day                 | Task                                         | Deliverable                                   |
| ------------------- | -------------------------------------------- | --------------------------------------------- |
| **Day 8** (Mar 8)   | Voice conversation for missing data          | AI asks + user responds                       |
| **Day 9** (Mar 9)   | Self-verification loop                       | AI screenshots filled form + reports accuracy |
| **Day 10** (Mar 10) | Side panel UI (progress, field list, status) | Beautiful side panel                          |
| **Day 11** (Mar 11) | Cloud Run deployment + Secret Manager        | Backend live on GCP                           |
| **Day 12** (Mar 12) | End-to-end testing on 3 real forms           | All flows work reliably                       |
| **Day 13** (Mar 13) | Write demo script + practice                 | 3-min demo script ready                       |
| **Day 14** (Mar 14) | FILM THE DEMO VIDEO                          | 4-min video uploaded to YouTube               |

### Final Days (Mar 15-16)

| Day                 | Task                                                     | Deliverable                    |
| ------------------- | -------------------------------------------------------- | ------------------------------ |
| **Day 15** (Mar 15) | Write blog post (dev.to) + README + architecture diagram | All submission materials ready |
| **Day 16** (Mar 16) | Submit on Devpost. Final checks.                         | SUBMITTED ✅                   |

---

## 12. Links & Resources

### Official Documentation

- [ADK Quick Start](https://google.github.io/adk-docs/get-started/quickstart/) — Setting up your first ADK agent
- [ADK Multi-Agent Systems](https://google.github.io/adk-docs/agents/multi-agents/) — Sub-agents, delegation patterns
- [ADK Streaming Guide](https://google.github.io/adk-docs/streaming/) — Bidi-streaming for live voice
- [ADK Tools Documentation](https://google.github.io/adk-docs/tools/) — Defining custom function tools
- [Gemini Live API](https://ai.google.dev/gemini-api/docs/live) — Real-time voice + vision
- [Gemini Computer Use](https://ai.google.dev/gemini-api/docs/computer-use) — Screenshot-based UI automation
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) — Force JSON responses
- [Gemini Grounding with Search](https://ai.google.dev/gemini-api/docs/grounding) — Grounded responses with citations

### Chrome Extension Development

- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [chrome.tabs.captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)
- [Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

### Code Examples

- [ADK Bidi Demo](https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo) — Reference ADK streaming implementation
- [Computer Use Reference Implementation](https://github.com/google/computer-use-preview) — Playwright-based agent loop
- [Gemini Cookbook](https://github.com/google-gemini/cookbook) — Notebooks for all Gemini features

### Deployment

- [Cloud Run Quickstart](https://cloud.google.com/run/docs/quickstarts) — Deploy container to Cloud Run
- [Cloud Run WebSocket Support](https://cloud.google.com/run/docs/triggering/websockets) — WebSocket configuration
- [Secret Manager](https://cloud.google.com/secret-manager/docs) — Secure API key storage

### Hackathon

- [Contest Page](https://geminiliveagentchallenge.devpost.com/) — Submission portal
- [Google Cloud Credits Form](https://forms.gle/rKNPXA1o6XADvQGb7) — Request $100 credits (by Mar 13)
- [GDG Signup](https://developers.google.com/community/gdg) — For +0.2 bonus points

---

> [!IMPORTANT]
>
> ## The One-Sentence Pitch
>
> **"FormPilot is a voice-controlled AI agent that sees any web form, understands every field, fills it accurately using your data, and asks you when it's unsure — making the inaccessible web accessible to everyone."**
>
> Now go build it. 🚀

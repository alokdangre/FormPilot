# FormPilot: Comprehensive Resource & Documentation Links

This document aggregates all the official documentation, references, and additional researched blogs needed to successfully build the FormPilot AI Agent Chrome Extension based on your final plan.

## 1. Google ADK (Agent Development Kit)

- **[ADK Quick Start](https://google.github.io/adk-docs/get-started/quickstart/)** — Setting up your first ADK agent
- **[ADK Multi-Agent Systems](https://google.github.io/adk-docs/agents/multi-agents/)** — Sub-agents, delegation patterns
- **[ADK Streaming Guide](https://google.github.io/adk-docs/streaming/)** — Bidi-streaming for live voice
- **[ADK Tools Documentation](https://google.github.io/adk-docs/tools/)** — Defining custom function tools
- **[ADK Custom Function Tools](https://google.github.io/adk-docs/tools/function-tools/)**
- **[ADK Bidi-Streaming Quickstart](https://google.github.io/adk-docs/get-started/streaming/quickstart-streaming/)**
- **[ADK Streaming Dev Guide Part 1-5](https://google.github.io/adk-docs/streaming/dev-guide/part1/)**
- **[ADK Deploy to Cloud Run](https://google.github.io/adk-docs/deploy/cloud-run/)**
- **[ADK Bidi-Demo (Production Reference)](https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo)**
- **[ADK Visual Guide (Medium Blog)](https://medium.com/google-cloud/adk-bidi-streaming-a-visual-guide-to-real-time-multimodal-ai-agent-development-62dd08c81399)**

## 2. Gemini API & AI Studio

- **[Gemini Live API](https://ai.google.dev/gemini-api/docs/live)** — Real-time voice + vision
- **[Gemini Computer Use](https://ai.google.dev/gemini-api/docs/computer-use)** — Screenshot-based UI automation
- **[Computer Use Reference Implementation](https://github.com/google/computer-use-preview)** — Playwright-based agent loop
- **[Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output)** — Force JSON responses
- **[Gemini Grounding with Search](https://ai.google.dev/gemini-api/docs/grounding)** — Grounded responses with citations
- **[Grounding Cookbook Notebook](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Search_Grounding.ipynb)**
- **[Gemini Cookbook](https://github.com/google-gemini/cookbook)** — Notebooks for all Gemini features
- **[Ephemeral Tokens for Client Security](https://ai.google.dev/gemini-api/docs/ephemeral-tokens)** - For secure authentication.
- **[Google AI Studio API Key](https://aistudio.google.com/apikey)**

## 3. Chrome Extension Development (Manifest V3)

- **[Manifest V3 Guide](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)**
- **[chrome.tabs.captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)**
- **[Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)**
- **[Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)**
- **[MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)** - For capturing voice audio locally before sending context buffers.

## 4. Google Cloud Platform (Backend & Hosting)

- **[Cloud Run Quickstart](https://cloud.google.com/run/docs/quickstarts)** — Deploy container to Cloud Run
- **[Cloud Run WebSocket Support](https://cloud.google.com/run/docs/triggering/websockets)** — WebSocket configuration
- **[Secret Manager](https://cloud.google.com/secret-manager/docs)** — Secure API key storage
- **[Google Cloud Free Trial](https://cloud.google.com/free)**
- **[Google Cloud Acceptable Use Policy](https://cloud.google.com/terms/aup)**

## 5. Hackathon Submission & Logistics

- **[Contest Page (Devpost)](https://geminiliveagentchallenge.devpost.com/)**
- **[Google Cloud Credits Form](https://forms.gle/rKNPXA1o6XADvQGb7)** (Closes March 13)
- **[Google Developer Groups (GDG) Signup](https://developers.google.com/community/gdg)** (For +0.2 bonus points)

## 6. Additional Researched Articles & Technical Blogs (FormPilot Implementation Context)

To safely implement the "Dual-Engine Strategy" (DOM + Vision) and avoid common AI agent pitfalls specifically evaluated in this Hackathon, study these technical write-ups:

- **[Tutorial: Building FastAPI with WebSockets](https://betterstack.com/community/guides/scaling-python/fastapi-websockets/)** - Crucial reading on establishing bidirectional connections natively between your Chrome Extension's Web Worker component and your Python Cloud Run backend.
- **[Stack AI: Form Filling Pipeline Integrations](https://www.stack-ai.com/)** - Reference on how to build logic engines that interpret unstructured internal profile knowledge bases (or user profiles) and intelligently pipe them into targeted HTML forms using LLM processing.
- **[Understanding ChatGPT Operator & Modern Web Navigators](https://openai.com/index/introducing-operator/)** - Although an OpenAI article, the fundamental UX/UI behavior of autonomous browser navigation—which you are replicating cleanly via the Gemini Computer Use paradigm in form filling—is explored deeply here.
- **[BrowserBase AI Auto-Form Completion Engineering](https://www.browserbase.com/)** - Great examples of using structured schemas to process unpredictable web dropdown values. Helpful when formulating Gemini's `structured_output` schema for unpredictable layouts.

## Implementation Workflow Note

Keep the **[ADK Bidi-Demo App Repository](https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo)** open in one tab while building the WebSocket relay. It contains the exact logic for unpacking base64 audio chunks sent via Chrome WebSockets, and channeling them cleanly into the Gemini Live API session seamlessly.

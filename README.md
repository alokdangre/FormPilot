# FormPilot 🧠✈️

**Voice-controlled AI that dynamically fills any complex web form for you.**

[![Built for Gemini Live Agent Challenge](https://img.shields.io/badge/Hackathon-Gemini_Live_Agent_Challenge-89b4fa)](https://gemini-live-agent.devpost.com/)

FormPilot is an autonomous, multi-agent AI Chrome Extension powered by **Google ADK** and **Gemini 2.5 Flash**. Instead of relying on fragile CSS selectors to populate forms, it uses Gemini Vision to literally _see_ the screen like a human, maps the visuals to the DOM, and perfectly executes complex UI interactions—all hands-free.

### 🎥 [Watch the Devpost Pitch & Demo Here](YOUR_YOUTUBE_LINK)

---

## 🚀 Features

- **Dual-Engine Analysis:** Blends blazing-fast DOM extraction with Gemini Vision semantic understanding to tackle complex, aria-hidden React/Angular forms.
- **Agentic Hierarchy:** A central Orchestrator coordinates specialized sub-agents (`FormAnalyzer`, `DataResolver`, `FormFiller`).
- **Hands-Free Control:** Fully integrated with `MediaRecorder` and WebSocket Bidi-streaming for live interactions.
- **Graceful Fallbacks:** If a React input ignores standard DOM filling, FormPilot falls back to browser-level text injection (`execCommand`) and event simulations.

## 🛠️ Architecture

![Architecture Diagram](docs/architecture.png)

FormPilot runs as a two-piece architecture:

1.  **Chrome Extension (Frontend)**: Manifest V3 extension featuring a sleek, dark-mode side panel. It captures DOM states, screenshots, and audio buffers, proxying them to the backend via a Service Worker.
2.  **FastAPI + ADK Backend (Cloud Run)**: A Python WebSocket server hosting the Google ADK Orchestrator and sub-agents.

For a detailed visual breakdown, see [docs/architecture.md](docs/architecture.md).

## 💻 Local Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/yourusername/formpilot.git
   cd formpilot
   ```

2. **Start the Backend**

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt

   # Add your Gemini Key
   echo "GOOGLE_API_KEY=your_key" > .env

   uvicorn app.main:app --reload
   ```

3. **Load the Extension**
   - Open Chrome and navigate to `chrome://extensions`
   - Turn on **Developer mode**
   - Click **Load unpacked** and select the `/extension` directory in this repo.
   - Pin the extension and click it to open the Side Panel!

## ☁️ Deployment

FormPilot is designed for **Google Cloud Run**. An automated deployment script is provided:

```bash
./scripts/deploy.sh
```

---

_Created for the purposes of entering the #GeminiLiveAgentChallenge hackathon._

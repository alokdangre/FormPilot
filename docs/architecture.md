# FormPilot Architecture

FormPilot is designed explicitly to overcome the fragility of standard "DOM scraper" form fillers by augmenting them with a Semantic Vision Engine.

```mermaid
graph TD
    %% Define Chrome Extension Block
    subgraph "Chrome Browser (User)"
        A[Side Panel UI]
        B[Content Script]
        C[Service Worker]

        A -- "Extracts Audio (MediaRecorder)" --> C
        B -- "Extracts DOM Map" --> C
        C -- "Extracts Screenshot" --> C
    end

    %% Define Remote Backend Block
    subgraph "Cloud Run Backend (FastAPI)"
        D[WebSocket Endpoint]

        subgraph "Google ADK Multi-Agent System"
            E((Orchestrator Agent))
            F[FormAnalyzer Agent]
            G[DataResolver Agent]
            H[FormFiller Agent]

            E -->|Delegates Vision| F
            F -->|Labels & Types| E

            E -->|Delegates Mapping| G
            G -->|Resolved Profile Match| E

            E -->|Delegates Execution| H
            H -->|Generated Fill Commands| E
        end
    end

    %% Define External Services
    I((Gemini 2.5 Flash API))

    %% Connections
    C <==>|Bidi-streaming JSON payload| D
    D <==> E
    F <==>|Screenshot + Context| I
    E <==>|Voice Bidi-Stream| I
```

### Components:

1. **Side Panel**: Intercepts microphone events and displays visual UI updates.
2. **Service Worker**: Maintains a persistent WebSocket hook into Cloud Run.
3. **Orchestrator**: The root ADK Agent. It decides _which_ sub-agent should handle the incoming websocket payload.
4. **FormAnalyzer**: Receives the raw screenshot and the "dumb" DOM nodes. It calls Gemini Vision to generate "smart" human-readable labels, then links them.
5. **DataResolver**: Checks the user's stored profile (or triggers voice fallback if information is missing).
6. **FormFiller**: Generates the exact sequence of `dispatchEvent`, `.value` assignments, or `focus/click` commands that the Content Script needs to inject the data robustly.

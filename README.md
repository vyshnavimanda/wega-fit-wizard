# CORE Fit Wizard

> A multi-agent system that generates a personalized CORE deployment plan for any enterprise client — in under 60 seconds.

Built for the Wipro Junior Forward Deployed Engineer assignment. Addresses a real gap in the CORE deployment workflow: automated client environment assessment before an FDE engagement begins.

**Live demo:** https://core-fit-wizard-frontend.onrender.com
**API endpoint:** https://core-fit-wizard.onrender.com/health
**GitHub:** https://github.com/vyshnavimanda/core-fit-wizard

---

## What it does

Enter a client's environment (tech stack, cloud provider, compliance needs, deployment constraints, pain points). Five AI agents run in sequence and produce:

- **Compatibility matrix** — which client tools integrate natively with CORE, which need custom connectors, and what's a blocker
- **Ranked agent recommendations** — the 2–5 CORE agents most relevant to this client, ranked by ROI and effort
- **Risk registry** — compliance gaps, deployment constraints, and team readiness concerns rated High/Medium/Low
- **30/60/90-day roadmap** — phased deployment plan with actions, agents to activate, and success metrics per phase
- **Executive summary** — C-suite ready paragraph for the first client meeting

---

## Agent pipeline

```
Client Intake Form
        |
[Agent 1] Discovery Parser       →  structured JSON client profile
        |
[Agent 2] Stack Compatibility    →  native / custom connector / blocker matrix
        |              |
[Agent 3] Use Case     [Agent 4] Risk Flagger
  Matcher                        risk registry + severity
        |              |
        +------+-------+
               |
[Agent 5] Roadmap Orchestrator   →  30/60/90-day plan + exec summary
               |
[Conflict Detector]              →  cross-references Agent 3 vs Agent 4
```

Each agent has a strict system prompt confining it to one role. No agent can exceed its scope or reference data not confirmed by a previous agent.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 + FastAPI |
| LLM | Groq LLaMA 3.3 70B |
| Orchestration | LangChain LCEL |
| Vector DB | ChromaDB |
| Embeddings | Google Gemini embedding-001 |
| RAG Knowledge Base | 41 CORE docs (integrations, agents, compliance, constraints) |
| Streaming | Server-Sent Events (live agent trace) |
| Frontend | React 18 + TypeScript |
| Deployment | Render (backend + frontend) |

---

## Running locally

Prerequisites: Python 3.10+, Node 18+, Groq API key, Gemini API key

```bash
# Clone
git clone https://github.com/vyshnavimanda/core-fit-wizard.git
cd core-fit-wizard

# Backend
cd backend
cp .env.example .env
# Add your GROQ_API_KEY and GEMINI_API_KEY to .env
pip install -r requirements.txt
python main.py
# Runs at http://localhost:8000
# First run builds ChromaDB vector store (~30 seconds)

# Frontend (new terminal)
cd frontend
npm install
# Create .env.local with: REACT_APP_API_URL=http://localhost:8000
npm start
# Runs at http://localhost:3000
```

---

## Project structure

```
core-fit-wizard/
├── backend/
│   ├── main.py              # FastAPI app — SSE streaming + pipeline orchestration
│   ├── agents_v2.py         # All 5 agents (LangChain LCEL + RAG)
│   ├── tracer.py            # Live agent trace event system
│   ├── rag_store.py         # ChromaDB vector store + Gemini embeddings
│   ├── history_store.py     # Assessment history persistence
│   ├── models.py            # Pydantic data models
│   ├── core_knowledge.json  # 41 CORE knowledge documents
│   └── .env.example         # Environment variables template
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── types.ts
│       └── components/
│           ├── AgentTrace.tsx       # Live SSE trace viewer
│           ├── IntakeForm.tsx       # Assessment form + 3 sample profiles
│           ├── ReportDashboard.tsx  # 5-tab report + Export PDF
│           ├── Dashboard.tsx        # History + semantic search
│           ├── SamplePrompts.tsx    # Agent prompt architecture
│           └── ArchitectureView.tsx # System architecture diagram
├── architecture.svg         # System architecture diagram
├── REPORT.md                # Written report (Wipro deliverable)
└── README.md
```

---

## Security design

- Role-constrained agents — each system prompt limits the agent to one task
- No PII in agent context — only technical profile data passes through the pipeline
- Output validation — Agent 5 can only reference tools confirmed by previous agents
- Secrets via environment variables only, never hardcoded
- Human-in-the-loop — output is a reviewable draft, not an automated action
- Conflict detection — Conflict Detector flags contradictions between Agent 3 and Agent 4

---

*Vyshnavi Manda · Junior FDE Pre-screening Assignment · Wipro · April 2026*

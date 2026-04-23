# WEGA Fit Wizard

> A multi-agent system that generates a personalized WEGA deployment plan for any enterprise client — in under 60 seconds.

Built for the Wipro Junior Forward Deployed Engineer assignment. Addresses a real gap in the WEGA deployment workflow: automated client environment assessment before an FDE engagement begins.

---

## What it does

Enter a client's environment (tech stack, cloud provider, compliance needs, pain points). Five AI agents run in sequence and produce:

- **Compatibility matrix** — which client tools integrate natively with WEGA, which need custom connectors, and what's a blocker
- **Ranked agent recommendations** — the 3–5 WEGA agents most relevant to this client, ranked by ROI and effort
- **Risk registry** — compliance gaps, data residency issues, and team readiness concerns rated High/Medium/Low
- **30/60/90-day roadmap** — phased deployment plan with actions, agents to activate, and success metrics per phase
- **Executive summary** — C-suite ready paragraph for the first client meeting

---

## Agent pipeline

```
Client Intake Form
        |
[Agent 1] Discovery Parser       structured JSON client profile
        |
[Agent 2] Stack Compatibility    native / custom connector / blocker matrix
        |              |
[Agent 3] Use Case    [Agent 4] Risk Flagger
  Matcher               risk registry + severity
        |              |
        +------+-------+
               |
[Agent 5] Roadmap Orchestrator   30/60/90-day plan + exec summary
```

Each agent has a strict system prompt confining it to one role. No agent can exceed its scope or reference data not confirmed by a previous agent.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 + FastAPI |
| LLM | Anthropic Claude Sonnet API |
| Frontend | React 18 + TypeScript |
| Knowledge base | Structured JSON (WEGA integrations, agent catalog, compliance map) |
| Deployment | Render (backend) + Vercel (frontend) |

---

## Running locally

Prerequisites: Python 3.10+, Node 18+, Anthropic API key

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/wega-fit-wizard.git
cd wega-fit-wizard

# Backend
cd backend
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
pip install -r requirements.txt
python main.py
# Runs at http://localhost:8000

# Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm start
# Runs at http://localhost:3000
```

---

## Project structure

```
wega-fit-wizard/
├── backend/
│   ├── main.py              # FastAPI app — wires the 5-agent pipeline
│   ├── agents.py            # All 5 agents as focused Python functions
│   ├── models.py            # Pydantic data models
│   ├── wega_knowledge.json  # WEGA integration catalog + compliance map
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── types.ts
│       └── components/
│           ├── IntakeForm.tsx
│           └── ReportDashboard.tsx
├── architecture.svg         # System architecture diagram
├── REPORT.md                # Written report (Wipro deliverable)
├── render.yaml              # Render.com deployment config
└── README.md
```

---

## Security design

- Role-constrained agents — each system prompt limits the agent to one task
- No PII in agent context — only technical profile data passes through the pipeline
- Output validation — Agent 5 can only reference tools confirmed by previous agents
- Secrets via environment variables only, never hardcoded
- Human-in-the-loop — output is a reviewable draft, not an automated action

---

## Assignment deliverables

- [x] Live multi-agent system with public endpoint
- [x] Presentation ready — live demo + architecture walkthrough
- [x] Written report — [REPORT.md](REPORT.md)
- [x] Architecture diagram — [architecture.svg](architecture.svg)
- [x] Public GitHub repository

---

*Vyshnavi Manda · Junior FDE Pre-screening Assignment · Wipro · April 2026*

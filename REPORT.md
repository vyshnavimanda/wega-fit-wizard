# WEGA Fit Wizard — Written Report
**Vyshnavi Manda · Junior FDE Assignment · April 2026**

---

## 1. Multi-Agent Architecture

**System overview**

WEGA Fit Wizard is a multi-agent system that takes a client's technology environment as input and produces a personalized WEGA deployment plan — including a stack compatibility matrix, ranked agent recommendations, a risk registry, and a 30/60/90-day roadmap. It addresses a real gap in the WEGA deployment workflow: today, FDEs manually assess each client's environment before deployment. This system automates that discovery process, giving an FDE a complete deployment brief before they walk into a client engagement.

**Agents and responsibilities**

The pipeline consists of five specialized agents plus a Conflict Detector, each receiving the structured output of the previous one:

| Agent | Role | Output |
|---|---|---|
| Agent 1 — Discovery Parser | Parses raw intake form into a normalized JSON profile | Structured client profile with constraint tags |
| Agent 2 — Stack Compatibility | Compares client tools against WEGA's integration catalog via RAG | Compatibility matrix + score (0–100) |
| Agent 3 — Use Case Matcher | Recommends 3–5 WEGA agents ranked by ROI and effort | Prioritized agent list + "start here" pick |
| Agent 4 — Risk Flagger | Independently scans for compliance, integration, and deployment risks | Risk registry with severity (H/M/L) and FDE mitigations |
| Agent 5 — Roadmap Orchestrator | Synthesizes all outputs into a phased deployment plan | 30/60/90-day roadmap + executive summary |
| Conflict Detector | Compares Agent 3 recommendations against Agent 4 risks | Conflict alerts with resolution guidance |

**Communication pattern — message passing via structured JSON**

Agents communicate through structured JSON handoff: each agent's output is a validated JSON object that becomes the next agent's input. Agents 3 and 4 run in parallel — both receive Agent 2's compatibility matrix independently and their outputs converge into Agent 5. This is a hybrid sequential-parallel architecture: sequential at the pipeline level, parallel at the analysis stage. No agent shares mutable state — each is stateless, instantiated per-request, and terminated after producing its output.

---

## 2. Security, Safety, and Guardrails

**Input validation and prompt injection protection**
All form inputs are validated through Pydantic schema enforcement before reaching any LLM. Agent system prompts are immutable and injected separately from user data — prompt injection patterns (e.g., "ignore previous instructions") cannot reach the system prompt layer because user content only appears in the `user` message role, never the `system` role.

**Role constraints and output filtering**
Each agent has a strict LangChain PromptTemplate confining it to one task. Agent 2 can only produce a compatibility matrix — never recommendations. Agent 3 can only recommend agents confirmed as compatible by Agent 2 — it cannot invent integrations. Agent 5 can only reference agents and tools confirmed in previous outputs. The Conflict Detector flags cases where Agent 3's recommendations contradict Agent 4's risk findings, providing a built-in responsible AI layer.

**Data handling (PII, secrets, logging)**
Client names and contact information are structurally excluded from agent context — only the technical profile passes through the pipeline. API keys are loaded via environment variables and never hardcoded or logged. The backend logs agent execution steps only, not input data.

**Preventing unintended escalation**
No agent can trigger another agent autonomously — all orchestration is controlled by `main.py`. The system produces a reviewable draft output, not automated actions. Human-in-the-loop review is enforced by design.

---

## 3. Implementation Approach

**Tech stack**
- Backend: Python 3.12 + FastAPI
- LLM Orchestration: LangChain (LCEL pipe syntax — `prompt | llm | parser`)
- LLM: Groq API with LLaMA 3.3 70B (fast, free tier, reliable JSON output)
- RAG: ChromaDB vector database + Google Gemini embeddings (`gemini-embedding-001`)
- Knowledge Base: 41 WEGA knowledge documents embedded at startup (integrations, agents, compliance, constraints)
- Frontend: React 18 + TypeScript
- Deployment: Azure App Service (backend) + Azure Static Web Apps (frontend)

**Agent instantiation and coordination**
Each agent is a stateless Python function built on a LangChain `LLMChain`. Agents are instantiated per-request with no shared state. The RAG vector store is initialized once at startup and shared across all agents via a module-level reference. The orchestration layer in `main.py` handles sequential execution, passes JSON outputs forward, invokes the Conflict Detector between Agents 4 and 5, saves the completed report to ChromaDB history, and catches failures at each step.

**Error handling, retries, and failures**
Every agent call is wrapped in try/except. A `clean_json()` function robustly strips markdown fences and extracts valid JSON from LLM output. A 3-second sleep between each agent call prevents rate limit errors on free-tier APIs. JSON parse failures return HTTP 500 with the specific agent that failed identified. The frontend displays user-friendly errors and allows retry without reloading.

**Testing and validation**
The system was validated against five representative client profiles: MediCore Health (HIPAA/Azure, standard environment), DefenseWorks Federal (FedRAMP, air-gapped + no-install-rights + data-sovereignty), a fintech firm (PCI-DSS/AWS), a mid-size SaaS company (GCP), and an on-premise-only enterprise. Each profile was verified to produce structurally valid JSON output, sensible agent recommendations, and correctly flagged risks.

---

## 4. Use of AI / LLMs and Agent Collaboration

**Where LLMs are used**
LLMs handle all reasoning tasks: structured extraction (Agent 1), compatibility classification with RAG context (Agent 2), relevance ranking and justification (Agent 3), risk identification and severity scoring with compliance knowledge (Agent 4), and synthesis and roadmap generation (Agent 5). Each agent also returns a `confidence_score` (0–100) alongside its output, enabling transparency into LLM certainty.

**RAG — retrieval augmented generation**
Every agent performs a semantic search over the ChromaDB vector store before reasoning. Agent 2 retrieves only the integration docs relevant to the client's tools. Agent 4 retrieves only the compliance and constraint docs relevant to this client's requirements. This means agents reason over focused, relevant context rather than the entire knowledge base — reducing hallucination and improving output quality.

**How agents collaborate**
Agents collaborate through structured data handoff, not negotiation. Each agent transforms its input and passes a clean JSON object to the next. The Conflict Detector acts as the negotiation layer — it cross-references Agent 3's recommendations against Agent 4's risks and surfaces contradictions for human review. This is "responsible AI" in practice: the system catches its own internal disagreements.

**Autonomy vs. control tradeoffs**
Sequential control was deliberately chosen over autonomous agent loops. LLM-to-LLM negotiation adds latency and unpredictability — for a deployment planning tool where accuracy and auditability matter more than speed, structured sequential handoff is the right tradeoff. Each agent is constrained to one role, cannot exceed its scope, and the final output is always a human-reviewable draft. The FDE owns the plan; the system accelerates its creation.

---

*Repository: [github.com/vyshnavi-manda/wega-fit-wizard](https://github.com/vyshnavi-manda/wega-fit-wizard)*
*Live demo: [wega-fit-wizard.azurewebsites.net](https://wega-fit-wizard.azurewebsites.net)*

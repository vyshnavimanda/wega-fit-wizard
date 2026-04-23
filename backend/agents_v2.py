"""
LangChain Agent Pipeline with RAG + Live Tracing
-------------------------------------------------
Each agent emits real-time trace events:
  - RAG query + retrieved documents with relevance scores
  - Key findings as they're determined
  - Confidence score on completion
  - Warnings if constraints are detected

Tech stack: LangChain LCEL, ChromaDB, Groq LLaMA, Gemini embeddings
"""

import json
import os
import re
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from models import ClientIntakeForm
from rag_store import initialize_vector_store, semantic_search
from tracer import PipelineTracer, AgentTrace

with open("wega_knowledge.json") as f:
    KNOWLEDGE = json.load(f)

print("⚙ Initializing RAG vector store...")
VECTOR_STORE = initialize_vector_store(KNOWLEDGE)
print("✓ RAG store ready")


def get_llm() -> ChatGroq:
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.1
    )


def clean_json(raw: str) -> str:
    """Robustly extract valid JSON from LLM output."""
    raw = raw.strip()
    raw = re.sub(r'^```json\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'^```\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'```$', '', raw.strip())
    raw = raw.strip()
    start = raw.find('{')
    end = raw.rfind('}')
    if start != -1 and end != -1:
        raw = raw[start:end+1]
    return raw.strip()


def run_chain(template: str, input_vars: dict) -> str:
    """Run a LangChain LCEL chain and return clean JSON text."""
    llm = get_llm()
    prompt = PromptTemplate(
        input_variables=list(input_vars.keys()),
        template=template
    )
    parser = StrOutputParser()
    chain = prompt | llm | parser
    raw = chain.invoke(input_vars)
    return clean_json(raw)


def parse_rag_docs(context_str: str) -> list:
    """Parse RAG context string into structured doc list for tracing."""
    docs = []
    if not context_str or context_str == "No relevant knowledge found.":
        return docs
    for block in context_str.split("\n\n"):
        if block.startswith("["):
            lines = block.split("\n", 1)
            header = lines[0]
            text = lines[1][:100] + "..." if len(lines) > 1 else ""
            rel = 0
            rel_match = re.search(r'relevance: ([\d.]+)%', header)
            if rel_match:
                rel = float(rel_match.group(1))
            doc_type = "unknown"
            type_match = re.search(r'\[([A-Z]+)', header)
            if type_match:
                doc_type = type_match.group(1).lower()
            docs.append({"type": doc_type, "relevance": rel, "preview": text})
    return docs[:5]


# ─────────────────────────────────────────────
# AGENT 1 — Discovery Parser
# ─────────────────────────────────────────────
def agent1_discovery_parser(form: ClientIntakeForm, tracer: PipelineTracer = None) -> dict:
    trace = tracer.start_agent(1, "Discovery Parser") if tracer else None

    constraint_context = semantic_search(
        VECTOR_STORE,
        query=f"deployment constraints {form.deployment_constraints} {form.cloud_provider}",
        n_results=3,
        filter_type="constraint"
    )

    if tracer and trace:
        docs = parse_rag_docs(constraint_context)
        tracer.emit_rag(trace, f"deployment constraints: {form.deployment_constraints}", docs)

    template = """You are the Discovery Parser Agent for WEGA, Wipro's agentic AI platform.
Your ONLY job: parse the intake form into a clean structured JSON profile.

Constraint reference knowledge:
{constraint_context}

Rules:
- Normalize tool names (e.g. "gh actions" -> "GitHub Actions")
- team_size_bucket: "small" (1-20), "medium" (21-100), "large" (100+)
- Extract deployment_constraint_tags using: "air-gapped", "no-internet", "no-install-rights",
  "on-premise-only", "data-sovereignty", "no-cloud-apis", "restricted-firewall", "no-admin-rights", "none"
- confidence_score: 0-100
- Output ONLY valid JSON, no markdown

Output this exact shape:
{{
  "company_name": string,
  "industry": string,
  "team_size_raw": string,
  "team_size_bucket": "small"|"medium"|"large",
  "cloud_provider": string,
  "tools": {{
    "source_control": [string],
    "ci_cd": [string],
    "project_management": [string],
    "security": [string],
    "monitoring": [string]
  }},
  "compliance_list": [string],
  "deployment_constraint_tags": [string],
  "pain_point_tags": [string],
  "primary_goal": string,
  "confidence_score": number,
  "confidence_reason": string
}}

Intake form:
Company: {company_name} | Industry: {industry} | Team: {team_size}
Cloud: {cloud_provider} | Source Control: {source_control}
CI/CD: {ci_cd_tools} | Project Mgmt: {project_management}
Security: {security_tools} | Monitoring: {monitoring_tools}
Compliance: {compliance_requirements} | Constraints: {deployment_constraints}
Pain Points: {current_pain_points} | Goal: {primary_goal}"""

    raw = run_chain(template, {
        "constraint_context": constraint_context,
        "company_name": form.company_name, "industry": form.industry,
        "team_size": form.team_size, "cloud_provider": form.cloud_provider,
        "source_control": form.source_control, "ci_cd_tools": form.ci_cd_tools,
        "project_management": form.project_management, "security_tools": form.security_tools,
        "monitoring_tools": form.monitoring_tools, "compliance_requirements": form.compliance_requirements,
        "deployment_constraints": form.deployment_constraints,
        "current_pain_points": form.current_pain_points, "primary_goal": form.primary_goal,
    })
    result = json.loads(raw)

    if tracer and trace:
        constraints = result.get("deployment_constraint_tags", [])
        if constraints and constraints != ["none"]:
            tracer.emit_finding(trace, f"Constrained environment detected: {', '.join(constraints)}")
        tracer.emit_finding(trace, f"Team: {result.get('team_size_bucket')} | Cloud: {result.get('cloud_provider')}")
        tracer.emit_finding(trace, f"Compliance: {', '.join(result.get('compliance_list', []) or ['none'])}")
        if constraints and constraints != ["none"]:
            tracer.emit_finding(trace, f"⚠ FDE Alert: {len(constraints)} deployment constraint(s) will affect agent activation order")
        tracer.complete_agent(trace,
            confidence=result.get("confidence_score"),
            summary=f"Parsed {form.company_name} — {result.get('team_size_bucket')} team, {result.get('cloud_provider')}"
        )
    return result


# ─────────────────────────────────────────────
# AGENT 2 — Stack Compatibility
# ─────────────────────────────────────────────
def agent2_stack_compatibility(client_profile: dict, tracer: PipelineTracer = None) -> dict:
    trace = tracer.start_agent(2, "Stack Compatibility") if tracer else None

    all_tools = []
    for tools in client_profile.get("tools", {}).values():
        all_tools.extend(tools)
    query = f"WEGA integration {' '.join(all_tools)} {client_profile.get('cloud_provider', '')}"

    integration_context = semantic_search(VECTOR_STORE, query, n_results=8, filter_type="integration")
    constraints = client_profile.get("deployment_constraint_tags", [])
    constraint_context = ""
    if constraints and constraints != ["none"]:
        constraint_context = semantic_search(
            VECTOR_STORE,
            f"compatibility impact {' '.join(constraints)}",
            n_results=3, filter_type="constraint"
        )

    if tracer and trace:
        docs = parse_rag_docs(integration_context)
        tracer.emit_rag(trace, f"WEGA integrations for: {', '.join(all_tools[:5])}", docs)

    template = """You are the Stack Compatibility Agent for WEGA, Wipro's agentic AI platform.
Your ONLY job: assess compatibility of client tools against WEGA integrations.

WEGA Integration Knowledge (RAG):
{integration_context}

Deployment Constraint Impacts:
{constraint_context}

Client tools: {tools}
Deployment constraints: {constraints}

Rules:
- "native": works out of box | "custom_connector": needs work | "blocker": incompatible
- If air-gapped or no-internet, downgrade cloud-dependent tools to custom_connector
- confidence_score: 0-100
- Output ONLY valid JSON, no markdown

Output this exact shape:
{{
  "compatibility_matrix": [{{"category": string, "tool": string, "status": "native"|"custom_connector"|"blocker"|"unknown", "notes": string}}],
  "overall_compatibility_score": number,
  "native_count": number,
  "custom_connector_count": number,
  "blocker_count": number,
  "summary": string,
  "confidence_score": number,
  "confidence_reason": string
}}"""

    raw = run_chain(template, {
        "integration_context": integration_context,
        "constraint_context": constraint_context or "No constraints.",
        "tools": json.dumps(client_profile.get("tools", {})),
        "constraints": json.dumps(constraints),
    })
    result = json.loads(raw)

    if tracer and trace:
        tracer.emit_finding(trace, f"Score: {result.get('overall_compatibility_score')}/100")
        tracer.emit_finding(trace, f"Native: {result.get('native_count')} | Custom connector: {result.get('custom_connector_count')} | Blockers: {result.get('blocker_count')}")
        if result.get("blocker_count", 0) > 0:
            blockers = [i["tool"] for i in result.get("compatibility_matrix", []) if i["status"] == "blocker"]
            tracer.emit_finding(trace, f"⚠ Blockers found: {', '.join(blockers)}")
        tracer.complete_agent(trace,
            confidence=result.get("confidence_score"),
            summary=result.get("summary", "")
        )
    return result


# ─────────────────────────────────────────────
# AGENT 3 — Use Case Matcher
# ─────────────────────────────────────────────
def agent3_use_case_matcher(client_profile: dict, compatibility: dict, tracer: PipelineTracer = None) -> dict:
    trace = tracer.start_agent(3, "Use Case Matcher") if tracer else None

    query = (
        f"WEGA agents {client_profile.get('industry','')} "
        f"{client_profile.get('cloud_provider','')} "
        f"team {client_profile.get('team_size_bucket','')} "
        f"{' '.join(client_profile.get('pain_point_tags',[]))}"
    )
    agent_context = semantic_search(VECTOR_STORE, query, n_results=6, filter_type="agent")
    team_context = semantic_search(
        VECTOR_STORE,
        f"team size {client_profile.get('team_size_bucket','medium')} guidance",
        n_results=2, filter_type="team_guidance"
    )

    if tracer and trace:
        docs = parse_rag_docs(agent_context)
        tracer.emit_rag(trace, f"WEGA agents for {client_profile.get('industry')} {client_profile.get('team_size_bucket')} team", docs)

    template = """You are the Use Case Matcher Agent for WEGA, Wipro's agentic AI platform.
Your ONLY job: recommend the 3-5 best WEGA agents for this specific client.

Relevant WEGA Agents (RAG):
{agent_context}

Team Size Guidance (RAG):
{team_context}

Client profile: {profile}
Compatibility matrix: {compatibility}

Rules:
- Only recommend agents with native or custom_connector tools
- If air-gapped or on-premise-only constraints, prioritize offline-capable agents
- Rank by ROI first, then effort (low first), then pain point alignment
- confidence_score: 0-100
- Output ONLY valid JSON, no markdown

Output:
{{
  "recommendations": [{{"agent_id": string, "agent_name": string, "priority_rank": number, "reason": string, "effort": "low"|"medium"|"high", "expected_roi": "medium"|"high"|"very-high", "sdlc_phase": string}}],
  "start_here": {{"agent_id": string, "one_liner": string}},
  "confidence_score": number,
  "confidence_reason": string
}}"""

    raw = run_chain(template, {
        "agent_context": agent_context, "team_context": team_context,
        "profile": json.dumps(client_profile),
        "compatibility": json.dumps(compatibility.get("compatibility_matrix", [])),
    })
    result = json.loads(raw)

    if tracer and trace:
        recs = result.get("recommendations", [])
        tracer.emit_finding(trace, f"{len(recs)} agents recommended")
        for r in recs[:3]:
            tracer.emit_finding(trace, f"#{r['priority_rank']} {r['agent_name']} — ROI: {r['expected_roi']}, Effort: {r['effort']}")
        start = result.get("start_here", {})
        if start:
            tracer.emit_finding(trace, f"Start here: {start.get('one_liner','')}")
        tracer.complete_agent(trace,
            confidence=result.get("confidence_score"),
            summary=f"{len(recs)} agents recommended, start with {start.get('agent_id','')}"
        )
    return result


# ─────────────────────────────────────────────
# AGENT 4 — Risk Flagger
# ─────────────────────────────────────────────
def agent4_risk_flagger(client_profile: dict, compatibility: dict, tracer: PipelineTracer = None) -> dict:
    trace = tracer.start_agent(4, "Risk Flagger") if tracer else None

    constraints = client_profile.get("deployment_constraint_tags", [])
    compliance = client_profile.get("compliance_list", [])

    compliance_context = semantic_search(
        VECTOR_STORE,
        f"compliance {' '.join(compliance)} {client_profile.get('cloud_provider','')}",
        n_results=4, filter_type="compliance"
    )
    constraint_context = ""
    if constraints and constraints != ["none"]:
        constraint_context = semantic_search(
            VECTOR_STORE,
            f"deployment risk {' '.join(constraints)} FDE forward deployed engineer",
            n_results=len(constraints)+1, filter_type="constraint"
        )

    if tracer and trace:
        docs = parse_rag_docs(compliance_context)
        tracer.emit_rag(trace, f"Compliance + constraints: {', '.join(compliance + constraints)}", docs)
        if constraints and constraints != ["none"]:
            tracer.emit_finding(trace, f"⚠ Analyzing {len(constraints)} deployment constraint(s) for FDE impact")

    template = """You are the Risk Flagger Agent for WEGA, Wipro's agentic AI platform.
Your ONLY job: identify ALL deployment risks for this client.

Compliance Knowledge (RAG):
{compliance_context}

Deployment Constraint Risks (RAG - CRITICAL for FDE):
{constraint_context}

Client profile: {profile}
Compatibility blockers: {blocker_count} | Custom connectors: {custom_count}

Rules:
- "high": deployment blocker or legal risk
- "medium": significant friction
- "low": minor concern
- Every constraint MUST generate its own HIGH severity risk with FDE mitigation
- confidence_score: 0-100
- Output ONLY valid JSON, no markdown

Output:
{{
  "risks": [{{"category": string, "title": string, "severity": "low"|"medium"|"high", "description": string, "mitigation": string}}],
  "high_risk_count": number,
  "medium_risk_count": number,
  "low_risk_count": number,
  "overall_risk_level": "green"|"yellow"|"red",
  "confidence_score": number,
  "confidence_reason": string
}}"""

    raw = run_chain(template, {
        "compliance_context": compliance_context,
        "constraint_context": constraint_context or "No deployment constraints.",
        "profile": json.dumps(client_profile),
        "blocker_count": compatibility.get("blocker_count", 0),
        "custom_count": compatibility.get("custom_connector_count", 0),
    })
    result = json.loads(raw)

    if tracer and trace:
        tracer.emit_finding(trace, f"Risk level: {result.get('overall_risk_level','?').upper()}")
        tracer.emit_finding(trace, f"High: {result.get('high_risk_count',0)} | Medium: {result.get('medium_risk_count',0)} | Low: {result.get('low_risk_count',0)}")
        high_risks = [r for r in result.get("risks", []) if r["severity"] == "high"]
        for r in high_risks[:3]:
            tracer.emit_finding(trace, f"🔴 {r['title']}")
        tracer.complete_agent(trace,
            confidence=result.get("confidence_score"),
            summary=f"{result.get('high_risk_count',0)} high risks, level: {result.get('overall_risk_level','?')}"
        )
    return result


# ─────────────────────────────────────────────
# CONFLICT DETECTOR
# ─────────────────────────────────────────────
def detect_conflicts(recommendations: dict, risks: dict, tracer: PipelineTracer = None) -> list:
    conflicts = []
    rec_agents = [r["agent_name"].lower() for r in recommendations.get("recommendations", [])]
    high_risks = [r for r in risks.get("risks", []) if r["severity"] in ["high", "medium"]]

    for risk in high_risks:
        risk_text = (risk["title"] + " " + risk["description"]).lower()
        for agent_name in rec_agents:
            agent_keywords = agent_name.lower().split()
            if any(kw in risk_text for kw in agent_keywords if len(kw) > 4):
                conflict = {
                    "type": "recommendation_risk_conflict",
                    "agent": agent_name,
                    "risk_title": risk["title"],
                    "severity": risk["severity"],
                    "message": f"Agent '{agent_name}' recommended but conflicts with risk: '{risk['title']}'.",
                    "resolution": risk["mitigation"]
                }
                conflicts.append(conflict)
                if tracer:
                    tracer.emit_conflict(conflict)

    for rec in recommendations.get("recommendations", []):
        if "cloud" in rec.get("reason", "").lower() or "api" in rec.get("reason", "").lower():
            for risk in risks.get("risks", []):
                if "air-gapped" in risk.get("title", "").lower() or "internet" in risk.get("description", "").lower():
                    conflict = {
                        "type": "constraint_conflict",
                        "agent": rec["agent_name"],
                        "risk_title": risk["title"],
                        "severity": "high",
                        "message": f"'{rec['agent_name']}' requires internet/cloud but client has connectivity restrictions.",
                        "resolution": "Use offline model hosting or whitelist specific APIs with client IT."
                    }
                    conflicts.append(conflict)
                    if tracer:
                        tracer.emit_conflict(conflict)
                    break

    seen = set()
    unique = []
    for c in conflicts:
        key = f"{c['agent']}_{c['risk_title']}"
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


# ─────────────────────────────────────────────
# AGENT 5 — Roadmap Orchestrator
# ─────────────────────────────────────────────
def agent5_roadmap_orchestrator(
    client_profile: dict, compatibility: dict,
    recommendations: dict, risks: dict,
    conflicts: list, tracer: PipelineTracer = None
) -> dict:
    trace = tracer.start_agent(5, "Roadmap Orchestrator") if tracer else None

    team_context = semantic_search(
        VECTOR_STORE,
        f"deployment roadmap {client_profile.get('team_size_bucket','medium')} team phased",
        n_results=2, filter_type="team_guidance"
    )

    if tracer and trace:
        docs = parse_rag_docs(team_context)
        tracer.emit_rag(trace, f"Team size guidance: {client_profile.get('team_size_bucket')} team", docs)
        tracer.emit_finding(trace, f"Synthesizing {len(recommendations.get('recommendations',[]))} agent recs + {risks.get('high_risk_count',0)} high risks + {len(conflicts)} conflicts")

    constraints = client_profile.get("deployment_constraint_tags", [])

    template = """You are the Roadmap Orchestrator Agent for WEGA, Wipro's agentic AI platform.
Synthesize all agent outputs into a 30/60/90-day deployment roadmap.

Team Guidance (RAG):
{team_context}

Client: {company} | Score: {score}/100 | Constraints: {constraints}
Recommendations: {recommendations}
Risks: {risks}
Conflicts: {conflicts}

Rules:
- Phase 1 (30-day): Address ALL high risks + deployment constraints BEFORE activating agents
- Phase 2 (60-day): Activate first agents, verify integrations, first metrics
- Phase 3 (90-day): Full activation, ROI measurement
- executive_summary: 3-4 sentences, CTO/VP audience
- confidence_score: 0-100
- Output ONLY valid JSON, no markdown

Output:
{{
  "roadmap": [{{"phase": "30-day"|"60-day"|"90-day", "title": string, "actions": [string], "agents_to_activate": [string], "success_metric": string}}],
  "executive_summary": string,
  "start_here": string,
  "confidence_score": number,
  "confidence_reason": string
}}"""

    raw = run_chain(template, {
        "team_context": team_context,
        "company": client_profile.get("company_name", ""),
        "score": compatibility.get("overall_compatibility_score", 0),
        "constraints": json.dumps(constraints),
        "recommendations": json.dumps(recommendations.get("recommendations", [])),
        "risks": json.dumps(risks.get("risks", [])),
        "conflicts": json.dumps(conflicts) if conflicts else "None",
    })
    result = json.loads(raw)

    if tracer and trace:
        tracer.emit_finding(trace, f"30/60/90-day roadmap generated")
        tracer.emit_finding(trace, f"Start here: {result.get('start_here','')[:80]}")
        tracer.complete_agent(trace,
            confidence=result.get("confidence_score"),
            summary="Roadmap complete"
        )
    return result

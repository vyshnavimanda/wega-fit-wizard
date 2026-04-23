import React, { useState } from 'react';

const AGENTS = [
  {
    num: 1,
    name: "Discovery Parser",
    color: "#185FA5",
    bg: "#E6F1FB",
    role: "Parses raw intake form into structured JSON client profile",
    rag_type: "constraint",
    rag_query: "deployment constraints {client_constraints} {cloud_provider}",
    prompt_summary: "Takes the 12-field intake form and normalizes it into a clean JSON profile. Extracts deployment constraint tags, team size bucket, compliance list, and pain point keywords.",
    output_shape: `{
  "company_name": string,
  "industry": string,
  "team_size_bucket": "small"|"medium"|"large",
  "cloud_provider": string,
  "tools": { "source_control": [], "ci_cd": [], ... },
  "compliance_list": [string],
  "deployment_constraint_tags": [string],
  "pain_point_tags": [string],
  "confidence_score": number
}`,
    guardrail: "System prompt is immutable — user data only reaches the user message role, never the system prompt. Prevents prompt injection."
  },
  {
    num: 2,
    name: "Stack Compatibility",
    color: "#534AB7",
    bg: "#EEEDFE",
    role: "Compares client toolchain against WEGA's integration catalog",
    rag_type: "integration",
    rag_query: "WEGA integration {client_tools} {cloud_provider}",
    prompt_summary: "Retrieves only the integration docs relevant to the client's specific tools via semantic search. Classifies each tool as native, custom_connector, or blocker. Downgrades cloud-dependent tools if air-gapped constraint detected.",
    output_shape: `{
  "compatibility_matrix": [{
    "category": string,
    "tool": string,
    "status": "native"|"custom_connector"|"blocker",
    "notes": string
  }],
  "overall_compatibility_score": number (0-100),
  "native_count": number,
  "blocker_count": number,
  "confidence_score": number
}`,
    guardrail: "Agent can ONLY assess compatibility — role constraint prevents it from making recommendations. Output is validated against known WEGA integration catalog."
  },
  {
    num: 3,
    name: "Use Case Matcher",
    color: "#1D9E75",
    bg: "#E1F5EE",
    role: "Recommends best WEGA agents ranked by ROI and effort",
    rag_type: "agent",
    rag_query: "WEGA agents {industry} {team_size} {pain_points}",
    prompt_summary: "Semantic search finds the most relevant WEGA agents for this client's industry and pain points. Only recommends agents whose required tools are native or custom_connector in the compatibility matrix. Prioritizes offline-capable agents for constrained environments.",
    output_shape: `{
  "recommendations": [{
    "agent_name": string,
    "priority_rank": number,
    "reason": string,
    "effort": "low"|"medium"|"high",
    "expected_roi": "medium"|"high"|"very-high"
  }],
  "start_here": { "agent_id": string, "one_liner": string },
  "confidence_score": number
}`,
    guardrail: "Can ONLY recommend agents confirmed compatible by Agent 2 — cannot invent new integrations or recommend blockers."
  },
  {
    num: 4,
    name: "Risk Flagger",
    color: "#993C1D",
    bg: "#FAECE7",
    role: "Identifies all deployment risks including FDE-specific constraints",
    rag_type: "compliance + constraint",
    rag_query: "compliance {frameworks} + deployment risk {constraints} FDE",
    prompt_summary: "Retrieves compliance knowledge (HIPAA, SOC2, FedRAMP etc.) and constraint-specific FDE risk docs via separate RAG queries. Every deployment constraint (air-gapped, no-install etc.) MUST generate its own HIGH severity risk with a concrete FDE mitigation strategy.",
    output_shape: `{
  "risks": [{
    "category": string,
    "title": string,
    "severity": "low"|"medium"|"high",
    "description": string,
    "mitigation": string
  }],
  "high_risk_count": number,
  "overall_risk_level": "green"|"yellow"|"red",
  "confidence_score": number
}`,
    guardrail: "Runs independently of Agent 3 — parallel execution ensures risk assessment is unbiased by recommendations. Conflict Detector cross-references both outputs."
  },
  {
    num: 5,
    name: "Roadmap Orchestrator",
    color: "#854F0B",
    bg: "#FAEEDA",
    role: "Synthesizes all outputs into a 30/60/90-day deployment plan",
    rag_type: "team_guidance",
    rag_query: "deployment roadmap {team_size} team phased approach",
    prompt_summary: "Final synthesis agent. Receives all 4 previous agent outputs plus conflict detection results. Phase 1 MUST address all high risks and deployment constraints before activating any agents. Generates a CTO/VP-ready executive summary.",
    output_shape: `{
  "roadmap": [{
    "phase": "30-day"|"60-day"|"90-day",
    "title": string,
    "actions": [string],
    "agents_to_activate": [string],
    "success_metric": string
  }],
  "executive_summary": string,
  "start_here": string,
  "confidence_score": number
}`,
    guardrail: "Can ONLY reference agents and tools confirmed in previous outputs — structurally prevents hallucinated integrations or unsupported claims in the roadmap."
  }
];

export default function SamplePrompts() {
  const [expanded, setExpanded] = useState<number | null>(1);

  return (
    <div className="prompts-page">
      <div className="prompts-header">
        <div className="prompts-title">Agent Prompt Architecture</div>
        <div className="prompts-sub">
          Each agent uses a LangChain PromptTemplate with RAG-retrieved context injected before reasoning.
          Role constraints prevent agents from exceeding their defined scope.
        </div>
        <div className="prompts-stack-row">
          {['LangChain LCEL', 'PromptTemplate', 'ChromaDB RAG', 'Groq LLaMA 3.3', 'Structured JSON output'].map(t => (
            <span key={t} className="trace-tech-badge">{t}</span>
          ))}
        </div>
      </div>

      <div className="prompts-flow-row">
        {AGENTS.map((a, i) => (
          <React.Fragment key={a.num}>
            <div
              className={`prompt-flow-node ${expanded === a.num ? 'active' : ''}`}
              style={{ borderColor: expanded === a.num ? a.color : undefined, background: expanded === a.num ? a.bg : undefined }}
              onClick={() => setExpanded(expanded === a.num ? null : a.num)}
            >
              <div className="pfn-num" style={{ background: a.color }}>{a.num}</div>
              <div className="pfn-name">{a.name}</div>
            </div>
            {i < 4 && <div className="pfn-arrow">→</div>}
          </React.Fragment>
        ))}
      </div>

      <div className="prompts-detail-list">
        {AGENTS.map(agent => (
          <div
            key={agent.num}
            className={`prompt-card ${expanded === agent.num ? 'open' : 'closed'}`}
            onClick={() => setExpanded(expanded === agent.num ? null : agent.num)}
          >
            <div className="prompt-card-header">
              <div className="prompt-card-num" style={{ background: agent.color }}>Agent {agent.num}</div>
              <div className="prompt-card-name">{agent.name}</div>
              <div className="prompt-card-role">{agent.role}</div>
              <div className="prompt-expand">{expanded === agent.num ? '▲' : '▼'}</div>
            </div>

            {expanded === agent.num && (
              <div className="prompt-card-body">

                <div className="prompt-section">
                  <div className="prompt-section-label">RAG Retrieval</div>
                  <div className="prompt-rag-box">
                    <span className="prompt-rag-type">{agent.rag_type}</span>
                    <span className="prompt-rag-query">"{agent.rag_query}"</span>
                  </div>
                  <div className="prompt-rag-desc">
                    Semantic search over ChromaDB vector store using Gemini embeddings.
                    Only retrieves documents relevant to this specific client — focused context reduces hallucination.
                  </div>
                </div>

                <div className="prompt-section">
                  <div className="prompt-section-label">Prompt Strategy</div>
                  <div className="prompt-strategy">{agent.prompt_summary}</div>
                </div>

                <div className="prompt-section">
                  <div className="prompt-section-label">Output Schema (structured JSON)</div>
                  <pre className="prompt-output-schema">{agent.output_shape}</pre>
                </div>

                <div className="prompt-section">
                  <div className="prompt-section-label">Security Guardrail</div>
                  <div className="prompt-guardrail">🔒 {agent.guardrail}</div>
                </div>

              </div>
            )}
          </div>
        ))}
      </div>

      <div className="prompts-conflict-section">
        <div className="prompt-card-header" style={{padding:'12px 16px',background:'#FFF8F0',borderRadius:'10px',border:'1px solid #FAC775'}}>
          <div className="prompt-card-num" style={{background:'#854F0B'}}>+</div>
          <div className="prompt-card-name">Conflict Detector</div>
          <div className="prompt-card-role">Cross-references Agent 3 recommendations against Agent 4 risks — responsible AI layer</div>
        </div>
        <div style={{fontSize:'13px',color:'#666',marginTop:'8px',padding:'0 4px',lineHeight:'1.6'}}>
          Runs between Agents 4 and 5. Flags cases where a recommended agent contradicts a risk finding.
          Example: if Agent 3 recommends a cloud-dependent agent but Agent 4 flagged air-gapped constraints,
          the Conflict Detector surfaces this before the Roadmap Orchestrator generates the final plan.
        </div>
      </div>
    </div>
  );
}

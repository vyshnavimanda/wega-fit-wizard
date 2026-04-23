import React, { useState } from 'react';
import ExportReport from './ExportReport';
import { WegaFitReport } from '../types';

interface Props { report: WegaFitReport; }
type Tab = 'overview' | 'compatibility' | 'agents' | 'risks' | 'roadmap';

const SEVERITY_COLOR: Record<string, string> = { high: 'risk-high', medium: 'risk-medium', low: 'risk-low' };
const STATUS_COLOR: Record<string, string> = { native: 'status-native', custom_connector: 'status-custom', blocker: 'status-blocker', unknown: 'status-unknown' };
const STATUS_LABEL: Record<string, string> = { native: 'Native', custom_connector: 'Custom Connector', blocker: 'Blocker', unknown: 'Unknown' };
const RISK_LEVEL_COLOR: Record<string, string> = { green: '#1D9E75', yellow: '#BA7517', red: '#A32D2D' };
const EFFORT_COLOR: Record<string, string> = { low: '#1D9E75', medium: '#BA7517', high: '#A32D2D' };
const PHASE_COLOR: Record<string, string> = { '30-day': '#185FA5', '60-day': '#534AB7', '90-day': '#0F6E56' };

function confColor(score: number) {
  if (score >= 85) return '#1D9E75';
  if (score >= 65) return '#BA7517';
  return '#A32D2D';
}

export default function ReportDashboard({ report }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const { client_profile, compatibility, recommendations, risks, roadmap } = report;
  const conflicts = (report as any).conflicts || [];
  const agentConfidence = (report as any).agent_confidence || {};
  const score = compatibility.overall_compatibility_score;
  const scoreColor = score >= 75 ? '#1D9E75' : score >= 50 ? '#BA7517' : '#A32D2D';

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview' },
    { id: 'compatibility' as Tab, label: `Compatibility (${score}/100)` },
    { id: 'agents' as Tab, label: `Agents (${recommendations.recommendations?.length ?? 0})` },
    { id: 'risks' as Tab, label: `Risks (${risks.high_risk_count}H ${risks.medium_risk_count}M)` },
    { id: 'roadmap' as Tab, label: 'Roadmap' },
  ];

  const confAgents = [
    { label: 'Discovery', key: 'agent1_discovery' },
    { label: 'Compatibility', key: 'agent2_compatibility' },
    { label: 'Matcher', key: 'agent3_recommendations' },
    { label: 'Risk Flagger', key: 'agent4_risks' },
    { label: 'Orchestrator', key: 'agent5_roadmap' },
  ];

  return (
    <div className="report-page">
      {/* Header */}
      <div className="report-header" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1}}>
        <div className="report-client-name">{client_profile.company_name}</div>
        <div className="report-meta">{client_profile.industry} &nbsp;·&nbsp; {client_profile.team_size_raw} &nbsp;·&nbsp; {client_profile.cloud_provider}</div>
        <div className="report-tags">
          {client_profile.compliance_list?.map((c: string) => <span key={c} className="tag-compliance">{c}</span>)}
          {client_profile.deployment_constraint_tags?.filter((c: string) => c !== 'none').map((c: string) => (
            <span key={c} className="tag-constraint">⚠ {c}</span>
          ))}
          {client_profile.pain_point_tags?.map((p: string) => <span key={p} className="tag-pain">{p}</span>)}
        </div>
        </div>
        <ExportReport report={report} />
      </div>

      {/* Agent Confidence Panel */}
      {Object.keys(agentConfidence).length > 0 && (
        <div className="confidence-panel">
          <div className="confidence-title">Agent Confidence Scores — powered by LangChain + RAG</div>
          <div className="confidence-grid">
            {confAgents.map(({ label, key }) => {
              const val = agentConfidence[key] || 0;
              return (
                <div key={key} className="conf-item">
                  <div className="conf-label">{label}</div>
                  <div className="conf-score" style={{ color: confColor(val) }}>{val}%</div>
                  <div className="conf-bar">
                    <div className="conf-bar-fill" style={{ width: `${val}%`, background: confColor(val) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conflict Alerts */}
      {conflicts.length > 0 && (
        <div className="conflicts-panel">
          <div className="conflicts-header">
            <span className="conflict-alert-icon">⚠️</span>
            <div className="conflicts-title">{conflicts.length} Agent Conflict{conflicts.length > 1 ? 's' : ''} Detected</div>
          </div>
          {conflicts.map((c: any, i: number) => (
            <div key={i} className="conflict-item">
              <div className="conflict-item-header">
                <span className="conflict-agent">{c.agent}</span>
                <span className={`conflict-severity ${c.severity}`}>{c.severity.toUpperCase()}</span>
              </div>
              <div className="conflict-message">{c.message}</div>
              <div className="conflict-resolution"><strong>Resolution:</strong> {c.resolution}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="report-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`report-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="report-content">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="tab-overview">
            <div className="overview-metrics">
              <div className="metric-card">
                <div className="metric-label">Compatibility Score</div>
                <div className="metric-value" style={{ color: scoreColor }}>{score}/100</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Risk Level</div>
                <div className="metric-value" style={{ color: RISK_LEVEL_COLOR[risks.overall_risk_level] }}>{risks.overall_risk_level.toUpperCase()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Agents Recommended</div>
                <div className="metric-value">{recommendations.recommendations?.length ?? 0}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Conflicts Detected</div>
                <div className="metric-value" style={{ color: conflicts.length > 0 ? '#BA7517' : '#1D9E75' }}>{conflicts.length}</div>
              </div>
            </div>

            <div className="overview-summary">
              <div className="section-label">Executive Summary</div>
              <p className="summary-text">{roadmap.executive_summary}</p>
            </div>

            <div className="overview-start">
              <div className="section-label">Start Here</div>
              <div className="start-here-card">
                <div className="start-here-icon">→</div>
                <div>
                  <div className="start-here-agent">{recommendations.start_here?.agent_id?.replace(/-/g, ' ')}</div>
                  <div className="start-here-reason">{recommendations.start_here?.one_liner}</div>
                </div>
              </div>
            </div>

            <div className="agent-pipeline-visual">
              <div className="section-label">Agent Pipeline — RAG · LangChain · ChromaDB</div>
              <div className="pipeline-row">
                {['Discovery Parser','Stack Compatibility','Use Case Matcher','Risk Flagger','Roadmap Orchestrator'].map((name, i) => (
                  <React.Fragment key={name}>
                    <div className="pipeline-node">
                      <div className="pipeline-num">{i + 1}</div>
                      <div className="pipeline-name">{name}</div>
                    </div>
                    {i < 4 && <div className="pipeline-arrow">→</div>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* COMPATIBILITY */}
        {tab === 'compatibility' && (
          <div>
            <div className="compat-summary-row">
              <div className="compat-stat" style={{ color: '#1D9E75' }}><span className="compat-stat-num">{compatibility.native_count}</span> Native</div>
              <div className="compat-stat" style={{ color: '#BA7517' }}><span className="compat-stat-num">{compatibility.custom_connector_count}</span> Custom Connector</div>
              <div className="compat-stat" style={{ color: '#A32D2D' }}><span className="compat-stat-num">{compatibility.blocker_count}</span> Blockers</div>
            </div>
            <p className="compat-summary-text">{compatibility.summary}</p>
            <div className="section-label" style={{ marginTop: '1.5rem' }}>Tool-by-Tool Matrix</div>
            <div className="compat-table">
              <div className="compat-table-header"><div>Category</div><div>Tool</div><div>Status</div><div>Notes</div></div>
              {compatibility.compatibility_matrix?.map((item, i) => (
                <div key={i} className="compat-table-row">
                  <div className="compat-category">{item.category}</div>
                  <div className="compat-tool">{item.tool}</div>
                  <div><span className={`status-badge ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</span></div>
                  <div className="compat-notes">{item.notes}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AGENTS */}
        {tab === 'agents' && (
          <div>
            <div className="section-label">Recommended WEGA Agents — Ranked by Priority</div>
            {recommendations.recommendations?.map(agent => (
              <div key={agent.agent_id} className="agent-card">
                <div className="agent-card-header">
                  <div className="agent-rank">#{agent.priority_rank}</div>
                  <div className="agent-card-name">{agent.agent_name}</div>
                  <div className="agent-card-phase">{agent.sdlc_phase}</div>
                  <span className="effort-badge" style={{ color: EFFORT_COLOR[agent.effort] }}>{agent.effort} effort</span>
                  <span className="roi-badge">ROI: {agent.expected_roi}</span>
                </div>
                <div className="agent-card-reason">{agent.reason}</div>
              </div>
            ))}
          </div>
        )}

        {/* RISKS */}
        {tab === 'risks' && (
          <div>
            <div className="risk-summary-row">
              <div className="risk-summary-badge risk-high">{risks.high_risk_count} High</div>
              <div className="risk-summary-badge risk-medium">{risks.medium_risk_count} Medium</div>
              <div className="risk-summary-badge risk-low">{risks.low_risk_count} Low</div>
              <div className="overall-risk" style={{ color: RISK_LEVEL_COLOR[risks.overall_risk_level] }}>Overall: {risks.overall_risk_level.toUpperCase()}</div>
            </div>
            <div className="section-label" style={{ marginTop: '1.5rem' }}>Risk Registry</div>
            {risks.risks?.map((risk, i) => (
              <div key={i} className={`risk-card ${SEVERITY_COLOR[risk.severity]}`}>
                <div className="risk-card-header">
                  <span className={`severity-dot ${SEVERITY_COLOR[risk.severity]}`} />
                  <div className="risk-title">{risk.title}</div>
                  <div className="risk-category">{risk.category}</div>
                </div>
                <div className="risk-description">{risk.description}</div>
                <div className="risk-mitigation"><span className="mitigation-label">Mitigation:</span> {risk.mitigation}</div>
              </div>
            ))}
          </div>
        )}

        {/* ROADMAP */}
        {tab === 'roadmap' && (
          <div>
            <div className="roadmap-start-box">
              <div className="section-label">First Action</div>
              <div className="roadmap-start-text">{roadmap.start_here}</div>
            </div>
            <div className="roadmap-phases">
              {roadmap.roadmap?.map(phase => (
                <div key={phase.phase} className="roadmap-phase">
                  <div className="roadmap-phase-header" style={{ borderColor: PHASE_COLOR[phase.phase] }}>
                    <div className="roadmap-phase-label" style={{ color: PHASE_COLOR[phase.phase] }}>{phase.phase}</div>
                    <div className="roadmap-phase-title">{phase.title}</div>
                    <div className="roadmap-metric">✓ {phase.success_metric}</div>
                  </div>
                  <div className="roadmap-phase-body">
                    <div className="roadmap-col">
                      <div className="roadmap-col-label">Actions</div>
                      <ul className="roadmap-actions">{phase.actions?.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    </div>
                    <div className="roadmap-col">
                      <div className="roadmap-col-label">Agents to Activate</div>
                      <div className="roadmap-agents">{phase.agents_to_activate?.map(a => <span key={a} className="agent-pill">{a}</span>)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

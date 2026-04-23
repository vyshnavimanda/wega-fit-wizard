import React, { useState } from 'react';

interface Props {
  report: any;
}

export default function ExportReport({ report }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);

    const { client_profile, compatibility, recommendations, risks, roadmap } = report;
    const conflicts = report.conflicts || [];
    const agentConfidence = report.agent_confidence || {};

    const scoreColor = (s: number) => s >= 75 ? '#1D9E75' : s >= 50 ? '#BA7517' : '#A32D2D';
    const riskColor: Record<string, string> = { green: '#1D9E75', yellow: '#BA7517', red: '#A32D2D' };
    const phaseColor: Record<string, string> = { '30-day': '#185FA5', '60-day': '#534AB7', '90-day': '#0F6E56' };

    const score = compatibility.overall_compatibility_score;
    const constraints = client_profile.deployment_constraint_tags?.filter((c: string) => c !== 'none') || [];

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>WEGA Fit Report — ${client_profile.company_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a18; background: #fff; font-size: 13px; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #0F6E56; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-icon { width: 36px; height: 36px; background: #0F6E56; color: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
  .logo-text { font-size: 16px; font-weight: 700; }
  .logo-sub { font-size: 11px; color: #888; }
  .report-date { font-size: 11px; color: #888; text-align: right; }
  .client-name { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
  .client-meta { font-size: 13px; color: #666; margin-bottom: 10px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
  .tag { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 4px; }
  .tag-compliance { background: #E6F1FB; color: #185FA5; }
  .tag-constraint { background: #FFF8F0; color: #854F0B; border: 1px solid #FAC775; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .metric { background: #f8f7f3; border-radius: 8px; padding: 14px; text-align: center; }
  .metric-label { font-size: 11px; color: #888; margin-bottom: 4px; }
  .metric-value { font-size: 22px; font-weight: 700; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e8e7e3; }
  .summary-box { background: #f8f7f3; border-radius: 8px; padding: 16px; line-height: 1.7; font-size: 13px; }
  .confidence-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .conf-item { text-align: center; }
  .conf-label { font-size: 10px; color: #888; margin-bottom: 3px; }
  .conf-score { font-size: 16px; font-weight: 700; }
  .conf-bar { height: 3px; background: #e8e7e3; border-radius: 2px; margin-top: 4px; overflow: hidden; }
  .conf-fill { height: 100%; border-radius: 2px; }
  .conflict-box { background: #FFF8F0; border: 1px solid #FAC775; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
  .conflict-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
  .badge-agent { background: #FAEEDA; color: #854F0B; }
  .badge-high { background: #FCEBEB; color: #A32D2D; }
  .conflict-msg { font-size: 12px; color: #555; margin-bottom: 4px; }
  .conflict-res { font-size: 12px; color: #333; }
  .conflict-res strong { color: #0F6E56; }
  .compat-table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; }
  .compat-table th { background: #f8f7f3; padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; }
  .compat-table td { padding: 10px 12px; border-top: 1px solid #f0efe9; font-size: 12px; }
  .status-native { background: #E1F5EE; color: #0F6E56; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
  .status-custom { background: #FAEEDA; color: #854F0B; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
  .status-blocker { background: #FCEBEB; color: #A32D2D; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
  .status-unknown { background: #F1EFE8; color: #5F5E5A; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
  .agent-card { border: 1px solid #e8e7e3; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
  .agent-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .agent-rank { width: 24px; height: 24px; background: #0F6E56; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
  .agent-name { font-size: 14px; font-weight: 600; flex: 1; }
  .agent-reason { font-size: 12px; color: #555; line-height: 1.5; }
  .risk-card { border-radius: 8px; padding: 14px; margin-bottom: 10px; border-left: 3px solid; }
  .risk-high { background: #fff8f8; border-color: #E24B4A; }
  .risk-medium { background: #fffcf5; border-color: #EF9F27; }
  .risk-low { background: #f6fbf8; border-color: #1D9E75; }
  .risk-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .risk-desc { font-size: 12px; color: #555; margin-bottom: 6px; line-height: 1.5; }
  .risk-mit { font-size: 12px; color: #333; line-height: 1.5; }
  .risk-mit strong { color: #0F6E56; }
  .phase { border: 1px solid #e8e7e3; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
  .phase-header { padding: 14px 16px; border-left: 4px solid; display: flex; align-items: center; gap: 12px; background: #fafaf8; }
  .phase-label { font-size: 12px; font-weight: 700; min-width: 55px; }
  .phase-title { font-size: 14px; font-weight: 600; flex: 1; }
  .phase-metric { font-size: 11px; color: #1D9E75; font-weight: 500; }
  .phase-body { display: grid; grid-template-columns: 1.5fr 1fr; padding: 14px 16px; gap: 16px; }
  .phase-col-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 8px; }
  .phase-actions { list-style: none; }
  .phase-actions li { font-size: 12px; color: #333; padding: 3px 0 3px 14px; position: relative; line-height: 1.4; }
  .phase-actions li:before { content: '→'; position: absolute; left: 0; color: #0F6E56; }
  .agent-pills { display: flex; flex-wrap: wrap; gap: 5px; }
  .agent-pill { background: #f0efe9; color: #333; font-size: 11px; padding: 3px 8px; border-radius: 12px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e8e7e3; display: flex; justify-content: space-between; color: #888; font-size: 11px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo">
      <div class="logo-icon">W</div>
      <div>
        <div class="logo-text">WEGA Fit Wizard</div>
        <div class="logo-sub">Client Deployment Intelligence · v2</div>
      </div>
    </div>
    <div class="report-date">
      <div>Assessment Report</div>
      <div>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      ${report.assessment_id ? `<div>ID: ${report.assessment_id}</div>` : ''}
    </div>
  </div>

  <!-- Client Info -->
  <div class="client-name">${client_profile.company_name}</div>
  <div class="client-meta">${client_profile.industry} &nbsp;·&nbsp; ${client_profile.team_size_raw} &nbsp;·&nbsp; ${client_profile.cloud_provider}</div>
  <div class="tags">
    ${client_profile.compliance_list?.map((c: string) => `<span class="tag tag-compliance">${c}</span>`).join('')}
    ${constraints.map((c: string) => `<span class="tag tag-constraint">⚠ ${c}</span>`).join('')}
  </div>

  <!-- Key Metrics -->
  <div class="metrics">
    <div class="metric">
      <div class="metric-label">Compatibility Score</div>
      <div class="metric-value" style="color:${scoreColor(score)}">${score}/100</div>
    </div>
    <div class="metric">
      <div class="metric-label">Risk Level</div>
      <div class="metric-value" style="color:${riskColor[risks.overall_risk_level]}">${risks.overall_risk_level.toUpperCase()}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Agents Recommended</div>
      <div class="metric-value">${recommendations.recommendations?.length ?? 0}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Conflicts Detected</div>
      <div class="metric-value" style="color:${conflicts.length > 0 ? '#BA7517' : '#1D9E75'}">${conflicts.length}</div>
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="summary-box">${roadmap.executive_summary}</div>
  </div>

  <!-- Agent Confidence -->
  <div class="section">
    <div class="section-title">Agent Confidence Scores — RAG · LangChain · ChromaDB</div>
    <div class="confidence-grid">
      ${Object.entries({
        'Discovery': agentConfidence.agent1_discovery,
        'Compatibility': agentConfidence.agent2_compatibility,
        'Matcher': agentConfidence.agent3_recommendations,
        'Risk Flagger': agentConfidence.agent4_risks,
        'Orchestrator': agentConfidence.agent5_roadmap
      }).map(([label, val]) => `
        <div class="conf-item">
          <div class="conf-label">${label}</div>
          <div class="conf-score" style="color:${scoreColor(val as number)}">${val}%</div>
          <div class="conf-bar"><div class="conf-fill" style="width:${val}%;background:${scoreColor(val as number)}"></div></div>
        </div>`).join('')}
    </div>
  </div>

  ${conflicts.length > 0 ? `
  <!-- Conflicts -->
  <div class="section">
    <div class="section-title">⚠ Agent Conflicts Detected (${conflicts.length})</div>
    ${conflicts.map((c: any) => `
      <div class="conflict-box">
        <div class="conflict-header">
          <span class="badge badge-agent">${c.agent}</span>
          <span class="badge badge-high">${c.severity.toUpperCase()}</span>
        </div>
        <div class="conflict-msg">${c.message}</div>
        <div class="conflict-res"><strong>Resolution:</strong> ${c.resolution}</div>
      </div>`).join('')}
  </div>` : ''}

  <!-- Compatibility Matrix -->
  <div class="section">
    <div class="section-title">Stack Compatibility Matrix</div>
    <table class="compat-table">
      <thead><tr><th>Category</th><th>Tool</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>
        ${compatibility.compatibility_matrix?.map((item: any) => `
          <tr>
            <td style="color:#888">${item.category}</td>
            <td style="font-weight:500">${item.tool}</td>
            <td><span class="status-${item.status}">${item.status === 'custom_connector' ? 'Custom Connector' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span></td>
            <td style="color:#666">${item.notes}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- Agent Recommendations -->
  <div class="section">
    <div class="section-title">Recommended WEGA Agents</div>
    ${recommendations.recommendations?.map((agent: any) => `
      <div class="agent-card">
        <div class="agent-header">
          <div class="agent-rank">#${agent.priority_rank}</div>
          <div class="agent-name">${agent.agent_name}</div>
          <span class="badge" style="background:#f0efe9;color:#555">${agent.sdlc_phase}</span>
          <span class="badge" style="background:#E1F5EE;color:#0F6E56">ROI: ${agent.expected_roi}</span>
        </div>
        <div class="agent-reason">${agent.reason}</div>
      </div>`).join('')}
  </div>

  <!-- Risk Registry -->
  <div class="section">
    <div class="section-title">Risk Registry — ${risks.high_risk_count} High · ${risks.medium_risk_count} Medium · ${risks.low_risk_count} Low</div>
    ${risks.risks?.map((risk: any) => `
      <div class="risk-card risk-${risk.severity}">
        <div class="risk-title">${risk.title} <span style="font-size:11px;color:#888;font-weight:400">[${risk.category}]</span></div>
        <div class="risk-desc">${risk.description}</div>
        <div class="risk-mit"><strong>Mitigation:</strong> ${risk.mitigation}</div>
      </div>`).join('')}
  </div>

  <!-- Roadmap -->
  <div class="section">
    <div class="section-title">30/60/90-Day Deployment Roadmap</div>
    <div style="background:#f8f7f3;border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:13px;font-weight:500">${roadmap.start_here}</div>
    ${roadmap.roadmap?.map((phase: any) => `
      <div class="phase">
        <div class="phase-header" style="border-color:${phaseColor[phase.phase]}">
          <div class="phase-label" style="color:${phaseColor[phase.phase]}">${phase.phase}</div>
          <div class="phase-title">${phase.title}</div>
          <div class="phase-metric">✓ ${phase.success_metric}</div>
        </div>
        <div class="phase-body">
          <div>
            <div class="phase-col-title">Actions</div>
            <ul class="phase-actions">${phase.actions?.map((a: string) => `<li>${a}</li>`).join('')}</ul>
          </div>
          <div>
            <div class="phase-col-title">Agents to Activate</div>
            <div class="agent-pills">${phase.agents_to_activate?.map((a: string) => `<span class="agent-pill">${a}</span>`).join('')}</div>
          </div>
        </div>
      </div>`).join('')}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>WEGA Fit Wizard — Client Deployment Intelligence · Powered by RAG + LangChain + ChromaDB</div>
    <div>Wipro · ${new Date().getFullYear()}</div>
  </div>

</div>
<script>window.onload = () => window.print()</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onafterprint = () => URL.revokeObjectURL(url);
    }
    setTimeout(() => setExporting(false), 2000);
  };

  return (
    <button
      className="btn-export"
      onClick={handleExport}
      disabled={exporting}
      title="Export as PDF"
    >
      {exporting ? 'Preparing...' : '↓ Export PDF'}
    </button>
  );
}

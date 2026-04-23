import React, { useState } from 'react';
import { ClientIntakeForm } from '../types';

interface Props {
  onSubmit: (form: ClientIntakeForm) => void;
}

const INDUSTRIES = ['Healthcare', 'Financial Services', 'Retail / E-commerce', 'Telecommunications', 'Manufacturing', 'Government / Public Sector', 'Technology / SaaS', 'Insurance', 'Energy / Utilities', 'Other'];
const CLOUD_PROVIDERS = ['Azure', 'AWS', 'GCP', 'Multi-cloud (Azure + AWS)', 'Multi-cloud (AWS + GCP)', 'On-premise only', 'Hybrid (Cloud + On-prem)'];
const TEAM_SIZES = ['1–10 engineers', '11–25 engineers', '26–50 engineers', '51–100 engineers', '100–250 engineers', '250+ engineers'];

const CONSTRAINT_OPTIONS = [
  { value: 'none', label: 'None — standard environment', icon: '✓' },
  { value: 'air-gapped', label: 'Air-gapped (no internet access)', icon: '🔒' },
  { value: 'no-install-rights', label: 'No software install rights', icon: '⛔' },
  { value: 'on-premise-only', label: 'On-premise only (no cloud)', icon: '🏢' },
  { value: 'data-sovereignty', label: 'Data sovereignty (data cannot leave country)', icon: '🌐' },
  { value: 'no-cloud-apis', label: 'No external API calls allowed', icon: '🚫' },
  { value: 'restricted-firewall', label: 'Restricted firewall / blocked ports', icon: '🔥' },
  { value: 'no-admin-rights', label: 'No admin / root rights', icon: '🔑' },
];

const SAMPLE_STANDARD: ClientIntakeForm = {
  company_name: 'MediCore Health Systems',
  industry: 'Healthcare',
  team_size: '51–100 engineers',
  cloud_provider: 'Azure',
  source_control: 'GitHub',
  ci_cd_tools: 'GitHub Actions, Jenkins',
  project_management: 'Jira',
  security_tools: 'Snyk, SonarQube',
  monitoring_tools: 'Datadog, Azure Monitor',
  compliance_requirements: 'HIPAA, SOC2',
  deployment_constraints: 'none',
  current_pain_points: 'Slow release cycles (2-week sprints but deploys take 3 days), security vulnerabilities discovered late in the cycle, manual code reviews creating bottlenecks',
  primary_goal: 'Accelerate deployment frequency from monthly to weekly while maintaining HIPAA compliance',
};

const SAMPLE_AIRGAPPED: ClientIntakeForm = {
  company_name: 'DefenseWorks Federal',
  industry: 'Government / Public Sector',
  team_size: '26–50 engineers',
  cloud_provider: 'On-premise only',
  source_control: 'GitLab',
  ci_cd_tools: 'Jenkins',
  project_management: 'Jira',
  security_tools: 'Fortify',
  monitoring_tools: 'Grafana',
  compliance_requirements: 'FedRAMP, SOC2',
  deployment_constraints: 'air-gapped, no-install-rights, data-sovereignty',
  current_pain_points: 'Manual code reviews take weeks, no automated security scanning in pipeline, release process requires 3 approvals and takes 10+ days',
  primary_goal: 'Automate code review and security scanning entirely within our air-gapped environment with no external API dependencies',
};

const SAMPLE_EARLY: ClientIntakeForm = {
  company_name: 'Apex Manufacturing Ltd.',
  industry: 'Manufacturing',
  team_size: '51–100 engineers',
  cloud_provider: 'Azure',
  source_control: 'Perforce',
  ci_cd_tools: 'Bamboo',
  project_management: 'Rally',
  security_tools: 'Fortify',
  monitoring_tools: 'Dynatrace',
  compliance_requirements: 'none',
  deployment_constraints: 'restricted-firewall',
  current_pain_points: 'Legacy toolchain with no cloud-native integrations, builds take 4+ hours, no automated code review in place',
  primary_goal: 'Modernize our CI/CD pipeline and introduce automated code review — we are early in our DevOps journey and want to start simple',
};

const EMPTY: ClientIntakeForm = {
  company_name: '', industry: '', team_size: '', cloud_provider: '',
  source_control: '', ci_cd_tools: '', project_management: '',
  security_tools: '', monitoring_tools: '', compliance_requirements: '',
  deployment_constraints: '', current_pain_points: '', primary_goal: '',
};

export default function IntakeForm({ onSubmit }: Props) {
  const [form, setForm] = useState<ClientIntakeForm>(EMPTY);
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([]);

  const set = (key: keyof ClientIntakeForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleConstraint = (value: string) => {
    let updated: string[];
    if (value === 'none') {
      updated = ['none'];
    } else {
      const without = selectedConstraints.filter(c => c !== 'none');
      updated = without.includes(value)
        ? without.filter(c => c !== value)
        : [...without, value];
      if (updated.length === 0) updated = ['none'];
    }
    setSelectedConstraints(updated);
    setForm(f => ({ ...f, deployment_constraints: updated.join(', ') }));
  };

  const loadSample = (sample: ClientIntakeForm) => {
    setForm(sample);
    const constraints = sample.deployment_constraints.split(',').map(s => s.trim()).filter(Boolean);
    setSelectedConstraints(constraints);
  };

  const isValid = Object.values(form).every((v) => v.trim() !== '') && selectedConstraints.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onSubmit(form);
  };

  return (
    <div className="form-page">
      <div className="form-hero">
        <div className="form-hero-badge">5-Agent Pipeline</div>
        <h1 className="form-hero-title">WEGA Deployment Assessment</h1>
        <p className="form-hero-sub">
          Enter your client's environment details. Our 5-agent system will analyze compatibility,
          recommend the right WEGA agents, identify risks, and generate a personalized deployment roadmap.
        </p>
        <div className="sample-buttons">
          <button type="button" className="btn-sample" onClick={() => loadSample(SAMPLE_STANDARD)}>
            Load sample: MediCore Health (standard) →
          </button>
          <button type="button" className="btn-sample btn-sample-warning" onClick={() => loadSample(SAMPLE_AIRGAPPED)}>
            Load sample: DefenseWorks Federal (air-gapped) →
          </button>
          <button type="button" className="btn-sample" onClick={() => loadSample(SAMPLE_EARLY)} style={{color:'#534AB7'}}>
            Load sample: Apex Manufacturing (legacy stack, 2–3 agents) →
          </button>
        </div>
      </div>

      <form className="intake-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-title">Company Overview</div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Company Name</label>
              <input type="text" placeholder="Acme Corp" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Industry</label>
              <select value={form.industry} onChange={(e) => set('industry', e.target.value)}>
                <option value="">Select industry</option>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Engineering Team Size</label>
              <select value={form.team_size} onChange={(e) => set('team_size', e.target.value)}>
                <option value="">Select team size</option>
                {TEAM_SIZES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Cloud Provider</label>
              <select value={form.cloud_provider} onChange={(e) => set('cloud_provider', e.target.value)}>
                <option value="">Select cloud</option>
                {CLOUD_PROVIDERS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Current Toolchain</div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Source Control</label>
              <input type="text" placeholder="e.g. GitHub, GitLab, Bitbucket" value={form.source_control} onChange={(e) => set('source_control', e.target.value)} />
            </div>
            <div className="form-field">
              <label>CI/CD Tools</label>
              <input type="text" placeholder="e.g. GitHub Actions, Jenkins" value={form.ci_cd_tools} onChange={(e) => set('ci_cd_tools', e.target.value)} />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Project Management</label>
              <input type="text" placeholder="e.g. Jira, Linear, Azure Boards" value={form.project_management} onChange={(e) => set('project_management', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Security Tools</label>
              <input type="text" placeholder="e.g. Snyk, SonarQube, Checkmarx" value={form.security_tools} onChange={(e) => set('security_tools', e.target.value)} />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Monitoring & Observability</label>
              <input type="text" placeholder="e.g. Datadog, Grafana, Splunk" value={form.monitoring_tools} onChange={(e) => set('monitoring_tools', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Compliance Requirements</label>
              <input type="text" placeholder="e.g. HIPAA, SOC2, GDPR, none" value={form.compliance_requirements} onChange={(e) => set('compliance_requirements', e.target.value)} />
            </div>
          </div>
        </div>

        {/* NEW SECTION — Deployment Constraints */}
        <div className="form-section">
          <div className="form-section-title">
            Deployment Environment Constraints
            <span className="section-title-badge">Critical for FDE planning</span>
          </div>
          <p className="constraints-hint">
            Select all constraints that apply to this client's environment. These directly affect
            how WEGA agents are deployed and what risks the FDE will face on day one.
          </p>
          <div className="constraints-grid">
            {CONSTRAINT_OPTIONS.map((opt) => {
              const isSelected = selectedConstraints.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  className={`constraint-chip ${isSelected ? 'selected' : ''} ${opt.value === 'none' ? 'chip-none' : 'chip-warning'}`}
                  onClick={() => toggleConstraint(opt.value)}
                >
                  <span className="chip-icon">{opt.icon}</span>
                  <span className="chip-label">{opt.label}</span>
                  {isSelected && <span className="chip-check">✓</span>}
                </div>
              );
            })}
          </div>
          {selectedConstraints.some(c => c !== 'none') && (
            <div className="constraints-warning">
              ⚠ Constrained environment detected — the Risk Flagger agent will analyze
              each constraint and generate specific FDE deployment mitigations.
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="form-section-title">Goals & Pain Points</div>
          <div className="form-field">
            <label>Current Pain Points</label>
            <textarea rows={3} placeholder="e.g. Slow deployments, security vulnerabilities found late..." value={form.current_pain_points} onChange={(e) => set('current_pain_points', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Primary Goal with WEGA</label>
            <textarea rows={2} placeholder="e.g. Increase deployment frequency, reduce security incidents..." value={form.primary_goal} onChange={(e) => set('primary_goal', e.target.value)} />
          </div>
        </div>

        <div className="form-submit-row">
          <div className="form-submit-hint">
            {isValid ? '✓ All fields complete — ready to analyze' : 'Complete all fields to run analysis'}
          </div>
          <button type="submit" className="btn-primary" disabled={!isValid}>
            Run 5-Agent Analysis →
          </button>
        </div>
      </form>
    </div>
  );
}

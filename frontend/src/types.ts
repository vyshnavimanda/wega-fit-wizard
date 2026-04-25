export interface ClientIntakeForm {
  company_name: string;
  industry: string;
  team_size: string;
  cloud_provider: string;
  source_control: string;
  ci_cd_tools: string;
  project_management: string;
  security_tools: string;
  monitoring_tools: string;
  compliance_requirements: string;
  deployment_constraints: string;
  current_pain_points: string;
  primary_goal: string;
}

export interface CompatibilityItem {
  category: string;
  tool: string;
  status: 'native' | 'custom_connector' | 'blocker' | 'unknown';
  notes: string;
}

export interface AgentRecommendation {
  agent_id: string;
  agent_name: string;
  priority_rank: number;
  reason: string;
  effort: string;
  expected_roi: string;
  sdlc_phase: string;
}

export interface RiskItem {
  category: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export interface RoadmapPhase {
  phase: string;
  title: string;
  actions: string[];
  agents_to_activate: string[];
  success_metric: string;
}

export interface CoreFitReport {
  client_profile: any;
  compatibility: {
    compatibility_matrix: CompatibilityItem[];
    overall_compatibility_score: number;
    native_count: number;
    custom_connector_count: number;
    blocker_count: number;
    summary: string;
  };
  recommendations: {
    recommendations: AgentRecommendation[];
    start_here: { agent_id: string; one_liner: string };
  };
  risks: {
    risks: RiskItem[];
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    overall_risk_level: 'green' | 'yellow' | 'red';
  };
  roadmap: {
    roadmap: RoadmapPhase[];
    executive_summary: string;
    start_here: string;
  };
}
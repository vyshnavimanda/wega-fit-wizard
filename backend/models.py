from pydantic import BaseModel
from typing import List, Optional

class ClientIntakeForm(BaseModel):
    company_name: str
    industry: str
    team_size: str
    cloud_provider: str
    source_control: str
    ci_cd_tools: str
    project_management: str
    security_tools: str
    monitoring_tools: str
    compliance_requirements: str
    deployment_constraints: str   # NEW — air-gap, no-install, on-prem, etc.
    current_pain_points: str
    primary_goal: str

class CompatibilityItem(BaseModel):
    category: str
    tool: str
    status: str
    notes: str

class AgentRecommendation(BaseModel):
    agent_id: str
    agent_name: str
    reason: str
    effort: str
    expected_roi: str
    sdlc_phase: str
    priority_rank: int

class RiskItem(BaseModel):
    category: str
    title: str
    severity: str
    description: str
    mitigation: str

class RoadmapPhase(BaseModel):
    phase: str
    title: str
    actions: List[str]
    agents_to_activate: List[str]
    success_metric: str

class CoreFitReport(BaseModel):
    client_profile: dict
    compatibility_matrix: List[CompatibilityItem]
    overall_compatibility_score: int
    agent_recommendations: List[AgentRecommendation]
    risk_registry: List[RiskItem]
    roadmap: List[RoadmapPhase]
    executive_summary: str
    start_here: str

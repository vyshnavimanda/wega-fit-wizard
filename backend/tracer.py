"""
Agent Tracer
------------
Captures real-time reasoning events from each agent:
- Which RAG documents were retrieved and their relevance scores
- What the agent decided / output summary
- Confidence score
- Any warnings or conflicts

Events are queued and streamed via SSE to the frontend.
"""

import json
import asyncio
from datetime import datetime
from typing import Optional

class AgentTrace:
    """Holds the complete trace for one agent run."""
    def __init__(self, agent_num: int, agent_name: str):
        self.agent_num = agent_num
        self.agent_name = agent_name
        self.status = "pending"  # pending, running, complete, error
        self.started_at: Optional[str] = None
        self.completed_at: Optional[str] = None
        self.rag_query: Optional[str] = None
        self.rag_docs: list = []
        self.output_summary: Optional[str] = None
        self.confidence: Optional[int] = None
        self.key_findings: list = []
        self.warnings: list = []
        self.duration_ms: Optional[int] = None
        self._start_time: Optional[float] = None

    def start(self):
        import time
        self.status = "running"
        self.started_at = datetime.now().isoformat()
        self._start_time = time.time()

    def complete(self, confidence: int = None, output_summary: str = None):
        import time
        self.status = "complete"
        self.completed_at = datetime.now().isoformat()
        if self._start_time:
            self.duration_ms = int((time.time() - self._start_time) * 1000)
        if confidence:
            self.confidence = confidence
        if output_summary:
            self.output_summary = output_summary

    def add_rag_result(self, query: str, docs: list):
        self.rag_query = query
        self.rag_docs = docs

    def add_finding(self, finding: str):
        self.key_findings.append(finding)

    def add_warning(self, warning: str):
        self.warnings.append(warning)

    def to_dict(self) -> dict:
        return {
            "agent_num": self.agent_num,
            "agent_name": self.agent_name,
            "status": self.status,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "rag_query": self.rag_query,
            "rag_docs": self.rag_docs,
            "output_summary": self.output_summary,
            "confidence": self.confidence,
            "key_findings": self.key_findings,
            "warnings": self.warnings,
            "duration_ms": self.duration_ms,
        }


class PipelineTracer:
    """Manages traces for a full pipeline run. Thread-safe event queue."""
    def __init__(self):
        self.traces: list[AgentTrace] = []
        self.events: list[dict] = []
        self.current_agent: Optional[AgentTrace] = None
        self.conflicts: list = []
        self.pipeline_status = "running"

    def start_agent(self, num: int, name: str) -> AgentTrace:
        trace = AgentTrace(num, name)
        trace.start()
        self.traces.append(trace)
        self.current_agent = trace
        self._emit("agent_start", {"agent_num": num, "agent_name": name})
        return trace

    def complete_agent(self, trace: AgentTrace, confidence: int = None, summary: str = None):
        trace.complete(confidence, summary)
        self._emit("agent_complete", trace.to_dict())

    def emit_rag(self, trace: AgentTrace, query: str, docs: list):
        trace.add_rag_result(query, docs)
        self._emit("rag_result", {
            "agent_num": trace.agent_num,
            "query": query,
            "docs": docs
        })

    def emit_finding(self, trace: AgentTrace, finding: str):
        trace.add_finding(finding)
        self._emit("finding", {
            "agent_num": trace.agent_num,
            "finding": finding
        })

    def emit_conflict(self, conflict: dict):
        self.conflicts.append(conflict)
        self._emit("conflict", conflict)

    def emit_complete(self, assessment_id: str):
        self.pipeline_status = "complete"
        self._emit("pipeline_complete", {"assessment_id": assessment_id})

    def emit_error(self, error: str):
        self.pipeline_status = "error"
        self._emit("pipeline_error", {"error": error})

    def _emit(self, event_type: str, data: dict):
        self.events.append({
            "type": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        })

    def get_all_events(self) -> list:
        return self.events.copy()


# Global tracer instance per request — stored by request ID
_active_tracers: dict[str, PipelineTracer] = {}

def create_tracer(request_id: str) -> PipelineTracer:
    tracer = PipelineTracer()
    _active_tracers[request_id] = tracer
    return tracer

def get_tracer(request_id: str) -> Optional[PipelineTracer]:
    return _active_tracers.get(request_id)

def remove_tracer(request_id: str):
    _active_tracers.pop(request_id, None)

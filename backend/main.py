import json
import time
import uuid
import asyncio
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from models import ClientIntakeForm
from agents_v2 import (
    agent1_discovery_parser,
    agent2_stack_compatibility,
    agent3_use_case_matcher,
    agent4_risk_flagger,
    agent5_roadmap_orchestrator,
    detect_conflicts
)
from history_store import (
    save_assessment,
    get_all_assessments,
    get_assessment_by_id,
    search_assessments,
    get_dashboard_stats
)
from tracer import create_tracer, get_tracer, remove_tracer
import traceback
from concurrent.futures import ThreadPoolExecutor
import threading

app = FastAPI(title="WEGA Fit Wizard API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=4)
_completed_reports: dict = {}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "2.0",
        "features": ["RAG", "LangChain", "ChromaDB", "Live Trace", "Confidence Scores", "Conflict Detection"]
    }


def run_pipeline(request_id: str, form: ClientIntakeForm):
    """Run the full 5-agent pipeline in a background thread."""
    tracer = get_tracer(request_id)
    try:
        print(f"\n{'='*50}\n▶ {form.company_name} [{request_id}]\n{'='*50}")

        client_profile = agent1_discovery_parser(form, tracer)
        time.sleep(3)

        compatibility = agent2_stack_compatibility(client_profile, tracer)
        time.sleep(3)

        recommendations = agent3_use_case_matcher(client_profile, compatibility, tracer)
        time.sleep(3)

        risks = agent4_risk_flagger(client_profile, compatibility, tracer)
        time.sleep(3)

        conflicts = detect_conflicts(recommendations, risks, tracer)

        roadmap_output = agent5_roadmap_orchestrator(
            client_profile, compatibility, recommendations, risks, conflicts, tracer
        )

        report = {
            "client_profile": client_profile,
            "compatibility": compatibility,
            "recommendations": recommendations,
            "risks": risks,
            "conflicts": conflicts,
            "roadmap": roadmap_output,
            "agent_confidence": {
                "agent1_discovery": client_profile.get("confidence_score", 0),
                "agent2_compatibility": compatibility.get("confidence_score", 0),
                "agent3_recommendations": recommendations.get("confidence_score", 0),
                "agent4_risks": risks.get("confidence_score", 0),
                "agent5_roadmap": roadmap_output.get("confidence_score", 0),
            }
        }

        assessment_id = save_assessment(report)
        report["assessment_id"] = assessment_id
        _completed_reports[request_id] = report

        tracer.emit_complete(assessment_id)
        print(f"✅ Complete [{request_id}] → {assessment_id}")

    except Exception as e:
        traceback.print_exc()
        if tracer:
            tracer.emit_error(str(e))
        _completed_reports[request_id] = {"error": str(e)}


@app.post("/api/analyze/stream")
async def analyze_stream(form: ClientIntakeForm):
    """
    SSE endpoint — streams live agent trace events as the pipeline runs.
    Frontend connects here to get real-time progress.
    """
    request_id = str(uuid.uuid4())[:8]
    tracer = create_tracer(request_id)

    # Start pipeline in background thread
    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, run_pipeline, request_id, form)

    async def event_stream():
        # Send request_id first so frontend knows how to fetch the final report
        yield f"data: {json.dumps({'type': 'request_id', 'data': {'request_id': request_id}})}\n\n"

        sent_count = 0
        max_wait = 300  # 5 minute timeout

        for _ in range(max_wait * 10):  # check every 100ms
            await asyncio.sleep(0.1)
            events = tracer.get_all_events()

            # Send any new events
            while sent_count < len(events):
                event = events[sent_count]
                yield f"data: {json.dumps(event)}\n\n"
                sent_count += 1

                # If pipeline complete or error, flush and stop
                if event["type"] in ("pipeline_complete", "pipeline_error"):
                    await asyncio.sleep(0.2)
                    return

        yield f"data: {json.dumps({'type': 'pipeline_error', 'data': {'error': 'Timeout'}})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )


@app.get("/api/analyze/result/{request_id}")
async def get_result(request_id: str):
    """Fetch the completed report after SSE stream signals pipeline_complete."""
    if request_id not in _completed_reports:
        raise HTTPException(status_code=404, detail="Result not ready yet")
    report = _completed_reports.pop(request_id)
    remove_tracer(request_id)
    if "error" in report:
        raise HTTPException(status_code=500, detail=report["error"])
    return report


# Keep the original non-streaming endpoint as fallback
@app.post("/api/analyze")
async def analyze_client(form: ClientIntakeForm):
    try:
        from tracer import PipelineTracer
        tracer = PipelineTracer()

        client_profile = agent1_discovery_parser(form, tracer)
        time.sleep(3)
        compatibility = agent2_stack_compatibility(client_profile, tracer)
        time.sleep(3)
        recommendations = agent3_use_case_matcher(client_profile, compatibility, tracer)
        time.sleep(3)
        risks = agent4_risk_flagger(client_profile, compatibility, tracer)
        time.sleep(3)
        conflicts = detect_conflicts(recommendations, risks, tracer)
        roadmap_output = agent5_roadmap_orchestrator(
            client_profile, compatibility, recommendations, risks, conflicts, tracer
        )

        report = {
            "client_profile": client_profile,
            "compatibility": compatibility,
            "recommendations": recommendations,
            "risks": risks,
            "conflicts": conflicts,
            "roadmap": roadmap_output,
            "agent_confidence": {
                "agent1_discovery": client_profile.get("confidence_score", 0),
                "agent2_compatibility": compatibility.get("confidence_score", 0),
                "agent3_recommendations": recommendations.get("confidence_score", 0),
                "agent4_risks": risks.get("confidence_score", 0),
                "agent5_roadmap": roadmap_output.get("confidence_score", 0),
            }
        }
        assessment_id = save_assessment(report)
        report["assessment_id"] = assessment_id
        return report

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Agent JSON parse error: {str(e)}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Agent pipeline error: {str(e)}")


# Dashboard endpoints
@app.get("/api/dashboard/stats")
def dashboard_stats():
    return get_dashboard_stats()

@app.get("/api/dashboard/assessments")
def list_assessments():
    return {"assessments": get_all_assessments()}

@app.get("/api/dashboard/assessments/{assessment_id}")
def get_assessment(assessment_id: str):
    report = get_assessment_by_id(assessment_id)
    if not report:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return report

@app.get("/api/dashboard/search")
def search(q: str):
    return {"results": search_assessments(q), "query": q}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

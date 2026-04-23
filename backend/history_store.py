"""
Assessment History Store
------------------------
Saves every completed assessment to ChromaDB.
Powers the dashboard: past runs, trends, searchable history.
"""

import json
import os
import uuid
import chromadb
from google import genai as google_genai
from datetime import datetime

def _get_embedding(text: str) -> list:
    client = google_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    result = client.models.embed_content(model="gemini-embedding-001", contents=text)
    return result.embeddings[0].values

HISTORY_PATH = "./chroma_history"
HISTORY_COLLECTION = "assessments"


def get_history_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=HISTORY_PATH)
    existing = [c.name for c in client.list_collections()]
    if HISTORY_COLLECTION in existing:
        return client.get_collection(HISTORY_COLLECTION)
    return client.create_collection(HISTORY_COLLECTION, metadata={"hnsw:space": "cosine"})


def save_assessment(report: dict) -> str:
    """Save a completed assessment. Returns the assessment ID."""
    collection = get_history_collection()
    assessment_id = str(uuid.uuid4())[:8]

    profile = report.get("client_profile", {})
    compatibility = report.get("compatibility", {})
    risks = report.get("risks", {})

    # Text for semantic search (so you can search "air-gapped healthcare clients")
    search_text = (
        f"{profile.get('company_name', '')} {profile.get('industry', '')} "
        f"{profile.get('cloud_provider', '')} "
        f"{' '.join(profile.get('compliance_list', []))} "
        f"{' '.join(profile.get('deployment_constraint_tags', []))} "
        f"{profile.get('primary_goal', '')}"
    )

    metadata = {
        "assessment_id": assessment_id,
        "timestamp": datetime.now().isoformat(),
        "company_name": profile.get("company_name", "Unknown"),
        "industry": profile.get("industry", "Unknown"),
        "cloud_provider": profile.get("cloud_provider", "Unknown"),
        "team_size": profile.get("team_size_raw", "Unknown"),
        "compatibility_score": compatibility.get("overall_compatibility_score", 0),
        "risk_level": risks.get("overall_risk_level", "unknown"),
        "high_risk_count": risks.get("high_risk_count", 0),
        "medium_risk_count": risks.get("medium_risk_count", 0),
        "constraints": ", ".join(profile.get("deployment_constraint_tags", ["none"])),
        "full_report": json.dumps(report)  # store full report as JSON string
    }

    embedding = _get_embedding(search_text)
    collection.add(
        ids=[assessment_id],
        documents=[search_text],
        metadatas=[metadata],
        embeddings=[embedding]
    )
    return assessment_id


def get_all_assessments() -> list[dict]:
    """Get all saved assessments for the dashboard."""
    collection = get_history_collection()
    if collection.count() == 0:
        return []

    results = collection.get(include=["metadatas"])
    assessments = []
    for meta in results["metadatas"]:
        assessments.append({
            "assessment_id": meta["assessment_id"],
            "timestamp": meta["timestamp"],
            "company_name": meta["company_name"],
            "industry": meta["industry"],
            "cloud_provider": meta["cloud_provider"],
            "team_size": meta["team_size"],
            "compatibility_score": meta["compatibility_score"],
            "risk_level": meta["risk_level"],
            "high_risk_count": meta["high_risk_count"],
            "medium_risk_count": meta["medium_risk_count"],
            "constraints": meta["constraints"],
        })

    # Sort by timestamp descending
    assessments.sort(key=lambda x: x["timestamp"], reverse=True)
    return assessments


def get_assessment_by_id(assessment_id: str) -> dict | None:
    """Get a full report by ID."""
    collection = get_history_collection()
    try:
        results = collection.get(ids=[assessment_id], include=["metadatas"])
        if results["metadatas"]:
            return json.loads(results["metadatas"][0]["full_report"])
    except Exception:
        pass
    return None


def search_assessments(query: str, n: int = 5) -> list[dict]:
    """Semantic search over past assessments."""
    collection = get_history_collection()
    if collection.count() == 0:
        return []
    query_embedding = _get_embedding(query)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(n, collection.count()),
        include=["metadatas", "distances"]
    )
    found = []
    for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
        found.append({
            "assessment_id": meta["assessment_id"],
            "company_name": meta["company_name"],
            "industry": meta["industry"],
            "compatibility_score": meta["compatibility_score"],
            "risk_level": meta["risk_level"],
            "constraints": meta["constraints"],
            "relevance": round((1 - dist) * 100, 1),
            "timestamp": meta["timestamp"],
        })
    return found


def get_dashboard_stats() -> dict:
    """Aggregate stats for the dashboard overview."""
    assessments = get_all_assessments()
    if not assessments:
        return {
            "total_assessments": 0,
            "avg_compatibility_score": 0,
            "high_risk_count": 0,
            "constrained_environments": 0,
            "industry_breakdown": {},
            "risk_breakdown": {"green": 0, "yellow": 0, "red": 0},
            "recent": []
        }

    scores = [a["compatibility_score"] for a in assessments]
    industries: dict = {}
    risk_breakdown = {"green": 0, "yellow": 0, "red": 0}
    constrained = 0

    for a in assessments:
        industries[a["industry"]] = industries.get(a["industry"], 0) + 1
        risk_breakdown[a["risk_level"]] = risk_breakdown.get(a["risk_level"], 0) + 1
        if a["constraints"] and a["constraints"] != "none":
            constrained += 1

    return {
        "total_assessments": len(assessments),
        "avg_compatibility_score": round(sum(scores) / len(scores)),
        "high_risk_clients": sum(1 for a in assessments if a["high_risk_count"] > 0),
        "constrained_environments": constrained,
        "industry_breakdown": industries,
        "risk_breakdown": risk_breakdown,
        "recent": assessments[:5]
    }
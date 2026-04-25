"""
RAG Store — CORE Knowledge Base as a Vector Database
-----------------------------------------------------
Uses ChromaDB with Google Gemini embeddings (google.genai package).
Provides semantic search for agents to retrieve relevant CORE knowledge.
"""

import json
import os
import chromadb
from google import genai as google_genai

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "core_knowledge"

def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings using Google Gemini embedding model."""
    client = google_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    embeddings = []
    for text in texts:
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text
        )
        embeddings.append(result.embeddings[0].values)
    return embeddings


def build_knowledge_documents(knowledge: dict) -> list[dict]:
    """Convert CORE knowledge JSON into documents for embedding."""
    docs = []

    for category, data in knowledge["integrations"].items():
        for status in ["native", "custom_connector", "blocker"]:
            tools = data.get(status, [])
            if tools:
                docs.append({
                    "id": f"integration_{category}_{status}",
                    "text": f"CORE {category} integration — {status}: {', '.join(tools)}. "
                            f"These tools {status.replace('_', ' ')} with CORE.",
                    "metadata": {"type": "integration", "category": category, "status": status}
                })

    for agent in knowledge["core_agents"]:
        best_for = ", ".join(agent.get("best_for", []))
        requires = ", ".join(agent.get("requires", []))
        docs.append({
            "id": f"agent_{agent['id']}",
            "text": f"CORE Agent: {agent['name']}. {agent['description']}. "
                    f"Best for: {best_for}. Requires: {requires}. "
                    f"Effort: {agent['effort']}. ROI: {agent['expected_roi']}. Phase: {agent['sdlc_phase']}.",
            "metadata": {"type": "agent", "agent_id": agent["id"], "agent_name": agent["name"],
                         "effort": agent["effort"], "expected_roi": agent["expected_roi"], "sdlc_phase": agent["sdlc_phase"]}
        })

    for framework, data in knowledge["compliance_map"].items():
        docs.append({
            "id": f"compliance_{framework}",
            "text": f"Compliance {framework}: {data['notes']}. "
                    f"Cloud: {', '.join(data['cloud_requirements'])}. "
                    f"Data residency: {data['data_residency']}.",
            "metadata": {"type": "compliance", "framework": framework}
        })

    for size, data in knowledge["team_size_guidance"].items():
        docs.append({
            "id": f"team_size_{size}",
            "text": f"For {size} teams ({data['range']} engineers): {data['notes']}. "
                    f"Start with: {', '.join(data['recommended_start'])}.",
            "metadata": {"type": "team_guidance", "size_bucket": size}
        })

    constraint_docs = [
        {"id": "constraint_air_gapped",
         "text": "Air-gapped: No internet. CORE external API calls fail. Use local model hosting (Ollama/vLLM). Bundle all dependencies offline. Severity HIGH.",
         "metadata": {"type": "constraint", "constraint": "air-gapped", "severity": "high"}},
        {"id": "constraint_no_install",
         "text": "No install rights: Cannot install packages. Pre-approve package lists with IT admin. Use portable Python or Docker. Severity HIGH.",
         "metadata": {"type": "constraint", "constraint": "no-install-rights", "severity": "high"}},
        {"id": "constraint_on_prem",
         "text": "On-premise only: No cloud. CORE runs on client infrastructure. Needs GPU for local models. Severity HIGH.",
         "metadata": {"type": "constraint", "constraint": "on-premise-only", "severity": "high"}},
        {"id": "constraint_data_sovereignty",
         "text": "Data sovereignty: Data cannot leave country. No US-based LLM APIs. Use regional endpoints or local models. Severity HIGH.",
         "metadata": {"type": "constraint", "constraint": "data-sovereignty", "severity": "high"}},
        {"id": "constraint_no_cloud_apis",
         "text": "No external APIs: Firewall blocks outbound API calls. Whitelist specific IPs or use local inference. Severity MEDIUM.",
         "metadata": {"type": "constraint", "constraint": "no-cloud-apis", "severity": "medium"}},
        {"id": "constraint_firewall",
         "text": "Restricted firewall: Ports/protocols blocked. Coordinate with network team for firewall rules. Severity MEDIUM.",
         "metadata": {"type": "constraint", "constraint": "restricted-firewall", "severity": "medium"}},
    ]
    docs.extend(constraint_docs)
    return docs


def initialize_vector_store(knowledge: dict):
    """Build or load ChromaDB vector store with CORE knowledge."""
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    existing = [c.name for c in client.list_collections()]

    if COLLECTION_NAME in existing:
        collection = client.get_collection(name=COLLECTION_NAME)
        if collection.count() > 0:
            print(f"✓ RAG store loaded — {collection.count()} documents")
            return collection
        client.delete_collection(COLLECTION_NAME)

    print("⚙ Building RAG vector store with Gemini embeddings...")
    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )

    docs = build_knowledge_documents(knowledge)
    texts = [d["text"] for d in docs]

    print(f"  Embedding {len(docs)} documents...")
    # Batch embed to avoid rate limits
    all_embeddings = []
    batch_size = 5
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        embeddings = get_embeddings(batch)
        all_embeddings.extend(embeddings)
        print(f"  Embedded {min(i+batch_size, len(texts))}/{len(docs)}...")

    collection.add(
        ids=[d["id"] for d in docs],
        documents=[d["text"] for d in docs],
        metadatas=[d["metadata"] for d in docs],
        embeddings=all_embeddings
    )
    print(f"✓ RAG store built — {len(docs)} documents embedded")
    return collection


def semantic_search(collection, query: str, n_results: int = 5, filter_type: str = None) -> str:
    """Semantic search over CORE knowledge base."""
    query_embedding = get_embeddings([query])[0]
    where = {"type": filter_type} if filter_type else None

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(n_results, collection.count()),
        where=where
    )

    if not results["documents"][0]:
        return "No relevant knowledge found."

    context_parts = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0]
    ):
        relevance = round((1 - dist) * 100, 1)
        context_parts.append(f"[{meta.get('type','').upper()} | relevance: {relevance}%]\n{doc}")

    return "\n\n".join(context_parts)
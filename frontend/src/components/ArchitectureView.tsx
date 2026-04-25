import React from 'react';

export default function ArchitectureView() {
  return (
    <div className="arch-page">
      <div className="arch-header">
        <div className="arch-title">System Architecture</div>
        <div className="arch-sub">
          5-agent sequential pipeline with parallel execution at analysis stage.
          RAG vector store shared across all agents. Assessment history persisted in ChromaDB.
        </div>
      </div>
      <div className="arch-diagram-wrap">
        <img
          src="/architecture.svg"
          alt="CORE Fit Wizard Architecture Diagram"
          className="arch-diagram"
        />
      </div>
      <div className="arch-stack-grid">
        {[
          { label: 'LLM', value: 'Groq LLaMA 3.3 70B', color: '#185FA5' },
          { label: 'Orchestration', value: 'LangChain LCEL', color: '#534AB7' },
          { label: 'Vector DB', value: 'ChromaDB', color: '#1D9E75' },
          { label: 'Embeddings', value: 'Gemini embedding-001', color: '#993C1D' },
          { label: 'Backend', value: 'Python + FastAPI', color: '#854F0B' },
          { label: 'Frontend', value: 'React + TypeScript', color: '#185FA5' },
          { label: 'Streaming', value: 'Server-Sent Events', color: '#534AB7' },
          { label: 'Deployment', value: 'Azure App Service', color: '#1D9E75' },
        ].map(item => (
          <div key={item.label} className="arch-stack-item">
            <div className="arch-stack-label">{item.label}</div>
            <div className="arch-stack-value" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

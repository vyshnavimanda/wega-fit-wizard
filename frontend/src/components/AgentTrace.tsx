/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ClientIntakeForm, WegaFitReport } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface TraceDoc { type: string; relevance: number; preview: string; }
interface AgentTraceData {
  agent_num: number;
  agent_name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  rag_query?: string;
  rag_docs?: TraceDoc[];
  key_findings?: string[];
  confidence?: number;
  output_summary?: string;
  duration_ms?: number;
}
interface ConflictData {
  agent: string;
  risk_title: string;
  severity: string;
  message: string;
  resolution: string;
}
interface Props {
  form: ClientIntakeForm;
  onComplete: (report: WegaFitReport) => void;
  onError: (msg: string) => void;
}

const AGENT_COLORS = ['#185FA5','#534AB7','#1D9E75','#993C1D','#854F0B'];
const AGENT_DESCRIPTIONS = [
  'Parsing client environment + querying constraint knowledge base',
  'Comparing toolchain against WEGA integration catalog via RAG',
  'Matching WEGA agents to client pain points via semantic search',
  'Scanning for compliance, integration, and FDE deployment risks',
  'Synthesizing all outputs into a phased deployment roadmap',
];

function confColor(s: number) {
  return s >= 85 ? '#1D9E75' : s >= 65 ? '#BA7517' : '#A32D2D';
}

export default function AgentTrace({ form, onComplete, onError }: Props) {
  const [agents, setAgents] = useState<AgentTraceData[]>(
    [1,2,3,4,5].map(n => ({
      agent_num: n,
      agent_name: ['Discovery Parser','Stack Compatibility','Use Case Matcher','Risk Flagger','Roadmap Orchestrator'][n-1],
      status: 'pending' as const,
      key_findings: [],
      rag_docs: [],
    }))
  );
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<'running'|'complete'|'error'>('running');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Use refs so event handlers always see current values
  const requestIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const completedCount = agents.filter(a => a.status === 'complete').length;
  const progressPct = Math.round((completedCount / 5) * 100);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

    const fetchReport = (rid: string) => {
      setTimeout(() => {
        axios.get(`${API_URL}/api/analyze/result/${rid}`)
          .then(res => onComplete(res.data))
          .catch(err => onError(err?.response?.data?.detail || err.message));
      }, 500);
    };

    const handleEvent = (event: any) => {
      const { type, data } = event;

      if (type === 'request_id') {
        requestIdRef.current = data.request_id;
      }

      if (type === 'agent_start') {
        setAgents(prev => prev.map(a =>
          a.agent_num === data.agent_num ? { ...a, status: 'running' } : a
        ));
      }

      if (type === 'rag_result') {
        setAgents(prev => prev.map(a =>
          a.agent_num === data.agent_num
            ? { ...a, rag_query: data.query, rag_docs: data.docs || [] }
            : a
        ));
      }

      if (type === 'finding') {
        setAgents(prev => prev.map(a =>
          a.agent_num === data.agent_num
            ? { ...a, key_findings: [...(a.key_findings || []), data.finding] }
            : a
        ));
      }

      if (type === 'conflict') {
        setConflicts(prev => [...prev, data]);
      }

      if (type === 'agent_complete') {
        setAgents(prev => prev.map(a =>
          a.agent_num === data.agent_num
            ? { ...a, status: 'complete', confidence: data.confidence, output_summary: data.output_summary, duration_ms: data.duration_ms }
            : a
        ));
      }

      if (type === 'pipeline_complete') {
        if (timerRef.current) clearInterval(timerRef.current);
        setPipelineStatus('complete');
        const rid = data.request_id || requestIdRef.current;
        if (rid) {
          fetchReport(rid);
        } else {
          onError('Pipeline completed but no request ID received');
        }
      }

      if (type === 'pipeline_error') {
        if (timerRef.current) clearInterval(timerRef.current);
        setPipelineStatus('error');
        onError(data.error || 'Pipeline failed');
      }
    };

    // Connect via fetch + ReadableStream
    fetch(`${API_URL}/api/analyze/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(res => {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const read = () => {
        reader.read().then(({ done, value }) => {
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                handleEvent(event);
              } catch {}
            }
          }
          read();
        }).catch(err => onError(String(err)));
      };
      read();
    }).catch(err => onError(String(err)));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="trace-page">
      <div className="trace-header">
        <div className="trace-header-left">
          <div className="trace-title">
            {pipelineStatus === 'running' && <span className="trace-spinner" />}
            {pipelineStatus === 'complete' && <span className="trace-done-icon">✓</span>}
            {pipelineStatus === 'running' ? 'Running agent pipeline...' : 'Pipeline complete — loading report...'}
          </div>
          <div className="trace-sub">
            {form.company_name} · {completedCount}/5 agents · {elapsedSeconds}s elapsed
          </div>
        </div>
        <div className="trace-progress-wrap">
          <div className="trace-progress-bar">
            <div className="trace-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="trace-progress-label">{progressPct}%</div>
        </div>
      </div>

      <div className="trace-tech-row">
        {['LangChain LCEL','ChromaDB RAG','Gemini Embeddings','Groq LLaMA 3.3','Confidence Scoring'].map(t => (
          <span key={t} className="trace-tech-badge">{t}</span>
        ))}
      </div>

      <div className="trace-agents">
        {agents.map((agent, idx) => {
          const isActive = agent.status === 'running';
          const isDone = agent.status === 'complete';
          const isPending = agent.status === 'pending';
          const color = AGENT_COLORS[idx];

          return (
            <div key={agent.agent_num} className={`trace-agent-card ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isPending ? 'pending' : ''}`}>
              <div className="trace-agent-header">
                <div className="trace-agent-num" style={{
                  background: isDone ? color : isActive ? color : '#e8e7e3',
                  color: (isDone || isActive) ? '#fff' : '#888'
                }}>
                  {isDone ? '✓' : agent.agent_num}
                </div>
                <div className="trace-agent-info">
                  <div className="trace-agent-name">{agent.agent_name}</div>
                  <div className="trace-agent-desc">{AGENT_DESCRIPTIONS[idx]}</div>
                </div>
                <div className="trace-agent-right">
                  {isActive && <div className="trace-pulse" />}
                  {isDone && agent.confidence !== undefined && (
                    <div className="trace-confidence" style={{ color: confColor(agent.confidence) }}>
                      {agent.confidence}%
                    </div>
                  )}
                  {isDone && agent.duration_ms && (
                    <div className="trace-duration">{(agent.duration_ms / 1000).toFixed(1)}s</div>
                  )}
                </div>
              </div>

              {(isActive || isDone) && agent.rag_query && (
                <div className="trace-rag-section">
                  <div className="trace-rag-label">RAG query</div>
                  <div className="trace-rag-query">"{agent.rag_query}"</div>
                  {agent.rag_docs && agent.rag_docs.length > 0 && (
                    <div className="trace-rag-docs">
                      {agent.rag_docs.map((doc, i) => (
                        <div key={i} className="trace-rag-doc">
                          <span className="trace-doc-type">{doc.type}</span>
                          <span className="trace-doc-rel" style={{ color: doc.relevance >= 80 ? '#1D9E75' : '#BA7517' }}>
                            {doc.relevance}% match
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(isActive || isDone) && agent.key_findings && agent.key_findings.length > 0 && (
                <div className="trace-findings">
                  {agent.key_findings.map((f, i) => (
                    <div key={i} className={`trace-finding ${f.startsWith('⚠') || f.startsWith('🔴') ? 'finding-warn' : ''}`}>
                      {f}
                    </div>
                  ))}
                </div>
              )}

              {isDone && agent.output_summary && (
                <div className="trace-output-summary">{agent.output_summary}</div>
              )}

              {idx < 4 && <div className="trace-arrow" style={{ color: isDone ? color : '#ddd' }}>↓</div>}
            </div>
          );
        })}
      </div>

      {conflicts.length > 0 && (
        <div className="trace-conflicts">
          <div className="trace-conflicts-title">⚠ {conflicts.length} agent conflict{conflicts.length > 1 ? 's' : ''} detected</div>
          {conflicts.map((c, i) => (
            <div key={i} className="trace-conflict-item">
              <span className="trace-conflict-agent">{c.agent}</span>
              <span className="trace-conflict-msg">{c.message}</span>
            </div>
          ))}
        </div>
      )}

      {pipelineStatus === 'complete' && (
        <div className="trace-complete-banner">
          All agents complete — loading your report...
        </div>
      )}
    </div>
  );
}

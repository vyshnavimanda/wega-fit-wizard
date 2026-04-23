import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface Assessment {
  assessment_id: string;
  timestamp: string;
  company_name: string;
  industry: string;
  cloud_provider: string;
  team_size: string;
  compatibility_score: number;
  risk_level: 'green' | 'yellow' | 'red';
  high_risk_count: number;
  medium_risk_count: number;
  constraints: string;
}

interface Stats {
  total_assessments: number;
  avg_compatibility_score: number;
  high_risk_clients: number;
  constrained_environments: number;
  industry_breakdown: Record<string, number>;
  risk_breakdown: { green: number; yellow: number; red: number };
  recent: Assessment[];
}

const RISK_COLOR = { green: '#1D9E75', yellow: '#BA7517', red: '#A32D2D' };
const RISK_BG = { green: '#E1F5EE', yellow: '#FAEEDA', red: '#FCEBEB' };

export default function Dashboard({ onViewReport }: { onViewReport: (id: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, listRes] = await Promise.all([
          axios.get(`${API_URL}/api/dashboard/stats`),
          axios.get(`${API_URL}/api/dashboard/assessments`)
        ]);
        setStats(statsRes.data);
        setAssessments(listRes.data.assessments || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API_URL}/api/dashboard/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data.results || []);
    } finally {
      setSearching(false);
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  if (loading) return (
    <div className="dashboard-loading">
      <div className="spinner" />
      <span>Loading dashboard...</span>
    </div>
  );

  if (!stats || stats.total_assessments === 0) return (
    <div className="dashboard-empty">
      <div className="empty-icon">📊</div>
      <div className="empty-title">No assessments yet</div>
      <div className="empty-sub">Run your first client assessment to see the dashboard</div>
    </div>
  );

  const avgScore = stats.avg_compatibility_score;
  const scoreColor = avgScore >= 75 ? '#1D9E75' : avgScore >= 50 ? '#BA7517' : '#A32D2D';

  return (
    <div className="dashboard-page">

      {/* Stats row */}
      <div className="dash-stats-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-label">Total Assessments</div>
          <div className="dash-stat-value">{stats.total_assessments}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Avg Compatibility</div>
          <div className="dash-stat-value" style={{ color: scoreColor }}>{avgScore}/100</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">High-Risk Clients</div>
          <div className="dash-stat-value" style={{ color: stats.high_risk_clients > 0 ? '#A32D2D' : '#1D9E75' }}>
            {stats.high_risk_clients}
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Constrained Environments</div>
          <div className="dash-stat-value" style={{ color: stats.constrained_environments > 0 ? '#BA7517' : '#1D9E75' }}>
            {stats.constrained_environments}
          </div>
        </div>
      </div>

      <div className="dash-two-col">
        {/* Risk breakdown */}
        <div className="dash-card">
          <div className="dash-card-title">Risk Distribution</div>
          <div className="risk-dist">
            {(['green','yellow','red'] as const).map(level => (
              <div key={level} className="risk-dist-row">
                <div className="risk-dist-label" style={{ color: RISK_COLOR[level] }}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </div>
                <div className="risk-dist-bar-wrap">
                  <div
                    className="risk-dist-bar"
                    style={{
                      width: `${stats.total_assessments ? (stats.risk_breakdown[level] / stats.total_assessments) * 100 : 0}%`,
                      background: RISK_COLOR[level]
                    }}
                  />
                </div>
                <div className="risk-dist-num">{stats.risk_breakdown[level]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Industry breakdown */}
        <div className="dash-card">
          <div className="dash-card-title">By Industry</div>
          <div className="industry-list">
            {Object.entries(stats.industry_breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([industry, count]) => (
                <div key={industry} className="industry-row">
                  <div className="industry-name">{industry}</div>
                  <div className="industry-count">{count}</div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Semantic Search */}
      <div className="dash-card" style={{ marginBottom: '1rem' }}>
        <div className="dash-card-title">Semantic Search — Past Assessments</div>
        <div className="dash-search-hint">Powered by ChromaDB vector search + embeddings</div>
        <div className="dash-search-row">
          <input
            type="text"
            className="dash-search-input"
            placeholder='e.g. "air-gapped healthcare clients" or "high risk fintech"'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn-primary" onClick={handleSearch} disabled={searching}>
            {searching ? 'Searching...' : 'Search →'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="search-results">
            <div className="search-results-label">Found {searchResults.length} results</div>
            {searchResults.map(r => (
              <div key={r.assessment_id} className="search-result-row" onClick={() => onViewReport(r.assessment_id)}>
                <div className="sr-name">{r.company_name}</div>
                <div className="sr-meta">{r.industry} · {r.compatibility_score}/100</div>
                <div className="sr-relevance">relevance: {r.relevance}%</div>
                <div className="sr-constraints">{r.constraints !== 'none' ? `⚠ ${r.constraints}` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assessment History */}
      <div className="dash-card">
        <div className="dash-card-title">Assessment History</div>
        <div className="assessment-table">
          <div className="at-header">
            <div>Client</div><div>Industry</div><div>Compatibility</div>
            <div>Risk</div><div>Constraints</div><div>Date</div>
          </div>
          {assessments.map(a => (
            <div
              key={a.assessment_id}
              className="at-row"
              onClick={() => onViewReport(a.assessment_id)}
              title="Click to view full report"
            >
              <div className="at-company">{a.company_name}</div>
              <div className="at-industry">{a.industry}</div>
              <div className="at-score" style={{ color: a.compatibility_score >= 75 ? '#1D9E75' : a.compatibility_score >= 50 ? '#BA7517' : '#A32D2D' }}>
                {a.compatibility_score}/100
              </div>
              <div>
                <span className="risk-pill" style={{ background: RISK_BG[a.risk_level], color: RISK_COLOR[a.risk_level] }}>
                  {a.risk_level.toUpperCase()}
                </span>
              </div>
              <div className="at-constraints">
                {a.constraints && a.constraints !== 'none'
                  ? <span className="constraint-pill">⚠ constrained</span>
                  : <span className="no-constraint">—</span>}
              </div>
              <div className="at-date">{formatDate(a.timestamp)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

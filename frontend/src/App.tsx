import React, { useState } from 'react';
import { ClientIntakeForm, WegaFitReport } from './types';
import IntakeForm from './components/IntakeForm';
import ReportDashboard from './components/ReportDashboard';
import Dashboard from './components/Dashboard';
import AgentTrace from './components/AgentTrace';
import SamplePrompts from './components/SamplePrompts';
import ArchitectureView from './components/ArchitectureView';
import './App.css';

type AppView = 'form' | 'trace' | 'report' | 'dashboard' | 'prompts' | 'architecture';

export default function App() {
  const [view, setView] = useState<AppView>('form');
  const [report, setReport] = useState<WegaFitReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingForm, setPendingForm] = useState<ClientIntakeForm | null>(null);

  const handleSubmit = (form: ClientIntakeForm) => {
    setError(null);
    setPendingForm(form);
    setView('trace');
  };

  const handleTraceComplete = (r: WegaFitReport) => {
    setReport(r);
    setTimeout(() => setView('report'), 800);
  };

  const handleTraceError = (msg: string) => {
    setError(msg);
    setView('form');
  };

  const handleViewFromDashboard = async (id: string) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/dashboard/assessments/${id}`);
      const data = await res.json();
      setReport(data);
      setView('report');
    } catch (e) { console.error(e); }
  };

  const navItems: { id: AppView; label: string; show: boolean }[] = [
    { id: 'form', label: 'New Assessment', show: true },
    { id: 'dashboard', label: 'Dashboard', show: true },
    { id: 'report', label: 'Last Report', show: !!report },
    { id: 'prompts', label: 'Agent Prompts', show: true },
    { id: 'architecture', label: 'Architecture', show: true },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-group">
            <div className="logo-icon">W</div>
            <div>
              <div className="logo-title">WEGA Fit Wizard</div>
              <div className="logo-sub">Client Deployment Intelligence · v2</div>
            </div>
          </div>
          <nav className="header-nav">
            {navItems.filter(n => n.show).map(n => (
              <button
                key={n.id}
                className={`nav-btn ${(view === n.id || (n.id === 'form' && view === 'trace')) ? 'active' : ''}`}
                onClick={() => { if (view !== 'trace') { setView(n.id); setError(null); } }}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {view === 'form' && (
          <>
            {error && <div className="error-banner"><span>⚠</span> {error}</div>}
            <IntakeForm onSubmit={handleSubmit} />
          </>
        )}
        {view === 'trace' && pendingForm && (
          <AgentTrace form={pendingForm} onComplete={handleTraceComplete} onError={handleTraceError} />
        )}
        {view === 'report' && report && <ReportDashboard report={report} />}
        {view === 'dashboard' && <Dashboard onViewReport={handleViewFromDashboard} />}
        {view === 'prompts' && <SamplePrompts />}
        {view === 'architecture' && <ArchitectureView />}
      </main>
    </div>
  );
}

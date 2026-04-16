import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoSrc from '../../assets/logo.png';
import './LandingPage.css';

const API_BASE = 'http://localhost:8000';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleAppConsole = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isAuthenticated) {
      navigate('/monitor');
    } else {
      sessionStorage.setItem('postAuthRedirect', '/init');
      window.location.href = `${API_BASE}/api/auth/github`;
    }
  }, [isAuthenticated, navigate]);

  return (
    <main className="landing-page">
      <div className="landing-page__bg-grid" aria-hidden="true" />
      <div className="landing-page__glow-1" aria-hidden="true" />
      <div className="landing-page__glow-2" aria-hidden="true" />

      <nav className="landing-nav">
        <div className="landing-nav__brand">
          <div className="landing-nav__logo-container">
            <img src={logoSrc} alt="EasyOps Logo" className="landing-nav__logo" />
          </div>
          <span className="landing-nav__title">EasyOps</span>
        </div>

        <div className="landing-nav__links">
          <button
            className="landing-nav__cta"
            onClick={handleAppConsole}
            disabled={isLoading}
            type="button"
          >
            {isLoading ? 'INIT…' : isAuthenticated ? 'Dashboard' : 'App Console'}
          </button>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-section__badge">
            <span className="hero-section__badge-dot" aria-hidden="true" />
            System Ready :: Node OK
          </div>

          <h1 className="hero-section__title">
            DETERMINISTIC<br />
            <span className="opacity-90">RESOLUTION.</span><br />
            STRUCTURAL<br />
            <span className="hero-section__title-engine">
              ENGINE.
            </span>
          </h1>

          <p className="hero-section__subtext">
            Moving beyond standard AI 'guesses.' A high-performance DevOps Agent designed for complex repositories, providing autonomous CI/CD recovery and meticulous architectural reviews.
          </p>

          <div className="hero-section__actions">
            <button
              className="hero-section__cta-primary group"
              onClick={handleAppConsole}
              disabled={isLoading}
              type="button"
            >
              {isAuthenticated ? '[ EXPLORE_CONSOLE ]' : '[ ESTABLISH_UPLINK ]'}
              <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1 group-hover:rotate-12">bolt</span>
            </button>
          </div>
        </div>
      </section>

      <section className="feature-section" id="architecture">
        <div className="feature-section__grid">
          <div className="featured-card group">
            <img
              className="featured-card__img"
              alt="Deterministic Structural Graph"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAyE2rOSX_HTmDmfPwUwJ5fqP-9ygBzj3ZAZiy0ctSbwYTRikhPH-vkDdymIaepw2SxWRQ98fkHK970cMvVyB5kX7BlaZFfNTPSlif5eE7C_J--AKvad7w6KNMS7UoqHbI7tVxLhjxnmbVise9wC8u47GTNcqrMQMhwSB7CkZtOCaMSEa317pcEj8ts1d76SgiO4RdSMt5wyYrBk9_cDnl1FEhltN_Fvje_ny7nF2KfqeiazXhw6MgD_A109TXLzMBL7G6vth4cz_uM"
            />
            <div className="featured-card__gradient" aria-hidden="true" />
            <div className="featured-card__content">
              <div className="featured-card__badge">
                <span className="material-symbols-outlined featured-card__badge-icon text-primary">psychology</span>
                <span className="featured-card__badge-text text-primary">0.4s Indexing Latency</span>
              </div>
              <h3 className="featured-card__title">Deterministic Structural Mapping</h3>
              <p className="featured-card__desc">Move beyond noisy Vector RAG. A persistent structural graph that maps 10,000+ files in milliseconds, providing surgical code context with zero hallucinations.</p>
            </div>
          </div>

          <div className="sidebar-cards">
            <div className="resource-card">
              <div>
                <span className="material-symbols-outlined resource-card__icon">build</span>
                <h4 className="resource-card__title">Autonomous Pipeline Repair</h4>
                <p className="resource-card__text">
                  When a build fails, the agent identifies the root cause, generates a surgical code fix, and opens a Pull Request—instantly.
                </p>
              </div>
              <div className="resource-card__footer">
                <span className="resource-card__metric">~30s</span>
                <span className="resource-card__metric-label">MTTR (MEAN TIME TO RECOVERY)</span>
              </div>
            </div>

            <div className="security-card">
              <div className="security-card__icon-wrapper">
                <div className="security-card__icon">
                  <span className="material-symbols-outlined">security</span>
                </div>
                <div>
                  <div className="security-card__label">AI-GUARDRAILS ENABLED</div>
                  <div className="security-card__title">RSI-SENSITIVITY FILTER</div>
                </div>
              </div>
              <p className="security-card__desc">
                Deterministic blocking of AI edits on critical infrastructure (.tf) and secret stores (.env), ensuring agentic autonomy never compromises security.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

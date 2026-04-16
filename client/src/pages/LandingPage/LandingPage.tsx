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


    </main>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import './OAuthScreen.css';

const API_BASE = 'http://localhost:8000';

export default function OAuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(() => {
    const params = new URLSearchParams(location.search);
    return !!(params.get('github_id') && params.get('session_id'));
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const githubId = params.get('github_id');
    const sessionId = params.get('session_id');

    if (githubId && sessionId) {
      localStorage.setItem('easyops_auth_token', sessionId);
      localStorage.setItem('easyops_github_id', githubId);

      fetch(`${API_BASE}/api/user/info`, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch user context');
          return res.json();
        })
        .then((data) => {
          localStorage.setItem('easyops_user_roles', JSON.stringify(data.roles || []));
          
          const redirectTo = localStorage.getItem('postAuthRedirect') || '/monitor';
          localStorage.removeItem('postAuthRedirect');
          
          setTimeout(() => {
            navigate(redirectTo);
          }, 800);
        })
        .catch((err) => {
          console.error(err);
          setError('Failed to establish user context. Please retry.');
          setIsProcessing(false);
        });
    }
  }, [location, navigate]);


  return (
    <div className="oauth-page">
      <main className="oauth-page__main">
        <div className="oauth-page__content">
          
          <div className="oauth-header">
            <div>
              <h1 className="oauth-header__title">Dashboard Authorization Protocol</h1>
              <p className="oauth-header__subtitle">
                SYSTEM VERIFICATION // STATUS: {isProcessing ? 'HANDSHAKE_IN_PROGRESS' : 'AWAITING_UPLINK'}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-error-container text-on-error-container p-4 rounded-xl border border-error/20 flex gap-3 items-center">
              <span className="material-symbols-outlined">error</span>
              <span className="font-bold text-sm tracking-tight">{error}</span>
            </div>
          )}

          <div className="oauth-grid">
            <div className="oauth-auth-card">
              <div className="oauth-auth-card__id">UPLINK_INSTRUCTIONS</div>
              <h2 className="oauth-auth-card__title">
                Telegram Bot <span className="oauth-auth-card__title-highlight">Integration Bridge</span>
              </h2>
              <p className="oauth-auth-card__desc">
                Follow these precise sequential commands to securely authenticate and link your central dashboard with the EasyOps monitoring agent. We utilize Telegram Webhooks to establish direct, persistent, and secure two-way communication.
              </p>
              
              <div className="oauth-bot-instructions">
                <div className="oauth-bot-instructions__steps">

                  <div className="oauth-bot-step">
                    <span className="oauth-bot-step__badge">1</span>
                    <p className="oauth-bot-step__id">SEARCH_TARGET</p>
                    <p className="oauth-bot-step__desc">
                      Open Telegram and search for <br/><strong>@easyops_devops_bot</strong>
                    </p>
                  </div>
                  <div className="oauth-bot-step">
                    <span className="oauth-bot-step__badge">2</span>
                    <p className="oauth-bot-step__id">EXECUTE_INIT</p>
                    <p className="oauth-bot-step__desc">
                      Send the start command to initialize:<br/>
                      <strong>/start</strong>
                    </p>
                  </div>
                  <div className="oauth-bot-step">
                    <span className="oauth-bot-step__badge">3</span>
                    <p className="oauth-bot-step__id">AUTHORIZATION</p>
                    <p className="oauth-bot-step__desc">
                      Click the secure login button inside Telegram or execute:<br/>
                      <strong>/login</strong>
                    </p>
                  </div>
                  <div className="oauth-bot-step">
                    <span className="oauth-bot-step__badge">4</span>
                    <p className="oauth-bot-step__id">DASHBOARD_REDIRECT</p>
                    <p className="oauth-bot-step__desc">
                      The bot will authenticate you via GitHub and redirect you automatically back to the active monitoring console!
                    </p>
                  </div>
                </div>
              </div>
              

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

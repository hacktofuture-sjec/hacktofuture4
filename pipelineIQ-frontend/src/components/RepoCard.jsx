export default function RepoCard({ repo, onDisconnect, showDisconnect = true }) {
  return (
    <div className="repo-card">
      <div className="repo-card-left">
        <div className="repo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        </div>
        <div className="repo-info">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="repo-name"
          >
            {repo.full_name || repo.name}
          </a>
          <div className="repo-meta">
            {repo.private && <span className="badge badge-private">Private</span>}
            {!repo.private && <span className="badge badge-public">Public</span>}
            <span className="branch-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              {repo.default_branch}
            </span>
            {repo.language && (
              <span className="lang-badge">{repo.language}</span>
            )}
          </div>
        </div>
      </div>

      {showDisconnect && onDisconnect && (
        <button
          className="btn-disconnect"
          onClick={() => onDisconnect(repo.id)}
          title="Disconnect repository"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

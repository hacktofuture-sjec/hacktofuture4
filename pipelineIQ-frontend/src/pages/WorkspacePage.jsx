import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import RepoCard from "../components/RepoCard";
import Modal from "../components/Modal";

export default function WorkspacePage() {
  const { id } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [ghRepos, setGhRepos] = useState([]);
  const [loadingGh, setLoadingGh] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchWorkspace = async () => {
    try {
      const { data } = await api.get(`/workspaces/${id}`);
      setWorkspace(data);
    } catch (err) {
      console.error("Failed to load workspace", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [id]);

  const openConnectModal = async () => {
    setShowConnect(true);
    setLoadingGh(true);
    try {
      const { data } = await api.get("/repositories/github", {
        params: { per_page: 100 },
      });
      setGhRepos(data);
    } catch (err) {
      console.error("Failed to load GitHub repos", err);
    } finally {
      setLoadingGh(false);
    }
  };

  const connectRepo = async (repo) => {
    try {
      await api.post(`/workspaces/${id}/repos`, {
        github_repo_id: repo.github_repo_id,
        full_name: repo.full_name,
        name: repo.name,
        private: repo.private,
        html_url: repo.html_url,
        default_branch: repo.default_branch,
      });
      setShowConnect(false);
      await fetchWorkspace();
    } catch (err) {
      if (err.response?.status === 409) {
        alert("Repository is already connected to this workspace.");
      } else {
        console.error("Failed to connect repo", err);
      }
    }
  };

  const disconnectRepo = async (repoId) => {
    if (!confirm("Disconnect this repository?")) return;
    try {
      await api.delete(`/workspaces/${id}/repos/${repoId}`);
      await fetchWorkspace();
    } catch (err) {
      console.error("Failed to disconnect repo", err);
    }
  };

  const connectedIds = new Set(
    workspace?.repositories?.map((r) => r.github_repo_id) || []
  );

  const filteredRepos = ghRepos.filter(
    (r) =>
      !connectedIds.has(r.github_repo_id) &&
      (r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="dashboard-page">
        <div className="empty-state">
          <h2>Workspace not found</h2>
          <Link to="/dashboard" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="workspace-header">
        <div className="workspace-header-left">
          <Link to="/dashboard" className="back-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Dashboard
          </Link>
          <h1>{workspace.name}</h1>
          {workspace.description && (
            <p className="workspace-description">{workspace.description}</p>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={openConnectModal}
          id="connect-repo-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Connect Repository
        </button>
      </header>

      {workspace.repositories?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </div>
          <h2>No repositories connected</h2>
          <p>Connect your GitHub repositories to this workspace.</p>
          <button className="btn-primary" onClick={openConnectModal}>
            Connect Repository
          </button>
        </div>
      ) : (
        <div className="repo-list">
          {workspace.repositories.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              onDisconnect={disconnectRepo}
            />
          ))}
        </div>
      )}

      {/* Connect Repository Modal */}
      <Modal
        isOpen={showConnect}
        onClose={() => {
          setShowConnect(false);
          setSearchTerm("");
        }}
        title="Connect a Repository"
      >
        <div className="connect-modal">
          <input
            type="text"
            className="search-input"
            placeholder="Search repositories…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />

          {loadingGh ? (
            <div className="loading-screen mini">
              <div className="loader" />
            </div>
          ) : filteredRepos.length === 0 ? (
            <p className="no-results">No repositories found.</p>
          ) : (
            <div className="connect-list">
              {filteredRepos.map((repo) => (
                <div key={repo.github_repo_id} className="connect-item">
                  <div className="connect-item-info">
                    <span className="connect-item-name">{repo.full_name}</span>
                    <span className="connect-item-meta">
                      {repo.private ? "Private" : "Public"}
                      {repo.language ? ` · ${repo.language}` : ""}
                    </span>
                  </div>
                  <button
                    className="btn-connect"
                    onClick={() => connectRepo(repo)}
                  >
                    Connect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

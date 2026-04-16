import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import WorkspaceCard from "../components/WorkspaceCard";
import Modal from "../components/Modal";

export default function DashboardPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchWorkspaces = async () => {
    try {
      const { data } = await api.get("/workspaces");
      setWorkspaces(data);
    } catch (err) {
      console.error("Failed to load workspaces", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);
    try {
      await api.post("/workspaces", {
        name: formName.trim(),
        description: formDesc.trim() || null,
      });
      setFormName("");
      setFormDesc("");
      setShowCreate(false);
      await fetchWorkspaces();
    } catch (err) {
      console.error("Failed to create workspace", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this workspace and all connected repos?")) return;
    try {
      await api.delete(`/workspaces/${id}`);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      console.error("Failed to delete workspace", err);
    }
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>
            Welcome back,{" "}
            <span className="gradient-text">
              {user?.display_name || user?.username}
            </span>
          </h1>
          <p className="dashboard-subtitle">
            Manage your workspaces and connected repositories
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreate(true)}
          id="create-workspace-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Workspace
        </button>
      </header>

      {loading ? (
        <div className="loading-screen">
          <div className="loader" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h2>No workspaces yet</h2>
          <p>Create your first workspace to start connecting repositories.</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="workspace-grid">
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Workspace"
      >
        <form onSubmit={handleCreate} className="modal-form">
          <div className="form-group">
            <label htmlFor="ws-name">Name</label>
            <input
              id="ws-name"
              type="text"
              placeholder="My Awesome Project"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="ws-desc">Description (optional)</label>
            <textarea
              id="ws-desc"
              placeholder="What's this workspace for?"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={creating || !formName.trim()}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  return children;
}

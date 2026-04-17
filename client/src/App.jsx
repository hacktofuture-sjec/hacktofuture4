import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import AuthorityHome from './pages/AuthorityHome';
import ReportIssue from './pages/ReportIssue';
import Rewards from './pages/Rewards';
import ExecutiveView from './pages/ExecutiveView';
import { CitizenDashboard, AuthorityDashboard } from './pages/Dashboards';
import Navbar from './components/Navbar';
import Chatbot from './components/Chatbot';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-center" />
      <Navbar />
      <Routes>
        <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/home" />} />
        
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/home" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/home" />} />
        
        {/* Role-Based Direct Home Route */}
        <Route 
          path="/home" 
          element={
            user ? (
              user.role === 'citizen' ? <Home /> : <AuthorityHome />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Citizen Specific Routes */}
        <Route 
          path="/dashboard" 
          element={user?.role === 'citizen' ? <CitizenDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/report" 
          element={user?.role === 'citizen' ? <ReportIssue /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/rewards" 
          element={user?.role === 'citizen' ? <Rewards /> : <Navigate to="/login" />} 
        />

        {/* Authority Specific Routes */}
        <Route 
          path="/department" 
          element={user?.role === 'authority' ? <AuthorityDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/executive" 
          element={user?.role === 'authority' ? <ExecutiveView /> : <Navigate to="/login" />} 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Chatbot />
    </Router>
  );
}

export default App;

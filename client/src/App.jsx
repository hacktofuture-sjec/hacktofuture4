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
import CitizenPage from './pages/CitizenPage';
import DepartmentPage from './pages/DepartmentPage';
import AdminPage from './pages/AdminPage';
import AdminLogin from './pages/AdminLogin';
import DepartmentLogin from './pages/DepartmentLogin';
import DepartmentRegister from './pages/DepartmentRegister';
import Navbar from './components/Navbar';
import Chatbot from './components/Chatbot';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import VoiceCallButton from './components/VoiceCallButton';



function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isOfficerOrAdmin = user && (user.role === 'authority' || user.role === 'admin');

  return (
    <Router>
      <Toaster position="top-center" />
      <Navbar />
      <Routes>
        <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/home" />} />
        
        {/* Citizen Auth Routes */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/home" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/home" />} />

        {/* 🏢 Dedicated Department Official Auth Routes */}
        <Route 
          path="/department/login" 
          element={!user ? <DepartmentLogin /> : (user.role === 'authority' ? <Navigate to="/department" /> : (user.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/citizen" />))} 
        />
        <Route 
          path="/department-login" 
          element={!user ? <DepartmentLogin /> : (user.role === 'authority' ? <Navigate to="/department" /> : (user.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/citizen" />))} 
        />
        <Route 
          path="/department/register" 
          element={!user ? <DepartmentRegister /> : (user.role === 'authority' ? <Navigate to="/department" /> : (user.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/citizen" />))} 
        />
        <Route 
          path="/department-register" 
          element={!user ? <DepartmentRegister /> : (user.role === 'authority' ? <Navigate to="/department" /> : (user.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/citizen" />))} 
        />

        {/* 🏛️ Dedicated Super Admin / Executive Login Route */}
        <Route 
          path="/admin/login" 
          element={!user ? <AdminLogin /> : (user.role === 'admin' ? <Navigate to="/admin" /> : (user.role === 'authority' ? <Navigate to="/department" /> : <Navigate to="/citizen" />))} 
        />
        <Route 
          path="/admin-login" 
          element={!user ? <AdminLogin /> : (user.role === 'admin' ? <Navigate to="/admin" /> : (user.role === 'authority' ? <Navigate to="/department" /> : <Navigate to="/citizen" />))} 
        />
        
        {/* Role-Based Direct Home Route */}
        <Route 
          path="/home" 
          element={
            user ? (
              user.role === 'citizen' ? <CitizenPage /> : <AuthorityHome />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* 👤 Citizen Portal Routes */}
        <Route 
          path="/citizen" 
          element={user?.role === 'citizen' ? <CitizenPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/dashboard" 
          element={user?.role === 'citizen' ? <CitizenPage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/report" 
          element={user?.role === 'citizen' ? <ReportIssue /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/rewards" 
          element={user?.role === 'citizen' ? <Rewards /> : <Navigate to="/login" />} 
        />

        {/* 🏢 Department Official Portal Routes */}
        <Route 
          path="/department" 
          element={isOfficerOrAdmin ? <DepartmentPage /> : <Navigate to="/admin/login" />} 
        />

        {/* 🏛️ Admin / City Executive Portal Routes (Admin Only) */}
        <Route 
          path="/admin" 
          element={isOfficerOrAdmin ? <AdminPage /> : <Navigate to="/admin/login" />} 
        />
        <Route 
          path="/executive" 
          element={isOfficerOrAdmin ? <AdminPage /> : <Navigate to="/admin/login" />} 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Chatbot />
      <PWAInstallPrompt />
      <VoiceCallButton isFloating={true} />
    </Router>
  );
}


export default App;

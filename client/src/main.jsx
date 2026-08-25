import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { Toaster } from 'react-hot-toast'

// Register PWA Service Worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('JanSetu PWA ServiceWorker registration successful with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('JanSetu PWA ServiceWorker registration failed:', error);
      });
  });
} else if ('serviceWorker' in navigator) {
  // In development, register as well to enable PWA testing
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('JanSetu PWA ServiceWorker active in dev:', registration.scope);
      })
      .catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Toaster position="top-right" />
      <App />
    </AuthProvider>
  </StrictMode>,
)


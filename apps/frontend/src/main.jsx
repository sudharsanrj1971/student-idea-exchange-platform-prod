import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';

// ── Theme initialization for dark mode consistency ──
const initializeTheme = () => {
  const theme = localStorage.getItem('ichange-theme-storage');
  if (theme) {
    try {
      const parsed = JSON.parse(theme);
      if (parsed.state.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      document.documentElement.classList.add('dark'); // fallback to dark
    }
  } else {
    document.documentElement.classList.add('dark'); // default
  }
};

initializeTheme();

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

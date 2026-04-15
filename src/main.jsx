import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import Login from './Login.jsx'
import './index.css'

const queryClient = new QueryClient();

function Main() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('pft_auth') === 'true';
  });

  const handleLogin = () => {
    localStorage.setItem('pft_auth', 'true');
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
)

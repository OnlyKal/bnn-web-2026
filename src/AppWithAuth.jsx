// Example of how to integrate authentication with routing
// This is just an example - you may want to use React Router or similar for proper routing

import { useState, useEffect } from 'react';
import Connexion from './UTILISATEURS/Connexion.jsx';
import Inscription from './UTILISATEURS/Inscription.jsx';
import Provinces from './UTILISATEURS/Provinces.jsx';
import TypeUtilisateurs from './UTILISATEURS/TypeUtilisateurs.jsx';
import Dashboard from './components/Dashboard.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { isAuthenticated, getCurrentUser, logout } from './utils/auth.js';

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check authentication status on app load
    if (isAuthenticated()) {
      const userData = getCurrentUser();
      setUser(userData);
      setCurrentPage('dashboard');
    }
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
    setCurrentPage('login');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <Connexion />;
      
      case 'register':
        return <Inscription />;
      
      case 'provinces':
        return <Provinces />;
      
      case 'typeUtilisateurs':
        return <TypeUtilisateurs />;
      
      case 'dashboard':
        return (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        );
      
      default:
        return <Connexion />;
    }
  };

  return (
    <div className="app">
      {/* Simple navigation example */}
      {user && (
        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #ddd'
        }}>
          <div>
            <button 
              onClick={() => setCurrentPage('dashboard')}
              style={{ marginRight: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setCurrentPage('provinces')}
              style={{ marginRight: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              Provinces
            </button>
            <button 
              onClick={() => setCurrentPage('typeUtilisateurs')}
              style={{ marginRight: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              Types d'utilisateurs
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>Bonjour, {user.prenom || user.username}!</span>
            <button 
              onClick={handleLogout}
              style={{ 
                padding: '0.5rem 1rem', 
                cursor: 'pointer',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Déconnexion
            </button>
          </div>
        </nav>
      )}

      {/* Render current page */}
      <main>
        {renderPage()}
      </main>

      {/* Simple navigation for unauthenticated users */}
      {!user && currentPage !== 'login' && (
        <div style={{ 
          position: 'fixed', 
          bottom: '20px', 
          right: '20px',
          backgroundColor: 'white',
          padding: '1rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <button 
            onClick={() => setCurrentPage('login')}
            style={{ 
              padding: '0.5rem 1rem', 
              cursor: 'pointer',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Retour à la connexion
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
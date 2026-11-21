import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Connexion from './UTILISATEURS/Connexion.jsx';
import Inscription from './UTILISATEURS/Inscription.jsx';
import ResetPassword from './UTILISATEURS/ResetPassword.jsx';
import Provinces from './UTILISATEURS/Provinces.jsx';
import TypeUtilisateurs from './UTILISATEURS/TypeUtilisateurs.jsx';
import SelectUniversite from './UTILISATEURS/SelectUniversite.jsx';
import HomePage from './HomePage.jsx';
import Profile from './Profile.jsx';
import RessourceDetails from './RessourceDetails.jsx';
import OpenAlexDetails from './OpenAlexDetails.jsx';
import FavorisPage from './FavorisPage.jsx';
import SalonsPage from './SalonsPage.jsx';
import HistoriquePage from './HistoriquePage.jsx';
import StatistiquesActionsPage from './StatistiquesActionsPage.jsx';
import StatistiquesConsultationsPage from './StatistiquesConsultationsPage.jsx';
import PrivacyPolicyPage from './PrivacyPolicyPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RouteTitle from './components/RouteTitle.jsx';
import { isAuthenticated } from './utils/auth.js';

// Encyclopédie RDC : chargée à la demande (cartes Leaflet hors du bundle principal).
const RdcHomePage = lazy(() => import('./encyclopedie/RdcHomePage.jsx'));
const RdcExplorerPage = lazy(() => import('./encyclopedie/RdcExplorerPage.jsx'));
const RdcFichePage = lazy(() => import('./encyclopedie/RdcFichePage.jsx'));
const RdcProvincesPage = lazy(() => import('./encyclopedie/RdcProvincesPage.jsx'));
const RdcProvincePage = lazy(() => import('./encyclopedie/RdcProvincePage.jsx'));
const RdcChronologiePage = lazy(() => import('./encyclopedie/RdcChronologiePage.jsx'));
const RdcCartePage = lazy(() => import('./encyclopedie/RdcCartePage.jsx'));

const rdcRoutes = [
  ['/rdc', RdcHomePage],
  ['/rdc/explorer', RdcExplorerPage],
  ['/rdc/categorie/:slug', RdcExplorerPage],
  ['/rdc/fiche/:slug', RdcFichePage],
  ['/rdc/provinces', RdcProvincesPage],
  ['/rdc/provinces/:slug', RdcProvincePage],
  ['/rdc/chronologie', RdcChronologiePage],
  ['/rdc/carte', RdcCartePage],
];

const PageLoader = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p className="loading-text">Chargement…</p>
  </div>
);

function App() {
  return (
    <Router>
      <div className="App">
        <RouteTitle />
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated() ? <Navigate to="/home" replace /> : <Connexion />
            } 
          />
          <Route path="/register" element={<Inscription />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/provinces" element={<Provinces />} />
          <Route path="/user-types" element={<TypeUtilisateurs />} />
          <Route path="/select-universite" element={<SelectUniversite />} />
          <Route path="/privacypolicy" element={<PrivacyPolicyPage />} />
          
          {/* Protected Routes */}
          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/ressources/externes/hal/:id" 
            element={
              <ProtectedRoute>
                <RessourceDetails />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/ressources/externes/openalex/:id"
            element={
              <ProtectedRoute>
                <OpenAlexDetails />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/ressources/:id" 
            element={
              <ProtectedRoute>
                <RessourceDetails />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/favoris" 
            element={
              <ProtectedRoute>
                <FavorisPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/salons" 
            element={
              <ProtectedRoute>
                <SalonsPage />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/historique"
            element={
              <ProtectedRoute>
                <HistoriquePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/statistiques"
            element={
              <ProtectedRoute allowedRoles={['Administrateur', 'administrateur', 'admin']}>
                <StatistiquesActionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/consultations"
            element={
              <ProtectedRoute allowedRoles={['Administrateur', 'administrateur', 'admin']}>
                <StatistiquesConsultationsPage />
              </ProtectedRoute>
            }
          />
          
          {/* Encyclopédie RDC */}
          {rdcRoutes.map((route) => {
            const [path, Page] = route;
            return (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Page />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
            );
          })}

          {/* Default route */}
          <Route 
            path="/" 
            element={
              isAuthenticated() ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />
            } 
          />
          
          {/* 404 route */}
          <Route 
            path="*" 
            element={
              <div className="error-404">
                <h2>404 - Page non trouvée</h2>
                <p>La page que vous recherchez n'existe pas.</p>
                <button 
                  onClick={() => window.location.href = isAuthenticated() ? '/home' : '/login'}
                  className="btn btn-primary"
                >
                  Retour à l'accueil
                </button>
              </div>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeader, getCurrentUser, logout, isAuthenticated } from '../utils/auth';
import { API_BASE_URL, getMediaUrl } from '../config';

/**
 * Example component showing how to use authentication throughout the app
 */
function Dashboard() {
    const [user, setUser] = useState(null);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is authenticated
        if (!isAuthenticated()) {
            // Redirect to login if not authenticated
            window.location.href = '/login';
            return;
        }

        // Get current user data
        const currentUser = getCurrentUser();
        setUser(currentUser);

        // Example: Fetch data from protected API endpoint
        fetchProtectedData();
    }, []);

    const fetchProtectedData = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/protected-endpoint/`, {
                headers: getAuthHeader()
            });
            
            setData(response.data);
        } catch (error) {
            console.error('Error fetching protected data:', error);
            if (error.response?.status === 401) {
                // Token expired or invalid, logout user
                handleLogout();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                <h1>Dashboard</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {user && (
                        <div>
                            Bienvenue, {user.prenom || user.username}!
                            {user.avatar_url && (
                                <img 
                                    src={getMediaUrl(user.avatar_url)} 
                                    alt="Avatar" 
                                    style={{ width: '32px', height: '32px', borderRadius: '50%', marginLeft: '0.5rem' }}
                                />
                            )}
                        </div>
                    )}
                    <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
                        Déconnexion
                    </button>
                </div>
            </header>

            <main style={{ padding: '1rem' }}>
                {user && (
                    <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                        <h2>Informations du profil</h2>
                        <p><strong>Nom d'utilisateur:</strong> {user.username}</p>
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Matricule:</strong> {user.matricule}</p>
                        <p><strong>Rôle:</strong> {user.role}</p>
                        <p><strong>Faculté:</strong> {user.faculte}</p>
                        <p><strong>Université:</strong> {user.universite}</p>
                        <p><strong>Province:</strong> {user.province}</p>
                    </div>
                )}

                {/* Your dashboard content here */}
                <div>
                    <h2>Contenu du tableau de bord</h2>
                    {/* Add your dashboard components here */}
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
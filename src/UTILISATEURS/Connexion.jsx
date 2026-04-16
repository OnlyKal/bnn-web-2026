
import logo from '../Images/logoblan.png';
import bgVideo from '../assets/bgvideo.mp4';
import { BiSolidUser, BiSolidLock, BiSolidCheckCircle, BiSolidErrorCircle } from 'react-icons/bi';
import { BsEyeFill, BsEyeSlash, BsEyeSlashFill } from 'react-icons/bs';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveSession, isAuthenticated } from '../utils/auth';
import { authAPI } from '../services/api';



function Connexion() {

    const [afficherPassword, modifierPassword] = useState("faux");
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    // Check if user is already authenticated
    useEffect(() => {
        if (isAuthenticated()) {
            // console.log('User is already logged in');
            navigate('/home');
        }
    }, [navigate]);

    // Login function
    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setError('Veuillez remplir tous les champs');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await authAPI.login({
                username: username.trim(),
                password: password
            });

            // Normalize different API response shapes: token may be at response.token, response.data.token, or response.access
            const token = response?.token || response?.data?.token || response?.access || null;
            const userData = response?.data || response?.user || response;

            if (token) {
                // Save session
                saveSession(token, userData);

                setSuccess(response.message || 'Connexion réussie !');

                // Clear form
                setUsername('');
                setPassword('');

                // Redirect to HomePage after successful login
                setTimeout(() => {
                    // console.log('User logged in successfully:', userData);
                    navigate('/home');
                }, 1000);
            } else {
                // Show API message if provided, otherwise standardize the message
                setError(response?.message || "Nom d'utilisateur ou mot de passe incorrect.");
            }
        } catch (err) {
            console.error('Login error:', err);
            if (err.response) {
                // If server indicates unauthorized/invalid credentials, show standardized message
                if (err.response.status === 401 || err.response.status === 400) {
                    setError("Nom d'utilisateur ou mot de passe incorrect.");
                } else {
                    const errorMessage = err.response.data?.message || 
                                       err.response.data?.error || 
                                       'Erreur de connexion';
                    setError(errorMessage);
                }
            } else if (err.request) {
                // Network error
                setError('Erreur de réseau. Vérifiez votre connexion internet.');
            } else {
                // Other error
                setError('Une erreur inattendue s\'est produite');
            }
        } finally {
            setLoading(false);
        }
    };

    return <div className="page-connexion page">
        {/* Background Video */}
        <video 
            autoPlay 
            muted 
            loop 
            className="background-video"
        >
            <source src={bgVideo} type="video/mp4" />
        </video>
        
        <div className='card-connexion'>
            <img src={logo} alt="Logo" height={80} width={220} className="logo-connexion" />
            
            {/* Error message */}
            {error && (
                <div className="alert alert-error">
                    <BiSolidErrorCircle />
                    {error}
                </div>
            )}
            
            {/* Success message */}
            {success && (
                <div className="alert alert-success">
                    <BiSolidCheckCircle />
                    {success}
                </div>
            )}

            <div className="input-connexion">
                <BiSolidUser 
                    className='icon-connexion' 
                    style={{color: '#000000', fill: '#000000'}}
                />
                <input 
                    type="text" 
                    value={username} 
                    placeholder="Nom d'utilisateur | Email" 
                    className="username-connexion" 
                    onChange={(e)=>setUsername(e.target.value)}
                    disabled={loading}
                />
            </div>
            <div className="input-connexion">
                <BiSolidLock 
                    className='icon-connexion' 
                    style={{color: '#000000', fill: '#000000'}}
                />
                <input 
                    type={afficherPassword == "vrai"? "text":"password"}  
                    value={password} 
                    placeholder="Mot de passe" 
                    className="password-connexion"  
                    onChange={(e)=>setPassword(e.target.value)}
                    disabled={loading}
                    onKeyPress={(e) => e.key === 'Enter' && !loading && handleLogin()}
                />
               
                <div onClick={() => modifierPassword(afficherPassword == "faux" ? "vrai" : "faux")} className='icon-password-connexion'>
                    {afficherPassword == "vrai" ? <BsEyeFill className='icon-' /> :
                        <BsEyeSlashFill className='icon-' />}
                </div>

            </div>
            <div 
                className="forgot-password"
                onClick={() => navigate('/reset-password')}
            >
                Mot de passe oublié ?
            </div>
            <button 
                className="button-connexion" 
                onClick={handleLogin}
                disabled={loading}
            > 
                {loading ? 'CONNEXION...' : 'SE CONNECTER'}
            </button>
            <div className='inscription-btn'>
                <div className='pas-de-compte'>Pas encore de compte ? </div>
                <div 
                    className='inscription'
                    onClick={() => navigate('/provinces')}
                >
                    Inscription
                </div>
            </div>
        </div>
    </div>
}


export default Connexion 
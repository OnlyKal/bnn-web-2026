import logo from '../Images/logoblan.png';
import bgVideo from '../assets/bgvideo.mp4';
import { BiSolidEnvelope } from 'react-icons/bi';
import { FaArrowLeft } from 'react-icons/fa';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';

function ResetPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const { toasts, removeToast, showError, showSuccess } = useToast();
    const navigate = useNavigate();

    // Validate email format
    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    // Handle password reset
    const handlePasswordReset = async () => {
        if (!email.trim()) {
            showError('Veuillez entrer votre adresse email');
            return;
        }

        if (!validateEmail(email.trim())) {
            showError('Veuillez entrer une adresse email valide');
            return;
        }

        setLoading(true);

        try {
            // console.log('🚀 Sending password reset request for:', email.trim());
            const response = await authAPI.resetPassword({
                email: email.trim()
            });

            // console.log('📥 Password reset response:', response);
            
            // Check for successful response (expecting status: 200 and message)
            if (response && response.status === 200) {
                // Use the exact message from API or fallback
                const successMessage = response.message || 
                                     'Mot de passe réinitialisé et envoyé par mail avec succès';
                
                // console.log('✅ Password reset successful, showing success message:', successMessage);
                showSuccess(successMessage);
                setSubmitted(true);
                setEmail(''); // Clear form
                
                // Redirect to login after 3 seconds (give time to read message)
                // console.log('⏰ Setting up redirect to /login in 3 seconds...');
                setTimeout(() => {
                    // console.log('🔄 Redirecting to login page now...');
                    navigate('/login');
                }, 3000);
            } else {
                // Handle unexpected response format
                const errorMessage = response?.message || 
                                   response?.error || 
                                   response?.detail ||
                                   'Réponse inattendue du serveur';
                // console.log('⚠️ Unexpected password reset response:', response);
                showError(errorMessage);
            }
        } catch (err) {
            console.error('Password reset error:', err);
            
            // Use the error message directly from the API function
            showError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-connexion page">
            {/* Background Video */}
            <video 
                autoPlay 
                muted 
                loop 
                className="background-video"
            >
                <source src={bgVideo} type="video/mp4" />
            </video>
            
            <ToastContainer toasts={toasts} onClose={removeToast} />
            
            <div className='card-connexion'>
                {/* Back button */}
                <button 
                    className="reset-back-btn"
                    onClick={() => navigate('/login')}
                >
                    <FaArrowLeft />
                    Retour à la connexion
                </button>

                <img src={logo} alt="Logo" height={55} width={155} className="logo-connexion" />
                
                <div className="reset-title">
                    <h3 style={{color: 'white', textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem'}}>
                        Réinitialiser le mot de passe
                    </h3>
                    <p style={{color: '#ccc', textAlign: 'center', fontSize: '0.7rem', marginBottom: '8px'}}>
                        Entrez votre adresse email pour recevoir un nouveau mot de passe
                    </p>
                </div>

                <div className="input-connexion">
                    <BiSolidEnvelope 
                        className='icon-connexion' 
                        style={{color: '#000000', fill: '#000000'}}
                    />
                    <input 
                        type="email" 
                        value={email} 
                        placeholder="Votre adresse email" 
                        className="email-reset" 
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading || submitted}
                        onKeyPress={(e) => e.key === 'Enter' && !loading && !submitted && handlePasswordReset()}
                    />
                </div>

                <button 
                    className="button-connexion" 
                    onClick={handlePasswordReset}
                    disabled={loading || submitted}
                > 
                    {loading ? 'ENVOI EN COURS...' : 'ENVOYER'}
                </button>

                <div className='reset-info'>
                    <p style={{color: '#ccc', fontSize: '0.65rem', textAlign: 'center', marginTop: '8px'}}>
                        Vous recevrez un email avec votre nouveau mot de passe.Pensez à vérifier votre dossier spam.
                    </p>
                    
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;

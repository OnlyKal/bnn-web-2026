import logo from '../Images/logoblan.png';
import bgVideo from '../assets/bgvideo.mp4';
import { BiSolidEnvelope, BiSolidCheckCircle, BiSolidErrorCircle } from 'react-icons/bi';
import { FaArrowLeft } from 'react-icons/fa';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';

function ResetPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    // Validate email format
    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    // Handle password reset
    const handlePasswordReset = async () => {
        if (!email.trim()) {
            setError('Veuillez entrer votre adresse email');
            return;
        }

        if (!validateEmail(email.trim())) {
            setError('Veuillez entrer une adresse email valide');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

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
                setSuccess(successMessage);
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
                setError(errorMessage);
            }
        } catch (err) {
            console.error('Password reset error:', err);
            
            // Use the error message directly from the API function
            setError(err.message);
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
            
            <div className='card-connexion'>
                {/* Back button */}
                <button 
                    className="reset-back-btn"
                    onClick={() => navigate('/login')}
                >
                    <FaArrowLeft />
                    Retour à la connexion
                </button>

                <img src={logo} alt="Logo" height={80} width={220} className="logo-connexion" />
                
                <div className="reset-title">
                    <h3 style={{color: 'white', textAlign: 'center', marginBottom: '20px'}}>
                        Réinitialiser le mot de passe
                    </h3>
                    <p style={{color: '#ccc', textAlign: 'center', fontSize: '14px', marginBottom: '15px'}}>
                        Entrez votre adresse email pour recevoir un nouveau mot de passe
                    </p>
                </div>
                
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
                        <div>
                            {success}
                            <div style={{fontSize: '12px', marginTop: '8px', fontStyle: 'italic'}}>
                                Redirection vers la connexion dans 3 secondes...
                            </div>
                            <div style={{fontSize: '10px', marginTop: '5px', color: '#666'}}>
                                Vous pouvez aussi cliquer sur "Retour à la connexion" ci-dessus
                            </div>
                        </div>
                    </div>
                )}

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
                        disabled={loading || success}
                        onKeyPress={(e) => e.key === 'Enter' && !loading && !success && handlePasswordReset()}
                    />
                </div>

                <button 
                    className="button-connexion" 
                    onClick={handlePasswordReset}
                    disabled={loading || success}
                > 
                    {loading ? 'ENVOI EN COURS...' : 'ENVOYER'}
                </button>

                <div className='reset-info'>
                    <p style={{color: '#ccc', fontSize: '12px', textAlign: 'center', marginTop: '15px'}}>
                        Vous recevrez un email avec votre nouveau mot de passe.
                    </p>
                    <p style={{color: '#ccc', fontSize: '12px', textAlign: 'center', marginTop: '5px'}}>
                        Pensez à vérifier votre dossier spam.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;

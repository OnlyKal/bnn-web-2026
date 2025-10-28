
import logo from '../Images/logoblan.png';
import { BiSolidUser, BiSolidLock } from 'react-icons/bi';
import { BsEyeFill, BsEyeSlash, BsEyeSlashFill } from 'react-icons/bs';
import { useState } from 'react';



function Connexion() {

    const [afficherPassword, modifierPassword] = useState("faux");
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    return <div className="page-connexion page">
        <div className='card-connexion'>
            <img src={logo} alt="Logo" height={80} width={220} className="logo-connexion" />
            <div className="input-connexion">
                <BiSolidUser className='icon-connexion' />
                <input type="text" value={username} placeholder="Nom d'utilisateur | Email" className="username-connexion" onChange={(e)=>setUsername(e.target.value)} />
            </div>
            <div className="input-connexion">
                <BiSolidLock className='icon-connexion' />
                <input type={afficherPassword == "vrai"? "text":"password"}  value={password} placeholder="Mot de passe" className="password-connexion"  onChange={(e)=>setPassword(e.target.value)}/>
               
                <div onClick={() => modifierPassword(afficherPassword == "faux" ? "vrai" : "faux")} className='icon-password-connexion'>
                    {afficherPassword == "vrai" ? <BsEyeFill className='icon-' /> :
                        <BsEyeSlashFill className='icon-' />}
                </div>

            </div>
            <a href="/reset-password" className="forgot-password">Mot de passe oublié ?</a>
            <button className="button-connexion" onClick={()=>console.log({username,password})}> SE CONNECTER </button>
            <div className='inscription-btn'>
                <div className='pas-de-compte'>Pas encore un compte ? </div>
                <div className='inscription'>S'inscrire  </div>
            </div>
        </div>
    </div>
}


export default Connexion 
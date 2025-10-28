import React from "react";

function TypeUtilisateurs() {


      var listeTypes = [{name:'Chercheur', value:"chercheur"}, { name:'Professeur',value:'professeur'}, {name: 'Etudiant(e)', value:'etudiant'
      }, {name:'Autres', value:'autres'}];

    return (
        <div className="type-utilisateurs">
            <h2 className="type-title">Choisissez le type de compte</h2>

            <p className="type-note">En fonction du type de compte, le site vous proposera des fonctionnalités adaptées.</p>

            <div className="type-buttons">
                {listeTypes.map((type, index) => (
                    <button key={index} className="type-btn" onClick={()=>alert(type.value)}>
                        {type.name}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default TypeUtilisateurs;
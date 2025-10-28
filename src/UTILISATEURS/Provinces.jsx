import React, { useState } from 'react';
import provincesData from '../assets/province.json';

function Provinces() {
  const [query, setQuery] = useState('');

  const provinces = provincesData.provinces || [];

  const filtered = provinces.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.nom.toLowerCase().includes(q) ||
      p.chef_lieu.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="province-page">
      <div className="provinces-container">
        <div className="provinces-header">
          <h2 className="titre-province">Selectionner la Province</h2>
          <input
            aria-label="Rechercher une province"
            className="search-input"
            placeholder="Rechercher Province | Chef lieu ou Code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="province-grid">
          {filtered.map((p) => (
            <article key={p.code} className="province-card">
              <div className="province-badge">{p.code}</div>
              <div className="province-info">
                <div className="province-name">{p.nom}</div>
                <div className="province-seat">Chef-lieu: <span>{p.chef_lieu}</span></div>
              </div>
            </article>
          ))}

          {filtered.length === 0 && (
            <div className="no-results">Aucune province trouvée.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Provinces;
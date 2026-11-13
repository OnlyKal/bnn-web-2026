import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaBuilding, FaChevronRight, FaMapMarkerAlt, FaSearch, FaTimes, FaUniversity } from 'react-icons/fa';
import { isAuthenticated, logout } from '../utils/auth';
import RegistrationLayout from '../components/registration/RegistrationLayout';
import { findProvinceKey, getEtablissementLogo, getEtablissements, searchEtablissements } from '../utils/etablissements';

const PAGE_SIZE = 40;
const STATUTS = [
  { value: '', label: 'Tous' },
  { value: 'Public', label: 'Publics' },
  { value: 'Privé', label: 'Privés' }
];

function UniversiteLogo({ universite }) {
  const [failed, setFailed] = useState(false);
  const src = getEtablissementLogo(universite);
  if (!src || failed) {
    return <span className="reg-logo reg-logo-placeholder"><FaUniversity aria-hidden="true" /></span>;
  }
  return (
    <span className="reg-logo">
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

function SelectUniversite() {
  const [query, setQuery] = useState('');
  const [statut, setStatut] = useState('');
  const [allProvinces, setAllProvinces] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedProvince = location.state?.selectedProvince;
  const deferredQuery = useDeferredValue(query);

  // Check authentication status
  useEffect(() => {
    setIsUserAuthenticated(isAuthenticated());
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goToHome = () => {
    navigate('/home');
  };

  const handleUniversiteSelect = (universite) => {
    if (isUserAuthenticated) {
      // If user is authenticated, just show selection
      alert(`Université sélectionnée: ${universite.name}`);
    } else {
      // If user is not authenticated, redirect to user types with selected province and university
      navigate('/user-types', {
        state: {
          selectedProvince: selectedProvince,
          selectedUniversite: {
            nom: universite.name,
            shortname: universite.shortname || universite.code || '',
            logo: universite.path
          }
        }
      });
    }
  };

  const goBackToProvinces = () => {
    navigate('/provinces');
  };

  const hasProvince = Boolean(findProvinceKey(selectedProvince?.nom));
  const searchAll = allProvinces || !hasProvince;
  const scope = useMemo(
    () => getEtablissements(searchAll ? null : selectedProvince?.nom),
    [searchAll, selectedProvince?.nom]
  );
  const matches = useMemo(() => searchEtablissements(scope, deferredQuery), [scope, deferredQuery]);
  const counts = useMemo(() => ({
    '': matches.length,
    Public: matches.filter((u) => u.statut === 'Public').length,
    'Privé': matches.filter((u) => u.statut === 'Privé').length
  }), [matches]);
  const filtered = statut ? matches.filter((u) => u.statut === statut) : matches;
  const shown = filtered.slice(0, visible);
  const isStale = query !== deferredQuery;

  // Revenir en haut de la liste quand la recherche change.
  useEffect(() => { setVisible(PAGE_SIZE); }, [deferredQuery, statut, searchAll]);

  return (
    <RegistrationLayout
      step={2}
      title="Choisissez votre établissement"
      subtitle="Recherchez votre université ou institut par son nom, son sigle ou sa ville."
      summary={selectedProvince ? [{ label: 'Province', value: selectedProvince.nom, onEdit: goBackToProvinces }] : []}
      back={{ label: 'Changer de province', onClick: goBackToProvinces }}
      isAuthenticated={isUserAuthenticated}
      onHome={goToHome}
      onLogout={handleLogout}
    >
      <div className="reg-toolbar">
        <label className="reg-search">
          <FaSearch className="reg-search-icon" aria-hidden="true" />
          <input
            type="search"
            aria-label="Rechercher un établissement"
            placeholder="Ex. : UNIKIN, ISP Bukavu, université Kisangani…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button type="button" className="reg-search-clear" onClick={() => setQuery('')} aria-label="Effacer la recherche">
              <FaTimes aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="reg-filters">
          <div className="reg-chips" role="group" aria-label="Statut de l'établissement">
            {STATUTS.map((option) => (
              <button
                key={option.value || 'all'}
                type="button"
                className={`reg-chip ${statut === option.value ? 'active' : ''}`}
                aria-pressed={statut === option.value}
                onClick={() => setStatut(option.value)}
              >
                {option.label} <span className="reg-chip-count">{counts[option.value]}</span>
              </button>
            ))}
          </div>
          {hasProvince && (
            <label className="reg-switch">
              <input type="checkbox" checked={allProvinces} onChange={(e) => setAllProvinces(e.target.checked)} />
              <span>Toutes les provinces</span>
            </label>
          )}
        </div>

        <p className="reg-count" aria-live="polite">
          {filtered.length} établissement{filtered.length > 1 ? 's' : ''}
          {searchAll ? ' dans toutes les provinces' : ` · ${selectedProvince.nom}`}
        </p>
      </div>

      {filtered.length > 0 ? (
        <>
          <ul className={`reg-list ${isStale ? 'stale' : ''}`}>
            {shown.map((u) => (
              <li key={u.id}>
                <button type="button" className="reg-option reg-option-row" onClick={() => handleUniversiteSelect(u)}>
                  <UniversiteLogo universite={u} />
                  <span className="reg-option-text">
                    <span className="reg-option-title">{u.name}</span>
                    <span className="reg-option-meta">
                      {u.shortname && <span className="reg-sigle">{u.shortname}</span>}
                      {(u.territoire || searchAll) && (
                        <span className="reg-place">
                          <FaMapMarkerAlt aria-hidden="true" />
                          {[u.territoire, searchAll ? u.province : null].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      {u.statut && <span className={`reg-badge ${u.statut === 'Public' ? 'public' : 'prive'}`}>{u.statut}</span>}
                    </span>
                  </span>
                  <FaChevronRight className="reg-option-chevron" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {filtered.length > shown.length && (
            <div className="reg-more">
              <button type="button" className="reg-btn reg-btn-outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Afficher plus ({filtered.length - shown.length} restants)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="reg-empty">
          <FaBuilding className="reg-empty-icon" aria-hidden="true" />
          <h2>Aucun établissement trouvé</h2>
          <p>
            {query ? `Aucun établissement ne correspond à « ${query} »` : 'Aucun établissement ne correspond à ce filtre'}
            {searchAll ? '.' : ` dans la province ${selectedProvince.nom}.`}
          </p>
          <div className="reg-empty-actions">
            {!searchAll && (
              <button type="button" className="reg-btn reg-btn-primary" onClick={() => setAllProvinces(true)}>
                Chercher dans toutes les provinces
              </button>
            )}
            {(query || statut) && (
              <button type="button" className="reg-btn reg-btn-outline" onClick={() => { setQuery(''); setStatut(''); }}>
                Effacer la recherche
              </button>
            )}
          </div>
        </div>
      )}
    </RegistrationLayout>
  );
}

export default SelectUniversite;

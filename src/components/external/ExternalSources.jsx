import React, { useEffect, useState } from 'react';
import { FaBookOpen, FaFileAlt } from 'react-icons/fa';
import ExternalResources from './ExternalResources';
import OpenAlexResources from './OpenAlexResources';
import '../../styles/ExternalSources.css';

const STORAGE_KEY = 'homepageExternalSource';

const SOURCES = [
    { id: 'hal', title: 'HAL', subtitle: 'Hyper Articles en Ligne', icon: <FaFileAlt className="external-sources-tab-icon" aria-hidden="true" /> },
    { id: 'openalex', title: 'OpenAlex', subtitle: 'Librairie', icon: <FaBookOpen className="external-sources-tab-icon" aria-hidden="true" /> }
];

/** Ressources externes : sous-onglets HAL et OpenAlex Librairie. */
const ExternalSources = () => {
    const [source, setSource] = useState(() => (sessionStorage.getItem(STORAGE_KEY) === 'openalex' ? 'openalex' : 'hal'));

    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY, source);
    }, [source]);

    return (
        <div className="external-sources">
            <div className="external-sources-tabs" role="tablist" aria-label="Sources des ressources externes">
                {SOURCES.map(({ id, title, subtitle, icon }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        id={`external-source-tab-${id}`}
                        aria-selected={source === id}
                        aria-controls={`external-source-panel-${id}`}
                        className={`external-sources-tab ${source === id ? 'active' : ''}`}
                        onClick={() => setSource(id)}
                    >
                        {icon}
                        <span className="external-sources-tab-text">
                            <span className="external-sources-tab-title">{title}</span>
                            <span className="external-sources-tab-subtitle">{subtitle}</span>
                        </span>
                    </button>
                ))}
            </div>

            <div role="tabpanel" id={`external-source-panel-${source}`} aria-labelledby={`external-source-tab-${source}`}>
                {source === 'hal' ? <ExternalResources /> : <OpenAlexResources />}
            </div>
        </div>
    );
};

export default ExternalSources;

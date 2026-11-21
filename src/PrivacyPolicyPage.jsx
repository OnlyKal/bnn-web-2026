import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuArrowLeft, LuArrowUp, LuCalendar, LuShieldCheck } from 'react-icons/lu';
import logoBlancImg from './assets/Logoblanc.png';
import { isAuthenticated } from './utils/auth';
import { setPageTitle } from './utils/pageTitle';
import { privacyPolicy } from './content/privacyPolicy';
import './styles/PrivacyPolicy.css';

/**
 * Page publique de la politique de confidentialité (/privacypolicy).
 * Accessible sans connexion : elle est référencée par l'application mobile et les stores.
 */
function PrivacyPolicyPage() {
    const navigate = useNavigate();
    const loggedIn = isAuthenticated();
    const [activeSection, setActiveSection] = useState(privacyPolicy.sections[0].id);
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        setPageTitle(privacyPolicy.title);
    }, []);

    // Met en évidence, dans le sommaire, la section en cours de lecture.
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveSection(visible[0].target.id);
            },
            { rootMargin: '-90px 0px -60% 0px' }
        );
        privacyPolicy.sections.forEach(({ id }) => {
            const element = document.getElementById(id);
            if (element) observer.observe(element);
        });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const onScroll = () => setShowBackToTop(window.scrollY > 600);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollToSection = (event, id) => {
        event.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${id}`);
    };

    return (
        <div className="privacy-page">
            <header className="privacy-header">
                <div className="privacy-header-content">
                    <button
                        type="button"
                        className="privacy-brand"
                        onClick={() => navigate(loggedIn ? '/home' : '/login')}
                        aria-label="Retour à la Bibliothèque Numérique Nationale"
                    >
                        <img src={logoBlancImg} alt="BNN ESURSI" className="privacy-logo" />
                    </button>
                    <button
                        type="button"
                        className="privacy-header-action"
                        onClick={() => navigate(loggedIn ? '/home' : '/login')}
                    >
                        <LuArrowLeft size={16} aria-hidden="true" />
                        {loggedIn ? "Retour à l'accueil" : 'Se connecter'}
                    </button>
                </div>
            </header>

            <main className="privacy-main">
                <section className="privacy-hero" aria-labelledby="privacy-title">
                    <span className="privacy-eyebrow">
                        <LuShieldCheck aria-hidden="true" />
                        Protection des données
                    </span>
                    <h1 id="privacy-title">{privacyPolicy.title}</h1>
                    <p className="privacy-organization">{privacyPolicy.organization}</p>
                    <p className="privacy-updated">
                        <LuCalendar aria-hidden="true" />
                        Dernière mise à jour : {privacyPolicy.lastUpdated}
                    </p>
                </section>

                <div className="privacy-layout">
                    <nav className="privacy-toc" aria-label="Sommaire">
                        <p className="privacy-toc-title">Sommaire</p>
                        <ol>
                            {privacyPolicy.sections.map((section, index) => (
                                <li key={section.id}>
                                    <a
                                        href={`#${section.id}`}
                                        className={activeSection === section.id ? 'active' : ''}
                                        aria-current={activeSection === section.id ? 'true' : undefined}
                                        onClick={(event) => scrollToSection(event, section.id)}
                                    >
                                        <span className="privacy-toc-number">{index + 1}</span>
                                        {section.title}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>

                    <article className="privacy-content">
                        {privacyPolicy.sections.map((section, index) => (
                            <section key={section.id} id={section.id} className="privacy-section" aria-labelledby={`${section.id}-title`}>
                                <h2 id={`${section.id}-title`}>
                                    <span className="privacy-section-number">{index + 1}</span>
                                    {section.title}
                                </h2>

                                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

                                {section.definitions && (
                                    <dl className="privacy-definitions">
                                        {section.definitions.map((item) => (
                                            <div key={item.term}>
                                                <dt>{item.term}</dt>
                                                <dd>{item.text}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}

                                {section.list && (
                                    <ul className="privacy-list">
                                        {section.list.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                )}

                                {section.closing?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

                                {section.contact && (
                                    <dl className="privacy-contact">
                                        {section.contact.map((item) => (
                                            <div key={item.label}>
                                                <dt>{item.label}</dt>
                                                <dd>{item.value}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                            </section>
                        ))}
                    </article>
                </div>
            </main>

            <footer className="privacy-footer">
                <img src={logoBlancImg} alt="" className="privacy-footer-logo" aria-hidden="true" />
                <p className="privacy-footer-org">{privacyPolicy.organization}</p>
                <p className="privacy-footer-tagline">{privacyPolicy.tagline}</p>
            </footer>

            {showBackToTop && (
                <button
                    type="button"
                    className="privacy-back-to-top"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    aria-label="Revenir en haut de la page"
                >
                    <LuArrowUp size={20} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

export default PrivacyPolicyPage;

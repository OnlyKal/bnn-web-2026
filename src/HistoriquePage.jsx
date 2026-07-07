import React, { useEffect } from 'react';
import { LuHistory } from 'react-icons/lu';
import AppNavigation from './components/AppNavigation';
import RecentHistory from './components/RecentHistory';
import { markLocalHistorySeen } from './utils/localHistory';

const HistoriquePage = () => {
    useEffect(() => {
        markLocalHistorySeen();
    }, []);

    return (
        <div className="history-page">
            <AppNavigation />
            <main className="history-main">
                <section className="history-hero" aria-labelledby="history-page-title">
                    <span className="history-eyebrow">
                        <LuHistory />
                        Activité locale
                    </span>
                    <h1 id="history-page-title">Historique</h1>
                    <p>
                        Retrouvez vos activités récentes, stockées uniquement dans ce navigateur.
                    </p>
                </section>
                <RecentHistory />
            </main>
        </div>
    );
};

export default HistoriquePage;

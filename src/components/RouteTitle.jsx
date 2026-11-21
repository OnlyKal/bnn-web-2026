import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ownsTitle, routeContext, setPageTitle } from '../utils/pageTitle';

/** Met à jour le titre de l'onglet à chaque changement de page. */
const RouteTitle = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        if (!ownsTitle(pathname)) setPageTitle(routeContext(pathname));
    }, [pathname]);
    return null;
};

export default RouteTitle;

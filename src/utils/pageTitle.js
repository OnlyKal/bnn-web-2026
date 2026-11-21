/** Titre d'onglet commun à toute l'application : « BNN ESURSI : {contexte} ». */
export const APP_TITLE = 'BNN ESURSI';

export const formatPageTitle = (context) => (context ? `${APP_TITLE} : ${context}` : APP_TITLE);

export const setPageTitle = (context) => {
    document.title = formatPageTitle(context);
};

// Titre par route. Les routes absentes de cette liste (encyclopédie, politique de
// confidentialité) fixent elles-mêmes un contexte plus précis.
const ROUTE_TITLES = [
    [/^\/login\/?$/, 'Connexion'],
    [/^\/register\/?$/, 'Inscription'],
    [/^\/reset-password\/?$/, 'Réinitialisation du mot de passe'],
    [/^\/provinces\/?$/, 'Choix de la province'],
    [/^\/user-types\/?$/, "Type d'utilisateur"],
    [/^\/select-universite\/?$/, "Choix de l'université"],
    [/^\/home\/?$/, 'Accueil'],
    [/^\/profile\/statistiques\/?$/, 'Statistiques'],
    [/^\/profile\/consultations\/?$/, 'Statistiques de consultation'],
    [/^\/profile\/?$/, 'Profil'],
    [/^\/ressources\//, 'Ressource'],
    [/^\/favoris\/?$/, 'Favoris'],
    [/^\/salons\/?$/, 'Salons'],
    [/^\/historique\/?$/, 'Historique'],
];

/** Routes dont la page fixe elle-même son titre. */
export const ownsTitle = (pathname) => pathname.startsWith('/rdc') || pathname.startsWith('/privacypolicy');

export const routeContext = (pathname) => {
    const match = ROUTE_TITLES.find(([pattern]) => pattern.test(pathname));
    return match ? match[1] : 'Page introuvable';
};

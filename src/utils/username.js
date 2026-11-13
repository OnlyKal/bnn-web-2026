// Nom d'utilisateur généré à l'inscription : nom + 2 premières lettres du prénom + 2 chiffres
// (ex. nom « Justin », prénom « Bihango » → JustinBi02).

const USERNAME_MAX_LENGTH = 20;

// Sans accents ni caractères spéciaux, chaque mot avec une majuscule initiale.
const toUsernamePart = (value) => (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

export const randomUsernameSuffix = () => String(Math.floor(Math.random() * 100)).padStart(2, '0');

export const buildUsername = (nom, prenom, suffix) => {
    const prefix = toUsernamePart(prenom).slice(0, 2);
    const base = toUsernamePart(nom).slice(0, USERNAME_MAX_LENGTH - prefix.length - suffix.length);
    return base ? `${base}${prefix}${suffix}` : '';
};

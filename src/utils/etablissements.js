import etablissementsData from '../assets/etab_update.json';

// Logos embarqués par Vite (les fichiers de src/assets ne sont servis que s'ils sont importés).
const logoUrls = Object.fromEntries(
    Object.entries(import.meta.glob('../assets/LOGO/*', { eager: true, query: '?url', import: 'default' }))
        .map(([path, url]) => [path.split('/').pop(), url])
);

export const getEtablissementLogo = (etablissement) => {
    const file = (etablissement?.path || '').split('/').pop();
    return (file && logoUrls[file]) || null;
};

/** Texte comparable : sans accents, minuscules, ponctuation remplacée par des espaces. */
export const normalizeSearch = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeProvince = (value) => normalizeSearch(value).replace(/\s+/g, '-');

/** Clé de etab_update.json correspondant à une province (sans accents, espaces ou tirets). */
export const findProvinceKey = (provinceNom) => {
    if (!provinceNom) return null;
    const target = normalizeProvince(provinceNom);
    return Object.keys(etablissementsData).find((key) => normalizeProvince(key) === target) || null;
};

// Index de recherche calculé une seule fois.
const allEtablissements = Object.entries(etablissementsData).flatMap(([province, items]) =>
    items.map((item, index) => ({
        ...item,
        province,
        id: `${province}-${index}`,
        searchName: normalizeSearch(item.name),
        searchSigle: normalizeSearch(item.shortname || item.code),
        searchPlace: normalizeSearch(`${item.territoire || ''} ${province}`)
    }))
);

export const getEtablissements = (provinceNom) => {
    const key = findProvinceKey(provinceNom);
    return key ? allEtablissements.filter((item) => item.province === key) : allEtablissements;
};

export const countEtablissements = (provinceNom) => {
    const key = findProvinceKey(provinceNom);
    return key ? etablissementsData[key].length : 0;
};

/**
 * Recherche par mots (ordre libre, sans accents) dans le nom, le sigle et le lieu,
 * triée par pertinence : sigle exact, début de sigle, début de nom, puis autres.
 */
export const searchEtablissements = (items, query) => {
    const q = normalizeSearch(query);
    if (!q) return items;
    const words = q.split(' ');
    const compactQuery = q.replace(/\s+/g, '');
    const results = [];
    for (const item of items) {
        const haystack = `${item.searchName} ${item.searchSigle} ${item.searchPlace}`;
        if (!words.every((word) => haystack.includes(word))) continue;
        const sigle = item.searchSigle.replace(/\s+/g, '');
        let score = 0;
        if (sigle === compactQuery) score += 100;
        else if (sigle.startsWith(compactQuery)) score += 60;
        if (item.searchName.startsWith(q)) score += 40;
        else if (item.searchName.includes(q)) score += 20;
        // Le premier mot recherché ouvre le nom (« universite … » → les universités d'abord).
        if (item.searchName.startsWith(words[0])) score += 15;
        score += words.filter((word) => item.searchName.split(' ').includes(word)).length * 5;
        results.push({ item, score });
    }
    return results
        .sort((a, b) => b.score - a.score || a.item.searchName.localeCompare(b.item.searchName))
        .map(({ item }) => item);
};

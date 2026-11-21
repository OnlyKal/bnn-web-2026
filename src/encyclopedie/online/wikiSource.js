/**
 * Source « en ligne » de l'encyclopédie RDC : Wikidata (données structurées,
 * licence CC0) et Wikipédia en français (textes et images, CC BY-SA 4.0).
 *
 * Utilisée quand l'API BNN /api/bnn/rdc/ n'est pas disponible. Chaque fonction
 * renvoie exactement la même forme de données que l'API serveur, afin que les
 * pages n'aient pas à distinguer les deux sources.
 *
 * Le contenu à afficher est décrit dans catalogue.json (partagé avec l'app mobile).
 */
import catalogue from './catalogue.json';

const SPARQL_URL = 'https://query.wikidata.org/sparql';
const WIKI_API = 'https://fr.wikipedia.org/w/api.php';
const WIKI_PAGE = 'https://fr.wikipedia.org/wiki/';
const CACHE_PREFIX = 'rdc-online:v2:';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 24;

export const LICENCE_NOTICE = 'Contenus issus de Wikipédia (licence CC BY-SA 4.0) et de Wikidata (CC0).';

const NATURES = {
    article: 'Article thématique',
    evenement: 'Événement',
    personnalite: 'Personnalité',
    institution: 'Institution / texte officiel',
    lieu: 'Ville / lieu',
    infrastructure: 'Infrastructure / ouvrage',
    site_naturel: 'Parc / site naturel',
    espece: 'Espèce (faune, flore)',
    ressource: 'Ressource naturelle',
    patrimoine: 'Patrimoine / culture',
};

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// ------------------------------------------------------------------ index du catalogue

const PROVINCES = catalogue.provinces;
const PROVINCE_BY_QID = Object.fromEntries(PROVINCES.map((p) => [p.qid, p]));
const PROVINCE_BY_SLUG = Object.fromEntries(PROVINCES.map((p) => [p.slug, p]));
const PROVINCE_VALUES = PROVINCES.map((p) => `wd:${p.qid}`).join(' ');

const ROOTS = catalogue.categories;
const SUBS = ROOTS.flatMap((root) => root.enfants.map((sub) => ({ ...sub, racine: root })));
const SUB_BY_SLUG = Object.fromEntries(SUBS.map((s) => [s.slug, s]));
const ROOT_BY_SLUG = Object.fromEntries(ROOTS.map((r) => [r.slug, r]));
const EXCLUDE_EVENTS = new RegExp(catalogue.exclure_evenements, 'i');

const categoryRef = (cat) => ({ id: cat.slug, nom: cat.nom, slug: cat.slug, icone: cat.racine?.icone || cat.icone, couleur: cat.racine?.couleur || cat.couleur });

/** Sous-rubriques visées par un slug (rubrique entière ou sous-rubrique). */
const subsFor = (slug) => {
    if (!slug) return SUBS;
    if (SUB_BY_SLUG[slug]) return [SUB_BY_SLUG[slug]];
    if (ROOT_BY_SLUG[slug]) return SUBS.filter((s) => s.racine.slug === slug);
    return [];
};

// ------------------------------------------------------------------ cache et réseau

const memory = new Map();

const cacheGet = (key) => {
    if (memory.has(key)) return memory.get(key);
    try {
        const raw = window.localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return undefined;
        const { time, data } = JSON.parse(raw);
        if (Date.now() - time > CACHE_TTL) return undefined;
        memory.set(key, data);
        return data;
    } catch {
        return undefined;
    }
};

const cacheSet = (key, data) => {
    memory.set(key, data);
    try {
        window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ time: Date.now(), data }));
    } catch {
        // Quota dépassé : on purge les anciennes entrées de l'encyclopédie et on continue sans cache disque.
        try {
            Object.keys(window.localStorage).filter((k) => k.startsWith('rdc-online:')).forEach((k) => window.localStorage.removeItem(k));
        } catch { /* ignoré */ }
    }
};

const inflight = new Map();

const cached = async (key, loader) => {
    const hit = cacheGet(key);
    if (hit !== undefined) return hit;
    if (inflight.has(key)) return inflight.get(key);
    const promise = loader()
        .then((data) => { cacheSet(key, data); return data; })
        .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
};

const networkError = (error) => {
    const wrapped = new Error('Impossible de joindre Wikipédia / Wikidata. Vérifiez votre connexion internet.');
    wrapped.status = error?.status;
    return wrapped;
};

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Les requêtes ne sont jamais annulées : leurs résultats alimentent un cache
 * partagé (deux composants peuvent attendre la même réponse). Un composant
 * démonté ignore simplement le résultat (voir useRdcData).
 */
const fetchJson = async (url, attempt = 0) => {
    let response;
    try {
        response = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (error) {
        // Un refus du service sous forte charge arrive parfois sans en-têtes CORS :
        // le navigateur le présente comme une erreur réseau. Une nouvelle tentative, différée.
        if (attempt < 1) {
            await wait(2000);
            return fetchJson(url, attempt + 1);
        }
        throw networkError(error);
    }
    // Trop de requêtes : on patiente (Retry-After, plafonné) puis on réessaie, deux fois au plus.
    if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get('Retry-After')) || 2 + attempt * 3;
        await wait(Math.min(retryAfter, 10) * 1000);
        return fetchJson(url, attempt + 1);
    }
    // Erreur passagère du service (surcharge, délai dépassé) : une nouvelle tentative.
    if ([500, 502, 503, 504].includes(response.status) && attempt < 1) {
        await wait(1500);
        return fetchJson(url, attempt + 1);
    }
    if (!response.ok) {
        const error = new Error(response.status === 429
            ? 'Les serveurs de Wikimedia sont momentanément saturés. Réessayez dans un instant.'
            : 'Le chargement depuis Wikipédia / Wikidata a échoué.');
        error.status = response.status;
        throw error;
    }
    return response.json();
};

// Wikidata limite les requêtes simultanées par visiteur : 3 au plus en parallèle.
const MAX_SPARQL = 3;
let activeSparql = 0;
const sparqlQueue = [];
const acquire = () => new Promise((resolve) => {
    if (activeSparql < MAX_SPARQL) { activeSparql += 1; resolve(); } else sparqlQueue.push(resolve);
});
const release = () => {
    const next = sparqlQueue.shift();
    if (next) next(); else activeSparql -= 1;
};

// eslint-disable-next-line no-unused-vars -- signal accepté pour compatibilité, volontairement ignoré
const sparql = async (query, signal) => {
    await acquire();
    try {
        const url = `${SPARQL_URL}?format=json&query=${encodeURIComponent(query)}`;
        const data = await fetchJson(url);
        return data.results.bindings.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v.value])));
    } finally {
        release();
    }
};

// eslint-disable-next-line no-unused-vars -- voir fetchJson
const wikiApi = (params, signal) => {
    const query = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
    return fetchJson(`${WIKI_API}?${query}`);
};

// ------------------------------------------------------------------ conversions

const qidOf = (uri) => (uri ? uri.split('/').pop() : null);

const parseCoord = (wkt) => {
    const match = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(wkt || '');
    return match ? { longitude: Number(match[1]), latitude: Number(match[2]) } : null;
};

/** Date Wikidata (« +1960-06-30T00:00:00Z », « -0500-01-01… ») → { year, month, day }. */
const parseDate = (value) => {
    const match = /^([+-]?)(\d+)-(\d\d)-(\d\d)/.exec(value || '');
    if (!match) return null;
    const year = Number(match[2]) * (match[1] === '-' ? -1 : 1);
    return { year, month: Number(match[3]), day: Number(match[4]), raw: value };
};

const formatDate = (date) => {
    if (!date) return '';
    const year = date.year < 0 ? `${-date.year} av. J.-C.` : String(date.year);
    // Wikidata code une précision « année » par le 1er janvier : on n'affiche alors que l'année.
    if (date.month === 1 && date.day === 1) return year;
    if (date.day === 1 && date.month > 1) return `${MOIS[date.month - 1]} ${year}`;
    return `${date.day} ${MOIS[date.month - 1]} ${year}`;
};

const libelleDates = (debut, fin) => {
    if (!debut) return '';
    if (fin && fin.year !== debut.year) return `${debut.year < 0 ? formatDate(debut) : debut.year} – ${fin.year < 0 ? formatDate(fin) : fin.year}`;
    return formatDate(debut);
};

const commonsThumb = (fileUrl, width = 640) => {
    if (!fileUrl) return null;
    const file = decodeURIComponent(fileUrl.split('/Special:FilePath/').pop() || '');
    return file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}` : null;
};

const articleTitle = (articleUrl) => (articleUrl ? decodeURIComponent(articleUrl.replace(WIKI_PAGE, '')).replace(/_/g, ' ') : null);

const periodeOf = (year) => {
    if (year === null || year === undefined) return null;
    return catalogue.periodes.find((p) => (p.annee_debut === null || year >= p.annee_debut) && (p.annee_fin === null || year < p.annee_fin)) || null;
};

const fichePublic = (item) => {
    const cat = item.sub ? categoryRef(item.sub) : null;
    return {
        id: item.qid,
        titre: item.titre,
        slug: item.qid,
        resume: item.resume || item.description || '',
        categorie: cat,
        nature: item.nature,
        nature_label: NATURES[item.nature] || NATURES.article,
        image: item.image,
        provinces: item.provinces.map((qid) => PROVINCE_BY_QID[qid]).filter(Boolean).map((p) => ({ id: p.qid, nom: p.nom, slug: p.slug, code: p.code })),
        annee_debut: item.debut?.year ?? null,
        annee_fin: item.fin?.year ?? null,
        libelle_dates: libelleDates(item.debut, item.fin),
        periode_slug: periodeOf(item.debut?.year)?.slug || null,
        latitude: item.coord?.latitude ?? null,
        longitude: item.coord?.longitude ?? null,
        en_vedette: catalogue.vedette.includes(item.qid),
        date_mise_a_jour: null,
        article: item.article,
    };
};

// ------------------------------------------------------------------ requêtes SPARQL des listes
//
// Deux temps, pour rester rapide sur le service public de Wikidata :
//  1. trouver les identifiants des éléments (requête légère, FILTER IN) ;
//  2. charger leurs détails par lots d'identifiants connus (VALUES), avec un
//     cache par élément partagé entre rubriques, carte et provinces.

const IN = (qids) => qids.map((q) => `wd:${q}`).join(', ');
const FR_ARTICLE = '?article_ schema:about ?i; schema:isPartOf <https://fr.wikipedia.org/>.';

const sourceBlock = (source) => {
    if (source.items) return `{ VALUES ?i { ${source.items.map((q) => `wd:${q}`).join(' ')} } BIND("items" AS ?src) }`;
    if (source.classes) {
        return `{ ?i wdt:P17 wd:Q974; wdt:P31 ?cls. FILTER(?cls IN (${IN(source.classes)}))
                  ${source.article ? `FILTER EXISTS { ${FR_ARTICLE} }` : ''} BIND("classe" AS ?src) }`;
    }
    if (source.poste) {
        return `{ ?i p:P39 ?mandat. ?mandat ps:P39 wd:${source.poste}; pq:P580 ?mandatDebut.
                  OPTIONAL { ?mandat pq:P582 ?mandatFin } BIND("poste" AS ?src) }`;
    }
    if (source.propriete) {
        return `{ ?i wdt:${source.propriete[0]} wd:${source.propriete[1]}; wdt:P17 wd:Q974. BIND("propriete" AS ?src) }`;
    }
    if (source.evenements) {
        // VALUES (et non FILTER IN) : on part des 5 pays, pas de toutes les dates de Wikidata.
        return `{ VALUES ?pays { ${catalogue.pays.map((q) => `wd:${q}`).join(' ')} } ?i wdt:P17 ?pays; wdt:P585 ?evt.
                  FILTER EXISTS { ${FR_ARTICLE} } FILTER NOT EXISTS { ?i wdt:P31 wd:Q5 } BIND("evenements" AS ?src) }`;
    }
    return '';
};

/** Déduplique les sources (mêmes classes demandées par plusieurs sous-rubriques). */
const mergeSources = (sources) => {
    const strict = new Set();
    const loose = new Set();
    const items = new Set();
    const others = new Map();
    sources.forEach((src) => {
        if (src.items) src.items.forEach((q) => items.add(q));
        else if (src.classes) src.classes.forEach((q) => (src.article ? strict : loose).add(q));
        else others.set(JSON.stringify(src), src);
    });
    loose.forEach((q) => strict.delete(q));
    const merged = [...others.values()];
    if (strict.size) merged.push({ classes: [...strict], article: true });
    if (loose.size) merged.push({ classes: [...loose], article: false });
    if (items.size) merged.push({ items: [...items] });
    return merged;
};

/** Étape 1 : identifiants (+ classe, origine, mandats) des éléments décrits par des sources. */
const loadIds = (sources, signal) => {
    const merged = mergeSources(sources);
    const key = `ids:${JSON.stringify(merged)}`;
    return cached(key, async () => {
        const rows = await sparql(`SELECT ?i ?cls ?src ?mandatDebut ?mandatFin WHERE {
  ${merged.map(sourceBlock).filter(Boolean).join(' UNION ')}
}`, signal);
        const byQid = {};
        rows.forEach((row) => {
            const qid = qidOf(row.i);
            if (!qid) return;
            const meta = byQid[qid] || (byQid[qid] = { qid, cls: [], src: [], mandats: [] });
            const cls = qidOf(row.cls);
            if (cls && !meta.cls.includes(cls)) meta.cls.push(cls);
            if (row.src && !meta.src.includes(row.src)) meta.src.push(row.src);
            if (row.mandatDebut) meta.mandats.push({ debut: parseDate(row.mandatDebut), fin: parseDate(row.mandatFin) });
        });
        return Object.values(byQid);
    });
};

const DETAIL_BATCH = 120;
const detailCache = new Map();

/** Étape 2 : détails (libellé, article, coordonnées, image, dates, provinces, types) par lots. */
const loadDetails = async (qids, signal) => {
    const missing = qids.filter((q) => !detailCache.has(q) && cacheGet(`det:${q}`) === undefined);
    qids.forEach((q) => { if (!detailCache.has(q) && cacheGet(`det:${q}`) !== undefined) detailCache.set(q, cacheGet(`det:${q}`)); });
    const batches = [];
    for (let i = 0; i < missing.length; i += DETAIL_BATCH) batches.push(missing.slice(i, i + DETAIL_BATCH));
    await Promise.all(batches.map(async (batch) => {
        const rows = await sparql(`SELECT ?i ?label ?desc ?article ?coord ?img ?debut ?fin ?humain ?prov ?type WHERE {
  VALUES ?i { ${batch.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?article schema:about ?i; schema:isPartOf <https://fr.wikipedia.org/> }
  OPTIONAL { ?i wdt:P625 ?coord }
  OPTIONAL { ?i wdt:P18 ?img }
  OPTIONAL { ?i wdt:P585|wdt:P580|wdt:P571|wdt:P1619|wdt:P569 ?debut }
  OPTIONAL { ?i wdt:P582|wdt:P576|wdt:P570 ?fin }
  OPTIONAL { ?i wdt:P31 wd:Q5. BIND(true AS ?humain) }
  OPTIONAL { ?i wdt:P31 ?type }
  OPTIONAL { VALUES ?prov { ${PROVINCE_VALUES} } ?i wdt:P131* ?prov }
  OPTIONAL { ?i rdfs:label ?label FILTER(LANG(?label) = "fr") }
  OPTIONAL { ?i schema:description ?desc FILTER(LANG(?desc) = "fr") }
}`, signal);
        const found = {};
        rows.forEach((row) => {
            const qid = qidOf(row.i);
            const d = found[qid] || (found[qid] = { titre: null, description: '', article: null, coord: null, image: null,
                dates: [], fins: [], humain: false, provinces: [], types: [] });
            if (!d.titre && row.label) d.titre = row.label;
            if (!d.description && row.desc) d.description = row.desc;
            if (!d.article && row.article) d.article = articleTitle(row.article);
            if (!d.coord && row.coord) d.coord = parseCoord(row.coord);
            if (!d.image && row.img) d.image = commonsThumb(row.img);
            if (row.humain) d.humain = true;
            const push = (list, value) => { if (value && !list.includes(value)) list.push(value); };
            push(d.dates, row.debut);
            push(d.fins, row.fin);
            push(d.provinces, qidOf(row.prov));
            push(d.types, qidOf(row.type));
        });
        batch.forEach((qid) => {
            const detail = found[qid] || null;
            detailCache.set(qid, detail);
            cacheSet(`det:${qid}`, detail);
        });
    }));
    return Object.fromEntries(qids.map((q) => [q, detailCache.get(q)]));
};

/** Sous-rubrique (parmi `subs`) d'un élément, d'après sa classe, sa liste explicite ou son origine. */
const resolveSub = (meta, detail, subs) => {
    if (!subs?.length) return null;
    const classes = [...(meta?.cls || []), ...(detail?.types || [])];
    const src = meta?.src || [];
    const byClass = subs.find((s) => s.sources.some((x) => x.classes?.some((c) => classes.includes(c))));
    const explicit = subs.find((s) => s.sources.some((x) => x.items?.includes(meta.qid)));
    // Une liste explicite précise la classe dans la même grande rubrique (ex. Grand Inga : « projets »).
    if (byClass && explicit && explicit.racine.slug === byClass.racine.slug) return explicit;
    return byClass || explicit
        || (src.includes('poste') && subs.find((s) => s.sources.some((x) => x.poste)))
        || (src.includes('evenements') && subs.find((s) => s.sources.some((x) => x.evenements)))
        || (src.includes('propriete') && subs.find((s) => s.sources.some((x) => x.propriete)))
        || null;
};

const DAY = 24 * 3600 * 1000;

/** Assemble identifiants + détails en éléments prêts à afficher. */
const buildItems = (metas, details, subs) => metas.map((meta) => {
    const d = details[meta.qid];
    if (!d || !d.titre) return null;
    // Mandats de moins d'une semaine (intérims) ignorés ; le premier mandat donne la date.
    const mandats = meta.mandats.filter((m) => m.debut && (!m.fin || new Date(m.fin.raw) - new Date(m.debut.raw) >= 7 * DAY))
        .sort((a, b) => a.debut.year - b.debut.year);
    if (meta.mandats.length && !mandats.length) return null;
    if (meta.src.length === 1 && meta.src[0] === 'evenements' && EXCLUDE_EVENTS.test(d.titre)) return null;
    const dates = d.dates.map(parseDate).filter(Boolean).sort((a, b) => a.year - b.year);
    const fins = d.fins.map(parseDate).filter(Boolean).sort((a, b) => b.year - a.year);
    const sub = resolveSub(meta, d, subs);
    return {
        qid: meta.qid, titre: d.titre, description: d.description, article: d.article, coord: d.coord, image: d.image,
        provinces: d.provinces, humain: d.humain, src: meta.src, subSlug: sub?.slug || null,
        debut: mandats.length ? mandats[0].debut : dates[0] || null,
        fin: mandats.length ? mandats[mandats.length - 1].fin : fins[0] || null,
    };
}).filter(Boolean);

/** Rattache les éléments à leur sous-rubrique et calcule leur nature. */
const attach = (items, fallbackSub = null) => items.map((item) => {
    const sub = (item.subSlug && SUB_BY_SLUG[item.subSlug]) || fallbackSub || findSubForQid(item.qid);
    return { ...item, sub, nature: item.humain ? 'personnalite' : sub?.nature || 'article' };
});

/** Identifiants des éléments d'une province (on part de la province : quelques secondes). */
const loadProvinceIds = (subs, province) => {
    const merged = mergeSources(subs.flatMap((s) => s.sources)).filter((src) => src.classes);
    const classes = merged.flatMap((src) => src.classes);
    // Classes pour lesquelles le catalogue exige un article Wikipédia (cours d'eau, lacs…).
    const strict = new Set(merged.filter((src) => src.article).flatMap((src) => src.classes));
    return cached(`ids-prov:${province}:${classes.join(',')}`, async () => {
        const rows = await sparql(`SELECT DISTINCT ?i ?cls ?art WHERE {
  ?i wdt:P131* wd:${province}. ?i wdt:P31 ?cls. FILTER(?cls IN (${IN(classes)}))
  OPTIONAL { ?art schema:about ?i; schema:isPartOf <https://fr.wikipedia.org/> }
}`);
        const byQid = {};
        rows.forEach((row) => {
            const qid = qidOf(row.i);
            const meta = byQid[qid] || (byQid[qid] = { qid, cls: [], src: ['classe'], mandats: [], article: false });
            const cls = qidOf(row.cls);
            if (cls && !meta.cls.includes(cls)) meta.cls.push(cls);
            if (row.art) meta.article = true;
        });
        return Object.values(byQid).filter((meta) => meta.article || meta.cls.some((c) => !strict.has(c)));
    });
};

/** Éléments de sous-rubriques (une seule recherche d'identifiants, détails partagés). */
const itemsFor = async (subs, signal, { province = null, coords = false } = {}) => {
    const metas = province ? await loadProvinceIds(subs, province) : await loadIds(subs.flatMap((s) => s.sources), signal);
    const details = await loadDetails(metas.map((m) => m.qid), signal);
    let items = attach(buildItems(metas, details, subs), subs.length === 1 ? subs[0] : null).filter((item) => item.sub);
    if (province) items = items.filter((item) => item.provinces.includes(province));
    if (coords) items = items.filter((item) => item.coord);
    return items;
};

const subItems = (sub, signal) => itemsFor([sub], signal);

/** Éléments isolés (vedette, fiche) avec rattachement automatique à une rubrique. */
const itemsByQid = async (qids, signal) => {
    const metas = qids.map((qid) => ({ qid, cls: [], src: ['items'], mandats: [] }));
    const details = await loadDetails(qids, signal);
    return attach(buildItems(metas, details, SUBS));
};

/** Résumés et vignettes Wikipédia pour une page de résultats (par lots de 20). */
const enrich = async (items, signal) => {
    const titles = [...new Set(items.filter((i) => i.article).map((i) => i.article))];
    const extracts = {};
    for (let index = 0; index < titles.length; index += 20) {
        const batch = titles.slice(index, index + 20);
        const key = `extr:${batch.join('|')}`;
        const data = await cached(key, async () => {
            const json = await wikiApi({
                action: 'query', prop: 'extracts|pageimages', titles: batch.join('|'), redirects: '1',
                exintro: '1', explaintext: '1', exsentences: '2', exlimit: '20', piprop: 'thumbnail', pithumbsize: '480',
            }, signal);
            const redirects = Object.fromEntries((json.query?.redirects || []).map((r) => [r.to, r.from]));
            const out = {};
            (json.query?.pages || []).forEach((page) => {
                out[redirects[page.title] || page.title] = { extract: page.extract || '', thumb: page.thumbnail?.source || null };
            });
            return out;
        });
        Object.assign(extracts, data);
    }
    return items.map((item) => {
        const extra = extracts[item.article];
        return extra ? { ...item, resume: extra.extract || item.description, image: item.image || extra.thumb } : item;
    });
};

const textMatch = (item, q) => {
    const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const haystack = norm(`${item.titre} ${item.description} ${item.resume || ''}`);
    return norm(q).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
};

const sortItems = (items, ordering) => {
    const byTitle = (a, b) => a.titre.localeCompare(b.titre, 'fr');
    const year = (i) => i.debut?.year ?? Number.POSITIVE_INFINITY;
    if (ordering === 'chronologique') return [...items].sort((a, b) => year(a) - year(b) || byTitle(a, b));
    if (ordering === '-chronologique') return [...items].sort((a, b) => year(b) - year(a) || byTitle(a, b));
    if (ordering === 'recent') return [...items].sort((a, b) => (b.debut?.year ?? -1e9) - (a.debut?.year ?? -1e9) || byTitle(a, b));
    // « Pertinence » : d'abord les éléments documentés (article Wikipédia, image, localisation).
    if (ordering === 'populaire') {
        const score = (i) => (i.article ? 4 : 0) + (i.image ? 2 : 0) + (i.coord ? 1 : 0);
        return [...items].sort((a, b) => score(b) - score(a) || byTitle(a, b));
    }
    return [...items].sort(byTitle);
};

const filterItems = (items, params) => {
    let list = items;
    if (params.province) list = list.filter((i) => i.provinces.includes(PROVINCE_BY_SLUG[params.province]?.qid));
    if (params.nature) list = list.filter((i) => i.nature === params.nature);
    if (params.periode) {
        const p = catalogue.periodes.find((x) => x.slug === params.periode);
        if (p) list = list.filter((i) => i.debut && (p.annee_debut === null || i.debut.year >= p.annee_debut) && (p.annee_fin === null || i.debut.year < p.annee_fin));
    }
    const min = Number.parseInt(params.annee_min, 10);
    const max = Number.parseInt(params.annee_max, 10);
    if (!Number.isNaN(min)) list = list.filter((i) => i.debut && (i.fin?.year ?? i.debut.year) >= min);
    if (!Number.isNaN(max)) list = list.filter((i) => i.debut && i.debut.year <= max);
    if (params.vedette) list = list.filter((i) => catalogue.vedette.includes(i.qid));
    if (params.media) list = list.filter((i) => i.image);
    if (params.q) list = list.filter((i) => textMatch(i, params.q));
    return list;
};

// ------------------------------------------------------------------ recherche Wikipédia

const searchWikipedia = async (q, { offset = 0, limit = PAGE_SIZE } = {}, signal) => {
    const json = await wikiApi({
        action: 'query', generator: 'search', gsrsearch: `${q} "république démocratique du Congo"`, gsrnamespace: '0',
        gsrlimit: String(limit), gsroffset: String(offset), prop: 'pageprops|extracts|pageimages', ppprop: 'wikibase_item',
        exintro: '1', explaintext: '1', exsentences: '2', exlimit: String(limit), piprop: 'thumbnail', pithumbsize: '480',
    }, signal);
    const pages = (json.query?.pages || []).filter((p) => p.pageprops?.wikibase_item).sort((a, b) => a.index - b.index);
    return {
        total: json.query?.searchinfo?.totalhits ?? pages.length + (json.continue ? limit : 0),
        hasMore: Boolean(json.continue),
        items: pages.map((page) => ({
            qid: page.pageprops.wikibase_item, titre: page.title, description: '', resume: page.extract || '', article: page.title,
            coord: null, image: page.thumbnail?.source || null, debut: null, fin: null, provinces: [], humain: false, src: ['recherche'],
            subSlug: null,
        })).map((item) => attach([item])[0]),
    };
};

/** Sous-rubrique d'un élément : liste explicite du catalogue, sinon listes déjà en cache. */
const findSubForQid = (qid) => {
    const explicit = SUBS.find((s) => s.sources.some((src) => src.items?.includes(qid)));
    if (explicit) return explicit;
    return null;
};

// ------------------------------------------------------------------ API publique (même forme que le serveur)

const categoryPublic = (cat, enfants = []) => ({
    id: cat.slug,
    nom: cat.nom,
    slug: cat.slug,
    parent: cat.racine?.slug || null,
    description: cat.description || '',
    icone: cat.racine?.icone || cat.icone,
    couleur: cat.racine?.couleur || cat.couleur,
    image: null,
    ordre: 0,
    afficher_carte: Boolean(cat.racine?.carte ?? cat.carte),
    afficher_chronologie: Boolean(cat.racine?.chronologie ?? cat.chronologie),
    nb_fiches: null,
    enfants,
});

const categoryTree = () => ROOTS.map((root) => categoryPublic(root, root.enfants.map((sub) => categoryPublic({ ...sub, racine: root }))));

const periodesPublic = () => catalogue.periodes.map((p) => ({
    id: p.slug, nom: p.nom, slug: p.slug, annee_debut: p.annee_debut, annee_fin: p.annee_fin,
    libelle_dates: `${p.annee_debut ?? '…'} – ${p.annee_fin ?? "aujourd'hui"}`, resume: '', couleur: p.couleur, nb_fiches: null,
}));

const vedetteItems = async (signal) => enrich(await itemsByQid(catalogue.vedette, signal), signal);

/** Image de couverture de chaque grande rubrique (élément Wikidata choisi dans le catalogue). */
const coverImages = async (signal) => {
    try {
        const qids = ROOTS.map((r) => r.couverture).filter(Boolean);
        const details = await loadDetails(qids, signal);
        return Object.fromEntries(ROOTS.map((r) => [r.slug, details[r.couverture]?.image?.replace(/width=\d+/, 'width=1280') || null]));
    } catch {
        return {};
    }
};

const withCovers = (node, covers) => ({ ...node, image: covers[node.slug] || covers[node.parent] || null });

export const wikiSource = {
    async accueil({ signal } = {}) {
        let vedette = [];
        try {
            vedette = await vedetteItems(signal);
        } catch (error) {
            if (error.name === 'AbortError') throw error;
        }
        const order = catalogue.vedette;
        vedette.sort((a, b) => order.indexOf(a.qid) - order.indexOf(b.qid));
        const covers = await coverImages(signal);
        return {
            categories: categoryTree().map((root) => withCovers(root, covers)),
            vedette: vedette.map(fichePublic),
            recentes: [],
            periodes: periodesPublic(),
            statistiques: { fiches: null, provinces: PROVINCES.length, medias: null, categories: ROOTS.length },
            source: 'wikimedia',
        };
    },

    async categories() {
        return { results: categoryTree() };
    },

    async categorie(slug, { signal } = {}) {
        const sub = SUB_BY_SLUG[slug];
        const root = sub ? sub.racine : ROOT_BY_SLUG[slug];
        if (!root) {
            const error = new Error('Rubrique introuvable.');
            error.status = 404;
            throw error;
        }
        const covers = await coverImages(signal);
        const self = withCovers(sub ? categoryPublic({ ...sub, racine: root }) : categoryPublic(root), covers);
        return {
            ...self,
            fil_ariane: sub ? [categoryPublic(root)] : [],
            enfants: sub ? [] : root.enfants.map((s) => categoryPublic({ ...s, racine: root })),
            racine: withCovers(categoryPublic(root), covers),
        };
    },

    async filtres() {
        return {
            categories: categoryTree(),
            provinces: PROVINCES.map((p) => ({ nom: p.nom, slug: p.slug, nb_fiches: null })),
            natures: Object.entries(NATURES).map(([valeur, label]) => ({ valeur, label })),
            periodes: periodesPublic(),
            medias: [{ valeur: 'image', label: 'Photographie' }],
            ordres: [
                { valeur: 'titre', label: 'Titre (A → Z)' },
                { valeur: 'chronologique', label: 'Chronologique' },
                { valeur: 'recent', label: 'Plus récents d’abord' },
                { valeur: 'populaire', label: 'Les mieux documentés' },
            ],
        };
    },

    async fiches(params = {}, { signal } = {}) {
        const page = Math.max(1, Number.parseInt(params.page, 10) || 1);
        const size = Math.min(60, Number.parseInt(params.page_size, 10) || PAGE_SIZE);
        // Recherche libre sans rubrique : moteur de recherche de Wikipédia.
        if (params.q && !params.categorie && !params.province && !params.nature && !params.periode) {
            const result = await searchWikipedia(params.q, { offset: (page - 1) * size, limit: size }, signal);
            const totalPages = Math.ceil(result.total / size);
            return { count: result.total, page, page_size: size, total_pages: totalPages, has_next: result.hasMore, results: result.items.map(fichePublic) };
        }
        const subs = subsFor(params.categorie);
        if (!params.categorie && !params.vedette) {
            // Sans rubrique : on se limite aux listes explicites (rapide) plutôt que d'interroger tout Wikidata.
            const items = await itemsFor(subs.filter((s) => s.sources.every((src) => src.items)), signal);
            return paginate(sortItems(filterItems(items, params), params.ordering), page, size, signal);
        }
        const items = params.vedette ? await vedetteItems(signal) : await itemsFor(subs, signal);
        return paginate(sortItems(filterItems(items, params), params.ordering || (params.q ? 'populaire' : 'titre')), page, size, signal);
    },

    async fiche(slug, { signal } = {}) {
        if (!/^Q\d+$/.test(slug)) {
            const error = new Error('Fiche introuvable.');
            error.status = 404;
            throw error;
        }
        return cached(`fiche:${slug}`, () => loadFiche(slug, signal));
    },

    async provinces({ signal } = {}) {
        const data = await provincesData(signal);
        return { count: data.length, results: data };
    },

    async province(slug, { signal } = {}) {
        const province = PROVINCE_BY_SLUG[slug];
        if (!province) {
            const error = new Error('Province introuvable.');
            error.status = 404;
            throw error;
        }
        return cached(`province:${slug}`, () => loadProvince(province, signal));
    },

    async chronologie(params = {}, { signal } = {}) {
        const subs = params.categorie ? subsFor(params.categorie) : SUBS.filter((s) => s.racine.chronologie);
        const items = (await itemsFor(subs, signal)).filter((i) => i.debut);
        const filtered = sortItems(filterItems(items, params), 'chronologique');
        const page = await enrich(filtered.slice(0, 400), signal);
        const counts = {};
        items.forEach((i) => { const p = periodeOf(i.debut.year); if (p) counts[p.slug] = (counts[p.slug] || 0) + 1; });
        return {
            periodes: periodesPublic().map((p) => ({ ...p, nb_fiches: counts[p.slug] || 0 })),
            count: filtered.length,
            tronque: filtered.length > 400,
            evenements: page.map(fichePublic),
        };
    },

    async carte(params = {}, { signal } = {}) {
        const subs = (params.categorie ? subsFor(params.categorie) : SUBS.filter((s) => s.racine.carte));
        const province = params.province ? PROVINCE_BY_SLUG[params.province]?.qid : null;
        const items = filterItems(await itemsFor(subs, signal, { province, coords: true }), { ...params, province: null });
        const features = items.map((item) => ({
            type: 'Feature',
            id: `fiche-${item.qid}`,
            geometry: { type: 'Point', coordinates: [item.coord.longitude, item.coord.latitude] },
            properties: {
                type_objet: 'fiche', slug: item.qid, titre: item.titre, resume: item.description || '',
                nature: item.nature, nature_label: NATURES[item.nature], categorie: item.sub.nom, categorie_slug: item.sub.slug,
                couleur: item.sub.racine.couleur, icone: item.sub.racine.icone, image: item.image,
                libelle_dates: libelleDates(item.debut, item.fin), rubrique: item.sub.racine.nom, rubrique_slug: item.sub.racine.slug,
            },
        }));
        if (['1', 'true', 'oui', 1, true].includes(params.provinces)) {
            PROVINCES.forEach((p) => features.push({
                type: 'Feature', id: `province-${p.qid}`,
                geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
                properties: { type_objet: 'province', slug: p.slug, titre: p.nom, resume: `Chef-lieu : ${p.chef_lieu}`, couleur: '#053677' },
            }));
        }
        return { type: 'FeatureCollection', count: features.length, tronque: false, features };
    },

    async recherche(q, { signal } = {}) {
        const text = (q || '').trim();
        if (text.length < 2) return { q: text, fiches: [], provinces: [], categories: [], total_fiches: 0 };
        const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const needle = norm(text);
        const result = await searchWikipedia(text, { limit: 8 }, signal);
        return {
            q: text,
            total_fiches: result.total,
            fiches: result.items.map(fichePublic),
            provinces: PROVINCES.filter((p) => norm(p.nom).includes(needle) || norm(p.chef_lieu).includes(needle))
                .slice(0, 6).map((p) => ({ id: p.qid, nom: p.nom, slug: p.slug, chef_lieu: p.chef_lieu })),
            categories: SUBS.concat(ROOTS).filter((c) => norm(c.nom).includes(needle)).slice(0, 6).map((c) => categoryPublic(c)),
        };
    },

    async medias() {
        return { count: 0, page: 1, total_pages: 0, results: [] };
    },
};

const paginate = async (items, page, size, signal) => {
    const start = (page - 1) * size;
    const slice = await enrich(items.slice(start, start + size), signal);
    const totalPages = Math.ceil(items.length / size);
    return { count: items.length, page, page_size: size, total_pages: totalPages, has_next: page < totalPages, results: slice.map(fichePublic) };
};

// ------------------------------------------------------------------ détail d'une fiche

const FACT_LABELS = Object.fromEntries(catalogue.faits);

const factsQuery = (qid) => `
SELECT ?prop ?v ?vLabel ?unitLabel ?when WHERE {
  VALUES ?prop { ${catalogue.faits.map(([p]) => `wd:${p}`).join(' ')} }
  ?prop wikibase:claim ?claim; wikibase:statementProperty ?sp; wikibase:statementValue ?sv.
  wd:${qid} ?claim ?st. ?st ?sp ?v.
  FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
  OPTIONAL { ?st ?sv ?node. ?node wikibase:quantityUnit ?unit. FILTER(?unit != wd:Q199) }
  OPTIONAL { ?st pq:P585 ?when }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}`;

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

const formatFacts = (rows) => {
    const byProp = new Map();
    rows.forEach((row) => {
        const prop = qidOf(row.prop);
        const label = FACT_LABELS[prop];
        if (!label) return;
        let value;
        if (/^[+-]?\d+-\d\d-\d\dT/.test(row.v)) value = formatDate(parseDate(row.v));
        else if (row.v && !Number.isNaN(Number(row.v)) && !row.v.startsWith('http')) value = `${numberFormat.format(Number(row.v))}${row.unitLabel ? ` ${row.unitLabel}` : ''}`;
        else value = row.vLabel || row.v;
        if (!value || /^Q\d+$/.test(value)) return;
        const when = row.when ? parseDate(row.when)?.year : null;
        const entry = byProp.get(prop) || { libelle: label, valeurs: [], annee: '' };
        if (!entry.valeurs.includes(value)) entry.valeurs.push(value);
        if (when && (!entry.annee || when > Number(entry.annee))) {
            // Pour une série (population…), on garde la valeur la plus récente.
            entry.valeurs = [value];
            entry.annee = String(when);
        }
        byProp.set(prop, entry);
    });
    return catalogue.faits.map(([p]) => byProp.get(p)).filter(Boolean).map((entry, index) => ({
        id: index, libelle: entry.libelle, valeur: entry.valeurs.slice(0, 4).join(', '), unite: '', annee: entry.annee,
    }));
};

const EXCLUDED_IMAGE = /(logo|flag|drapeau|icon|icone|blason|coat[_ ]of|seal|symbol|pictogram|commons-|wiki|edit-|question|disambig|portal|star|nuvola|crystal|loudspeaker|padlock|red_pencil)/i;

const loadGallery = async (title, signal) => {
    if (!title) return [];
    const json = await wikiApi({
        action: 'query', generator: 'images', titles: title, redirects: '1', gimlimit: '40',
        prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '1000', iiextmetadatafilter: 'Artist|LicenseShortName|ImageDescription',
        iiextmetadatalanguage: 'fr',
    }, signal);
    const strip = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return (json.query?.pages || [])
        .filter((page) => page.imageinfo?.[0] && !EXCLUDED_IMAGE.test(page.title))
        .map((page, index) => {
            const info = page.imageinfo[0];
            const meta = info.extmetadata || {};
            const isVideo = /^video\//.test(info.mime);
            if (!isVideo && !/^image\/(jpeg|png|webp)/.test(info.mime)) return null;
            if (!isVideo && info.width && info.width < 200) return null;
            const name = page.title.replace(/^Fichier:/, '').replace(/\.[a-z0-9]+$/i, '');
            const map = /(carte|map|location|localisation|relief)/i.test(page.title);
            return {
                id: index,
                type: isVideo ? 'video' : map ? 'carte' : 'image',
                type_label: isVideo ? 'Vidéo' : map ? 'Carte' : 'Photographie',
                titre: name.replace(/[_-]+/g, ' ').slice(0, 120),
                legende: strip(meta.ImageDescription?.value).slice(0, 300),
                url: isVideo ? info.url : info.thumburl || info.url,
                vignette: isVideo ? null : info.thumburl || info.url,
                credit: [strip(meta.Artist?.value), meta.LicenseShortName?.value].filter(Boolean).join(' · ').slice(0, 160),
            };
        })
        .filter(Boolean)
        .slice(0, 24);
};

/** Texte complet de l'article (HTML simplifié), sans les sections de références. */
const loadArticle = async (title, signal) => {
    if (!title) return { html: '', intro: '', image: null };
    const json = await wikiApi({
        action: 'query', prop: 'extracts|pageimages', titles: title, redirects: '1', exsectionformat: 'wiki',
        piprop: 'original|thumbnail', pithumbsize: '1200',
    }, signal);
    const page = json.query?.pages?.[0] || {};
    let html = page.extract || '';
    const cut = html.search(/<h2[^>]*>\s*(?:<span[^>]*>)?\s*(Notes et références|Notes|Références|Voir aussi|Liens externes|Bibliographie|Annexes)/i);
    if (cut > 0) html = html.slice(0, cut);
    html = html.replace(/<p[^>]*class="mw-empty-elt"[^>]*>\s*<\/p>/g, '').replace(/<p>\s*<\/p>/g, '').replace(/<span[^>]*><\/span>/g, '');
    // Le premier paragraphe sert de chapeau : on le retire du corps pour ne pas l'afficher deux fois.
    const first = html.match(/<p>[\s\S]*?<\/p>/);
    const intro = first ? first[0].replace(/<[^>]+>/g, '').trim() : '';
    const body = first ? html.replace(first[0], '') : html;
    return { html: body, intro, image: page.thumbnail?.source || page.original?.source || null, title: page.title };
};

const loadFiche = async (qid, signal) => {
    const [item] = await itemsByQid([qid], signal);
    if (!item) {
        const error = new Error('Fiche introuvable sur Wikidata.');
        error.status = 404;
        throw error;
    }
    const { sub } = item;
    const [facts, article, gallery] = await Promise.all([
        sparql(factsQuery(qid), signal).then(formatFacts).catch(() => []),
        loadArticle(item.article, signal).catch(() => ({ html: '', intro: '', image: null })),
        loadGallery(item.article, signal).catch(() => []),
    ]);
    const base = fichePublic({ ...item, resume: article.intro || item.description });
    let liees = [];
    if (sub) {
        try {
            const siblings = (await subItems(sub, signal)).filter((i) => i.qid !== qid && i.article);
            liees = (await enrich(sortItems(siblings, 'populaire').slice(0, 4), signal)).map(fichePublic);
        } catch { /* liens facultatifs */ }
    }
    const fil = sub ? [categoryPublic(sub.racine), categoryPublic(sub)] : [];
    return {
        ...base,
        categorie: base.categorie || { id: 'wikipedia', nom: 'Wikipédia', slug: '', icone: 'document', couleur: '#1e42ac' },
        image: base.image || article.image,
        contenu: article.html,
        image_principale: article.image || (item.image ? item.image.replace(/width=\d+/, 'width=1400') : null),
        credit_image: 'Wikimedia Commons',
        fil_ariane: fil,
        lieu: item.description || '',
        localites: [],
        geometrie: null,
        periode: periodeOf(item.debut?.year) ? periodesPublic().find((p) => p.slug === periodeOf(item.debut.year).slug) : null,
        date_precise: null,
        mots_cles: [],
        medias: gallery,
        sources: [
            item.article && {
                id: 1, type: 'site', type_label: 'Encyclopédie', titre: item.article, auteurs: 'Contributeurs de Wikipédia',
                editeur: 'Wikipédia, l’encyclopédie libre', annee: '', url: `${WIKI_PAGE}${encodeURIComponent(item.article.replace(/ /g, '_'))}`,
                note: 'Texte sous licence CC BY-SA 4.0',
            },
            {
                id: 2, type: 'site', type_label: 'Base de données', titre: `${item.titre} (${qid})`, auteurs: 'Contributeurs de Wikidata',
                editeur: 'Wikidata', annee: '', url: `https://www.wikidata.org/wiki/${qid}`, note: 'Données sous licence CC0',
            },
        ].filter(Boolean),
        donnees: facts,
        fiches_liees: liees,
        date_publication: null,
        vues: null,
        source: 'wikimedia',
    };
};

// ------------------------------------------------------------------ provinces

const provincesData = (signal) => cached('provinces', async () => {
    const rows = await sparql(`
SELECT ?p ?area ?pop ?popDate ?img ?article WHERE {
  VALUES ?p { ${PROVINCE_VALUES} }
  OPTIONAL { ?p wdt:P2046 ?area }
  OPTIONAL { ?p p:P1082 ?ps. ?ps ps:P1082 ?pop. FILTER NOT EXISTS { ?ps wikibase:rank wikibase:DeprecatedRank } OPTIONAL { ?ps pq:P585 ?popDate } }
  OPTIONAL { ?p wdt:P18 ?img }
  OPTIONAL { ?article schema:about ?p; schema:isPartOf <https://fr.wikipedia.org/> }
}`, signal);
    const data = {};
    rows.forEach((row) => {
        const qid = qidOf(row.p);
        const entry = data[qid] || (data[qid] = {});
        if (row.area && !entry.area) entry.area = Math.round(Number(row.area));
        const popYear = parseDate(row.popDate)?.year ?? 0;
        if (row.pop && (!entry.pop || popYear > entry.popYear)) { entry.pop = Number(row.pop); entry.popYear = popYear; }
        if (row.img && !entry.img) entry.img = commonsThumb(row.img, 480);
        if (row.article && !entry.article) entry.article = articleTitle(row.article);
    });
    return PROVINCES.map((p) => ({
        id: p.qid, nom: p.nom, slug: p.slug, code: p.code, chef_lieu: p.chef_lieu, presentation: '',
        superficie_km2: data[p.qid]?.area ?? null, population: data[p.qid]?.pop ?? null,
        annee_population: data[p.qid]?.popYear || null, latitude: p.latitude, longitude: p.longitude, zoom: p.zoom,
        image: data[p.qid]?.img ?? null, nb_fiches: null, date_mise_a_jour: null, article: data[p.qid]?.article ?? null,
    }));
});

const loadProvince = async (province, signal) => {
    const base = (await provincesData(signal)).find((p) => p.slug === province.slug);
    const [article, gallery, localites, items] = await Promise.all([
        loadArticle(base.article, signal).catch(() => ({ html: '', intro: '', image: null })),
        loadGallery(base.article, signal).catch(() => []),
        sparql(`
SELECT ?l ?label ?cls ?coord ?pop WHERE {
  VALUES ?cls { ${Object.keys(catalogue.localites).map((q) => `wd:${q}`).join(' ')} }
  ?l wdt:P31 ?cls; wdt:P131 wd:${province.qid}.
  OPTIONAL { ?l wdt:P625 ?coord } OPTIONAL { ?l wdt:P1082 ?pop }
  ?l rdfs:label ?label FILTER(LANG(?label) = "fr")
}`, signal).catch(() => []),
        itemsFor(SUBS.filter((s) => s.racine.carte), signal, { province: province.qid }).catch(() => []),
    ]);
    const seen = new Map();
    localites.forEach((row) => {
        const qid = qidOf(row.l);
        if (seen.has(qid)) return;
        const type = catalogue.localites[qidOf(row.cls)];
        const coord = parseCoord(row.coord);
        seen.set(qid, {
            id: qid, nom: row.label, type, type_label: type === 'ville' ? 'Ville' : 'Territoire', chef_lieu: '',
            population: row.pop ? Math.round(Number(row.pop)) : null, superficie_km2: null,
            latitude: coord?.latitude ?? null, longitude: coord?.longitude ?? null, description: '',
        });
    });
    const inProvince = items;
    const groups = new Map();
    inProvince.forEach((item) => {
        const root = item.sub.racine;
        if (!groups.has(root.slug)) groups.set(root.slug, { root, list: [] });
        groups.get(root.slug).list.push(item);
    });
    const rubriques = [];
    for (const { root, list } of groups.values()) {
        const sorted = sortItems(list, 'populaire');
        rubriques.push({
            categorie: categoryPublic(root),
            total: list.length,
            fiches: (await enrich(sorted.slice(0, 12), signal).catch(() => sorted.slice(0, 12))).map(fichePublic),
        });
    }
    rubriques.sort((a, b) => ROOTS.findIndex((r) => r.slug === a.categorie.slug) - ROOTS.findIndex((r) => r.slug === b.categorie.slug));
    return {
        ...base,
        nb_fiches: inProvince.length,
        presentation: article.intro,
        description: article.html,
        langues: '', climat: '', relief: '', vegetation: '', hydrographie: '', economie: '', culture: '',
        contour: null,
        image_principale: article.image || base.image,
        credit_image: 'Wikimedia Commons',
        localites: [...seen.values()].sort((a, b) => a.type.localeCompare(b.type) || a.nom.localeCompare(b.nom, 'fr')),
        medias: gallery,
        sources: [
            base.article && {
                id: 1, type: 'site', type_label: 'Encyclopédie', titre: base.article, auteurs: 'Contributeurs de Wikipédia',
                editeur: 'Wikipédia', annee: '', url: `${WIKI_PAGE}${encodeURIComponent(base.article.replace(/ /g, '_'))}`, note: 'CC BY-SA 4.0',
            },
            { id: 2, type: 'site', type_label: 'Base de données', titre: province.qid, auteurs: '', editeur: 'Wikidata', annee: '', url: `https://www.wikidata.org/wiki/${province.qid}`, note: 'CC0' },
        ].filter(Boolean),
        donnees: [],
        rubriques,
        source: 'wikimedia',
    };
};

export default wikiSource;

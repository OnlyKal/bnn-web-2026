import { useEffect, useState } from 'react';
import { encyclopedieAPI } from '../services/encyclopedieApi';

let treePromise = null;

/**
 * Arborescence des thèmes (grandes rubriques et sous-rubriques), chargée une
 * seule fois et partagée par la navigation latérale et les pages.
 */
const useRdcTree = () => {
    const [tree, setTree] = useState([]);
    useEffect(() => {
        let alive = true;
        treePromise = treePromise || encyclopedieAPI.categories().then((data) => data.results || []).catch(() => {
            treePromise = null;
            return [];
        });
        treePromise.then((results) => { if (alive) setTree(results); });
        return () => { alive = false; };
    }, []);
    return tree;
};

/** Grande rubrique contenant un slug (rubrique ou sous-rubrique). */
export const findRoot = (tree, slug) => tree.find((root) => root.slug === slug || root.enfants?.some((s) => s.slug === slug)) || null;

export default useRdcTree;

import axios from 'axios';
import { API_SERVER_URL } from '../config';

// API publique des consultations périodiques (BNN interne, HAL, OpenAlex).
const consultationsApi = axios.create({
    baseURL: `${API_SERVER_URL}/api/consultations`,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
});

export const CONSULTATION_SOURCES = [
    { code: 'bnn_interne', libelle: 'BNN interne' },
    { code: 'hal', libelle: 'HAL' },
    { code: 'openalex', libelle: 'OpenAlex' }
];

export const CONSULTATION_PERIODES = [
    { code: 'aujourdhui', libelle: "Aujourd'hui" },
    { code: 'hier', libelle: 'Hier' },
    { code: 'cette_semaine', libelle: 'Cette semaine' },
    { code: 'semaine_passee', libelle: 'Semaine passée' },
    { code: 'ce_mois', libelle: 'Ce mois' },
    { code: 'mois_passe', libelle: 'Mois passé' },
    { code: 'intervalle', libelle: 'Intervalle' }
];

export const CONSULTATION_ACTIONS = [
    { code: 'recherche', libelle: 'Recherche / liste' },
    { code: 'detail', libelle: 'Fiche détaillée' },
    { code: 'pdf', libelle: 'Ouverture de fichier / PDF' }
];

const getErrorMessage = (error, fallback) => {
    const data = error.response?.data;
    if (data?.error?.details) return `${data.message || fallback} : ${data.error.details}`;
    return data?.message || data?.detail || fallback;
};

// Supprime les paramètres vides pour ne pas envoyer `source=` ou `periode=`.
const cleanParams = (params = {}) => Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

export const consultationsAPI = {
    // Sans `periode` : résumé des 4 périodes ; avec `periode` : statistiques détaillées.
    getStatistiques: async (params = {}, options = {}) => {
        try {
            const response = await consultationsApi.get('/statistiques/', {
                params: cleanParams(params),
                signal: options.signal
            });
            return response.data;
        } catch (error) {
            if (axios.isCancel(error)) throw error;
            throw new Error(getErrorMessage(error, 'Erreur lors du chargement des statistiques de consultation'));
        }
    },

    // Liste détaillée paginée.
    getConsultations: async (params = {}, options = {}) => {
        try {
            const response = await consultationsApi.get('/', {
                params: cleanParams(params),
                signal: options.signal
            });
            return response.data;
        } catch (error) {
            if (axios.isCancel(error)) throw error;
            throw new Error(getErrorMessage(error, 'Erreur lors du chargement des consultations'));
        }
    }
};

export default consultationsAPI;

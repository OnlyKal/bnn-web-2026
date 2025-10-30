// Mock data for testing purposes
export const mockRessources = {
    next: null,
    previous: null,
    results: {
        message: "Liste des ressources récupérée avec succès",
        status: 200,
        data: [
        {
            id: 1,
            titre: "Introduction à React.js",
            sous_titre: "Apprendre les fondamentaux de React pour le développement web moderne",
            description: "<p>Ce cours couvre les concepts de base de React, incluant les composants, les props, les hooks et la gestion d'état.</p>",
            auteurs: "Jean Dupont, Marie Martin",
            edition: "1ère",
            lieu_edition: "Paris",
            ISBN: "978-2-1234-5678-9",
            langue: "fr",
            pays: "France",
            domaine: {
                id: 1,
                nom: "Informatique"
            },
            sous_domaine: {
                id: 1,
                nom: "Développement Web",
                domaine: {
                    id: 1,
                    nom: "Informatique"
                }
            },
            type: "document",
            format: "pdf",
            date_publication: "2024-01-15",
            couverture: "/media/couvertures/react-course.jpg",
            fichiers: [
                {
                    id: 1,
                    titre: "Introduction React PDF",
                    fichier: "/media/ressources/react-introduction.pdf",
                    ordre: 0,
                    duree: null,
                    date_ajout: "2024-01-15T10:30:00Z"
                }
            ]
        },
        {
            id: 2,
            titre: "Algorithmes de Tri",
            sous_titre: "Comprendre et implémenter les différents algorithmes de tri",
            description: "<p>Une exploration complète des algorithmes de tri classiques avec exemples pratiques.</p>",
            auteurs: "Prof. Ahmed Benali",
            edition: "2e",
            lieu_edition: "Kinshasa",
            ISBN: "978-2-9876-5432-1",
            langue: "fr",
            pays: "République Démocratique du Congo",
            domaine: {
                id: 1,
                nom: "Informatique"
            },
            sous_domaine: {
                id: 2,
                nom: "Algorithmes",
                domaine: {
                    id: 1,
                    nom: "Informatique"
                }
            },
            type: "video",
            format: "mp4",
            date_publication: "2024-02-10",
            couverture: "/media/couvertures/algorithms-video.jpg",
            fichiers: [
                {
                    id: 2,
                    titre: "Algorithmes de Tri Video",
                    fichier: "/media/ressources/algorithmes-tri.mp4",
                    ordre: 0,
                    duree: "45:30",
                    date_ajout: "2024-02-10T14:00:00Z"
                }
            ]
        },
        {
            id: 3,
            titre: "Bases de Données Relationnelles",
            sous_titre: "Conception et modélisation des bases de données",
            description: "Guide complet pour la conception et la gestion des bases de données relationnelles.",
            auteurs: "Dr. Sarah Johnson, Prof. Michel Dubois",
            domaine: {
                id: 1,
                nom: "Informatique"
            },
            sous_domaine: {
                id: 3,
                nom: "Bases de données"
            },
            type: "Manuel",
            format: "pdf",
            date_publication: "2024-03-05T09:15:00Z",
            couverture: "https://via.placeholder.com/400x300/f59e0b/ffffff?text=Database+Manual",
            fichiers: [
                {
                    nom: "bases-donnees.pdf",
                    url: "#",
                    format: "pdf",
                    taille: "8.2 MB"
                }
            ]
        },
        {
            id: 4,
            titre: "Photoshop pour Débutants",
            sous_titre: "Maîtriser les outils de base de Adobe Photoshop",
            description: "Tutoriel complet pour apprendre les fonctionnalités essentielles de Photoshop.",
            auteurs: "Lisa Chen",
            domaine: {
                id: 2,
                nom: "Design Graphique"
            },
            sous_domaine: {
                id: 4,
                nom: "Retouche Photo"
            },
            type: "Tutoriel",
            format: "mp4",
            date_publication: "2024-01-20T16:45:00Z",
            couverture: "https://via.placeholder.com/400x300/ef4444/ffffff?text=Photoshop+Tutorial",
            fichiers: [
                {
                    nom: "photoshop-basics.mp4",
                    url: "#",
                    format: "mp4",
                    taille: "420 MB"
                }
            ]
        },
        {
            id: 5,
            titre: "Mathématiques Appliquées",
            sous_titre: "Statistiques et probabilités pour l'ingénierie",
            description: "Cours de mathématiques appliquées couvrant les statistiques et probabilités.",
            auteurs: "Prof. Robert Martinez",
            domaine: {
                id: 3,
                nom: "Mathématiques"
            },
            sous_domaine: {
                id: 5,
                nom: "Statistiques"
            },
            type: "Cours",
            format: "pdf",
            date_publication: "2024-02-28T11:20:00Z",
            couverture: "https://via.placeholder.com/400x300/8b5cf6/ffffff?text=Math+Course",
            fichiers: [
                {
                    nom: "math-appliquees.pdf",
                    url: "#",
                    format: "pdf",
                    taille: "5.7 MB"
                }
            ]
        },
        {
            id: 6,
            titre: "Architecture Moderne",
            sous_titre: "Tendances contemporaines en architecture",
            description: "<p>Collection d'images illustrant les tendances architecturales modernes.</p>",
            auteurs: "Arch. Elena Rossi",
            edition: "1ère",
            lieu_edition: "Kinshasa",
            ISBN: "978-2-1111-2222-3",
            langue: "fr",
            pays: "République Démocratique du Congo",
            domaine: {
                id: 4,
                nom: "Architecture"
            },
            sous_domaine: {
                id: 6,
                nom: "Design Contemporain",
                domaine: {
                    id: 4,
                    nom: "Architecture"
                }
            },
            type: "image",
            format: "png",
            date_publication: "2024-03-12",
            couverture: "/media/couvertures/architecture-gallery.png",
            fichiers: [
                {
                    id: 6,
                    titre: "Architecture Collection",
                    fichier: "/media/ressources/architecture-moderne.png",
                    ordre: 0,
                    duree: null,
                    date_ajout: "2024-03-12T13:10:00Z"
                }
            ]
        },
        {
            id: 7,
            titre: "Marketing Digital",
            sous_titre: "Stratégies et outils pour le marketing en ligne",
            description: "Guide pratique pour développer une stratégie de marketing digital efficace.",
            auteurs: "Anna Williams, David Brown",
            domaine: {
                id: 5,
                nom: "Marketing"
            },
            sous_domaine: {
                id: 7,
                nom: "Marketing Digital"
            },
            type: "Guide",
            format: "pdf",
            date_publication: "2024-01-30T08:30:00Z",
            couverture: "https://via.placeholder.com/400x300/f97316/ffffff?text=Digital+Marketing",
            fichiers: [
                {
                    nom: "marketing-digital.pdf",
                    url: "#",
                    format: "pdf",
                    taille: "3.8 MB"
                }
            ]
        },
        {
            id: 8,
            titre: "Python pour Data Science",
            sous_titre: "Analyse de données avec Python et ses bibliothèques",
            description: "Cours complet sur l'utilisation de Python pour l'analyse et la visualisation de données.",
            auteurs: "Dr. Kevin Zhang",
            domaine: {
                id: 1,
                nom: "Informatique"
            },
            sous_domaine: {
                id: 8,
                nom: "Data Science"
            },
            type: "Cours",
            format: "mp4",
            date_publication: "2024-03-18T15:00:00Z",
            couverture: "https://via.placeholder.com/400x300/22c55e/ffffff?text=Python+Data+Science",
            fichiers: [
                {
                    nom: "python-data-science.mp4",
                    url: "#",
                    format: "mp4",
                    taille: "680 MB"
                }
            ]
        }
        ]
    }
};

// Function to simulate API delay
export const simulateApiCall = (data, delay = 1000) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(data);
        }, delay);
    });
};
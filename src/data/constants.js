export const SUBJECTS = [
  'Mathématiques', 'Français', 'Anglais', 'Physique-Chimie', 'SVT',
  'Histoire-Géographie', 'Économie', 'Informatique', 'Philosophie',
  'Arabe', 'Espagnol', 'Comptabilité', 'Droit'
]

export const LEVELS = ['Primaire', 'Collège', 'Lycée', 'Supérieur']

export const CITIES = [
  'Abidjan', 'Dakar', 'Bamako', 'Ouagadougou', 'Lomé',
  'Cotonou', 'Niamey', 'Conakry', 'Bissau'
]

export const QUARTIERS_BY_CITY = {
  'Abidjan': ['Cocody', 'Plateau', 'Yopougon', 'Marcory', 'Adjamé', 'Abobo', 'Koumassi', 'Treichville'],
  'Dakar': ['Plateau', 'Médina', 'Grand-Dakar', 'Pikine', 'Guédiawaye', 'Ouakam', 'Almadies'],
  'Bamako': ['Hippodrome', 'ACI 2000', 'Badalabougou', 'Lafiabougou', 'Magnambougou', 'Hamdallaye'],
  'Ouagadougou': ['Gounghin', 'Dapoya', 'Pissy', 'Wemtenga', 'Hamdalaye', 'Nongremassom'],
  'Lomé': ['Agoè', 'Bè', 'Nyékonakpoè', 'Tokoin', 'Zongo', 'Adidogomé'],
  'Cotonou': ['Akpakpa', 'Cadjehoun', 'Fidjrossè', 'Haie Vive', 'Agla', 'Gbèdjromèdji'],
  'Niamey': ['Plateau', 'Gamkalley', 'Zongo', 'Lazaret', 'Boukoki', 'Talladjé'],
  'Conakry': ['Kaloum', 'Matam', 'Ratoma', 'Matoto', 'Dixinn'],
  'Bissau': ['Bairro do Liceu', 'Santa Luzia', 'Bandim', 'Belém'],
}

export const SUBSCRIPTION_PLANS = [
  {
    id: 'gratuit',
    name: 'Gratuit',
    price: 0,
    features: [
      'Création de profil',
      'Accès aux ressources pédagogiques',
    ],
    restrictions: [
      'Profil non visible dans les recherches',
      "Pas d'accès aux demandes de séances",
      'Pas de messagerie',
    ],
    recommended: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 3000,
    features: [
      'Profil visible dans les recherches',
      'Accès aux demandes de séances',
      'Messagerie avec les parents',
      'Statistiques de base',
      'Calendrier de disponibilités',
    ],
    restrictions: [],
    recommended: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 5000,
    features: [
      'Tout du plan Standard',
      'Profil mis en avant dans les résultats',
      'Badge Premium affiché',
      'Statistiques avancées détaillées',
      'Priorité maximale dans les recherches',
      'Support prioritaire',
    ],
    restrictions: [],
    recommended: true,
  },
]

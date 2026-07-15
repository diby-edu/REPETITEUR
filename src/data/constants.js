export const SUBJECTS = [
  'Mathématiques', 'Français', 'Anglais', 'Physique-Chimie', 'SVT',
  'Histoire-Géographie', 'Économie', 'Informatique', 'Philosophie',
  'Arabe', 'Espagnol', 'Comptabilité', 'Droit'
]

export const LEVELS = ['Primaire', 'Collège', 'Lycée', 'Supérieur']

export const CITIES = [
  'Abidjan', 'Yamoussoukro', 'Bouaké', 'Daloa', 'Korhogo',
  'San-Pédro', 'Man', 'Gagnoa', 'Abengourou', 'Divo',
  'Soubré', 'Duekoué', 'Tabou', 'Grand-Bassam', 'Jacqueville',
  'Tiassalé', 'Agboville', 'Adzopé', 'Aboisso', 'Bondoukou',
  'Odienné', 'Touba', 'Séguéla', 'Vavoua', 'Issia',
  'Lakota', 'Guiglo', 'Bangolo', 'Biankouma', 'Danané',
  'Sassandra', 'Fresco', 'Grand-Lahou', 'Bouaflé', 'Sinfra',
  'Zuénoula', 'Bongouanou', 'Dimbokro', 'Toumodi', 'Katiola',
  'Dabakala', 'Ferkessédougou', 'Boundiali', 'Tengrela', 'Bouna',
  'Tanda', 'Nassian', 'Béoumi', 'Sakassou', 'Daoukro',
]

export const QUARTIERS_BY_CITY = {
  'Abidjan': [
    'Cocody', 'Plateau', 'Yopougon', 'Marcory', 'Adjamé',
    'Abobo', 'Koumassi', 'Treichville', 'Port-Bouët', 'Attécoubé',
    'Bingerville', 'Songon', 'Anyama', 'Alepe',
  ],
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

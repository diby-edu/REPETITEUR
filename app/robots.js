const BASE = process.env.NEXT_PUBLIC_APP_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://repetiteur.numerik360.com'

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Ne pas indexer les espaces privés / authentifiés
        disallow: [
          '/admin',
          '/tableau-de-bord',
          '/messagerie',
          '/parametres',
          '/notifications',
          '/reservations',
          '/favoris',
          '/abonnement',
          '/reinitialiser-mot-de-passe',
          '/mot-de-passe-oublie',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}

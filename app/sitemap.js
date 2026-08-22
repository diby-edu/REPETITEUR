const BASE = process.env.NEXT_PUBLIC_APP_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://repetiteur.numerik360.com'

export default function sitemap() {
  const now = new Date()
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/recherche`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/inscription`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/inscription/repetiteur`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/inscription/parent`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/connexion`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}

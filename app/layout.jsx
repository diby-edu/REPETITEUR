import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import ClientLayout from '../src/components/ClientLayout'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const poppins = Poppins({
  weight: ['400', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://repetiteur.numerik360.com'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MonRépétiteur — Trouvez le meilleur répétiteur en Côte d'Ivoire",
    template: '%s — MonRépétiteur',
  },
  description: "Plateforme de mise en relation entre répétiteurs qualifiés et vérifiés et familles en Côte d'Ivoire. Trouvez un répétiteur près de chez vous.",
  applicationName: 'MonRépétiteur',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE_URL,
    siteName: 'MonRépétiteur',
    title: "MonRépétiteur — Trouvez le meilleur répétiteur en Côte d'Ivoire",
    description: "Répétiteurs qualifiés et vérifiés près de chez vous en Côte d'Ivoire.",
  },
  twitter: {
    card: 'summary_large_image',
    title: "MonRépétiteur — Trouvez le meilleur répétiteur en Côte d'Ivoire",
    description: "Répétiteurs qualifiés et vérifiés près de chez vous en Côte d'Ivoire.",
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${inter.variable} ${poppins.variable}`}>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}

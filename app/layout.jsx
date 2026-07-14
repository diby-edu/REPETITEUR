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

export const metadata = {
  title: "MonRépétiteur — Trouvez le meilleur répétiteur en Côte d'Ivoire",
  description: "Plateforme de mise en relation entre répétiteurs et familles en Côte d'Ivoire",
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

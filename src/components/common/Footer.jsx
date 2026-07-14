'use client'
import Link from 'next/link'
import { MapPin, Mail, Phone } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-6 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="font-display font-bold text-xl text-white">
                Mon<span className="text-primary">Répétiteur</span>
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              La plateforme de référence pour trouver un répétiteur qualifié en Afrique de l'Ouest francophone.
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
              <MapPin size={12} />
              <span>Zone UEMOA — Afrique de l'Ouest</span>
            </div>
          </div>

          {/* Liens */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Pour les parents</h4>
            <ul className="space-y-2">
              {[
                { label: 'Trouver un répétiteur', href: '/recherche' },
                { label: 'Comment ça marche', href: '/#comment' },
                { label: "S'inscrire gratuitement", href: '/inscription/parent' },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Pour les répétiteurs</h4>
            <ul className="space-y-2">
              {[
                { label: 'Devenir répétiteur', href: '/inscription/repetiteur' },
                { label: 'Nos abonnements', href: '/abonnement' },
                { label: 'Tableau de bord', href: '/tableau-de-bord/repetiteur' },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Contact</h4>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <Mail size={14} className="text-primary flex-shrink-0" />
                contact@monrepetiteur.ci
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <Phone size={14} className="text-primary flex-shrink-0" />
                +225 27 22 XX XX XX
              </li>
            </ul>
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Disponible dans :</p>
              <div className="flex flex-wrap gap-1">
                {['🇨🇮', '🇸🇳', '🇲🇱', '🇧🇫', '🇹🇬', '🇧🇯', '🇬🇳', '🇳🇪'].map((flag, i) => (
                  <span key={i} className="text-base" title="UEMOA">{flag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} MonRépétiteur. Tous droits réservés.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">Confidentialité</Link>
            <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">CGU</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

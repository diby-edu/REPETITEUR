'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '../context/AppContext'
import TutorCard from '../components/common/TutorCard'
import StarRating from '../components/common/StarRating'
import {
  Search, MapPin, BookOpen, Shield, Star, Users,
  ChevronRight, GraduationCap, CheckCircle, Zap
} from 'lucide-react'

function AfricanPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
      <svg width="100%" height="100%" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
        {[...Array(8)].map((_, i) =>
          [...Array(8)].map((_, j) => (
            <g key={`${i}-${j}`} transform={`translate(${i * 100}, ${j * 80})`}>
              <polygon points="50,5 95,25 95,55 50,75 5,55 5,25" fill="none" stroke="white" strokeWidth="1.5" />
            </g>
          ))
        )}
      </svg>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { getActiveTutors } = useApp()
  const [search, setSearch] = useState({ query: '', city: '' })

  const activeTutors = getActiveTutors()
  const featuredTutors = activeTutors
    .filter(t => t.subscription?.plan === 'premium')
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4)

  const handleSearch = (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search.query) params.set('q', search.query)
    if (search.city) params.set('ville', search.city)
    router.push(`/recherche?${params.toString()}`)
  }

  const stats = [
    { value: '500+', label: 'Répétiteurs vérifiés' },
    { value: '2 400+', label: 'Séances complétées' },
    { value: '50+', label: 'Villes en Côte d\'Ivoire' },
    { value: '4.8★', label: 'Note moyenne' },
  ]

  const howItWorks = [
    { step: '01', icon: <Search size={24} />, title: 'Recherchez', desc: 'Cherchez un répétiteur par matière, niveau ou ville. Comparez les profils, tarifs et avis.' },
    { step: '02', icon: <BookOpen size={24} />, title: 'Contactez', desc: 'Envoyez un message directement au répétiteur et discutez de vos besoins.' },
    { step: '03', icon: <CheckCircle size={24} />, title: 'Réservez', desc: 'Demandez une séance, choisissez la date et le lieu. C\'est simple et rapide !' },
  ]

  const whyUs = [
    { icon: <Shield size={22} className="text-secondary" />, title: 'Profils vérifiés', desc: 'Chaque répétiteur est vérifié avec CNI et diplômes contrôlés par notre équipe.' },
    { icon: <Star size={22} className="text-accent" />, title: 'Avis authentiques', desc: 'Les avis viennent de vraies séances complétées. Choisissez en confiance.' },
    { icon: <MapPin size={22} className="text-primary" />, title: 'Proche de vous', desc: 'Trouvez des répétiteurs dans votre quartier. Cours à domicile ou chez le répétiteur.' },
    { icon: <Zap size={22} className="text-yellow-500" />, title: 'Rapide et gratuit', desc: 'Inscription gratuite pour les parents. Trouvez un répétiteur en quelques minutes.' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-secondary to-secondary-600 text-white py-16 md:py-24 overflow-hidden">
        <AfricanPattern />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-5 text-sm font-medium">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              La plateforme des répétiteurs en Côte d'Ivoire
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4">
              Le meilleur répétiteur<br />
              <span className="text-gradient bg-gradient-to-r from-accent to-yellow-300 bg-clip-text text-transparent">
                pour votre enfant
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
              Trouvez un répétiteur qualifié et vérifié près de chez vous en Côte d'Ivoire.
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="bg-white rounded-2xl p-2 sm:p-3 shadow-xl max-w-3xl mx-auto flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-3 flex-1 px-3">
              <Search size={20} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Matière, répétiteur..."
                className="w-full bg-transparent text-gray-900 outline-none placeholder:text-gray-400 py-2"
                value={search.query}
                onChange={e => setSearch(p => ({ ...p, query: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3 sm:border-l border-gray-200 px-3 sm:flex-shrink-0 sm:w-40">
              <MapPin size={20} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Ville..."
                className="w-full bg-transparent text-gray-900 outline-none placeholder:text-gray-400 py-2"
                value={search.city}
                onChange={e => setSearch(p => ({ ...p, city: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn-primary flex-shrink-0 py-3 px-6 rounded-xl">
              Rechercher
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-sm text-white/70">
            <span>Suggestions :</span>
            {['Mathématiques', 'Français', 'Anglais', 'Physique-Chimie'].map(s => (
              <button
                key={s}
                onClick={() => router.push(`/recherche?q=${s}`)}
                className="bg-white/10 hover:bg-white/20 rounded-full px-3 py-1 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-gray-900">Comment ça marche ?</h2>
            <p className="text-gray-500 mt-2">Trouver un répétiteur n'a jamais été aussi simple</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((item, i) => (
              <div key={i} className="relative text-center">
                {i < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-dashed border-t-2 border-dashed border-primary/30" />
                )}
                <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary relative">
                  {item.icon}
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured tutors */}
      {featuredTutors.length > 0 && (
        <section className="py-16 bg-white px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="font-display text-3xl font-bold text-gray-900">Répétiteurs Premium</h2>
                <p className="text-gray-500 mt-1">Nos meilleurs répétiteurs vérifiés et bien notés</p>
              </div>
              <Link href="/recherche" className="hidden sm:flex items-center gap-1 text-primary font-medium hover:underline text-sm">
                Voir tous <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featuredTutors.map(tutor => (
                <TutorCard key={tutor.id} tutor={tutor} />
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/recherche" className="btn-outline inline-flex items-center gap-2">
                Voir tous les répétiteurs <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Why us */}
      <section className="py-16 px-4 sm:px-6 bg-surface">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-gray-900">Pourquoi choisir MonRépétiteur ?</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyUs.map((item, i) => (
              <div key={i} className="card text-center hover:shadow-card-hover transition-shadow">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-bold text-gray-900">Ce que disent nos parents</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: 'A. Ouédraogo', city: 'Abidjan — Cocody', text: 'Grâce à MonRépétiteur, mon fils est passé de 8 à 16 en mathématiques en 2 mois. Vraiment incroyable !', rating: 5 },
              { name: 'O. Koné', city: 'Bouaké', text: 'La plateforme est très facile à utiliser. J\'ai trouvé une excellente répétitrice de français en 10 minutes.', rating: 5 },
              { name: 'M. Traoré', city: 'Abidjan — Yopougon', text: 'Les répétiteurs sont vraiment vérifiés et professionnels. Je recommande à tous les parents !', rating: 5 },
            ].map((t, i) => (
              <div key={i} className="card">
                <StarRating rating={t.rating} showNumber={false} />
                <p className="text-gray-600 text-sm mt-3 mb-4 leading-relaxed italic">"{t.text}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-secondary-50 rounded-full flex items-center justify-center text-secondary font-bold text-xs">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 bg-gradient-to-br from-primary to-primary-600">
        <div className="max-w-3xl mx-auto text-center text-white">
          <GraduationCap size={48} className="mx-auto mb-4 opacity-90" />
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Prêt à booster les résultats de votre enfant ?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Rejoignez des milliers de familles qui font confiance à MonRépétiteur.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/inscription/parent" className="bg-white text-primary font-bold px-8 py-3.5 rounded-full hover:bg-gray-50 transition-colors shadow-lg">
              S'inscrire gratuitement
            </Link>
            <Link href="/recherche" className="bg-white/10 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white/20 transition-colors border border-white/30">
              Voir les répétiteurs
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

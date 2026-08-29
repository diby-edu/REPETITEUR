'use client'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useApp } from '../context/AppContext'
import MarketplaceShell from '../components/layout/MarketplaceShell'
import TutorCard from '../components/common/TutorCard'
import { SUBJECTS, CITIES } from '../data/constants'
import { MODALITIES } from '../utils/helpers'
import { Search, SlidersHorizontal, X, LayoutGrid, List } from 'lucide-react'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const { tutors, levelPackages } = useApp()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState('list')

  const [filters, setFilters] = useState({
    query: searchParams.get('q') || '',
    city: searchParams.get('ville') || '',
    subject: searchParams.get('matiere') || '',
    levelKey: searchParams.get('classe') || '',
    minPrice: '',
    maxPrice: '',
    modality: '',
    verifiedOnly: false,
    sortBy: 'pertinence',
  })

  const setFilter = (key, val) => setFilters(p => ({ ...p, [key]: val }))

  const filtered = useMemo(() => {
    // Visibilité gratuite : tout répétiteur vérifié et non suspendu est listé.
    // L'abonnement payant conditionne l'acceptation d'un contrat, pas l'affichage.
    let result = tutors.filter(t =>
      t.verificationStatus === 'verified' && !t.suspended)

    const offerSubjects = t => (t.offers || []).flatMap(o => o.subjects || [])

    if (filters.query) {
      const q = filters.query.toLowerCase()
      result = result.filter(t =>
        `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
        offerSubjects(t).some(s => s.toLowerCase().includes(q)) ||
        t.bio?.toLowerCase().includes(q)
      )
    }
    if (filters.city) result = result.filter(t => t.city.toLowerCase().includes(filters.city.toLowerCase()))
    if (filters.subject) result = result.filter(t => (t.offers || []).some(o => (o.subjects || []).includes(filters.subject)))
    if (filters.levelKey) result = result.filter(t => (t.offers || []).some(o => o.levelKey === filters.levelKey))
    if (filters.minPrice) result = result.filter(t => t.priceMax >= parseInt(filters.minPrice))
    if (filters.maxPrice) result = result.filter(t => t.priceMin <= parseInt(filters.maxPrice))
    if (filters.modality) result = result.filter(t => t.modalities?.includes(filters.modality))
    if (filters.verifiedOnly) result = result.filter(t => t.verificationStatus === 'verified')

    switch (filters.sortBy) {
      case 'note': return [...result].sort((a, b) => b.rating - a.rating)
      case 'prix_asc': return [...result].sort((a, b) => a.priceMin - b.priceMin)
      case 'prix_desc': return [...result].sort((a, b) => b.priceMax - a.priceMax)
      default:
        return [...result].sort((a, b) => {
          const premA = a.subscription?.plan === 'premium' ? 1 : 0
          const premB = b.subscription?.plan === 'premium' ? 1 : 0
          if (premB !== premA) return premB - premA
          return b.rating - a.rating
        })
    }
  }, [tutors, filters])

  const clearFilters = () => setFilters({
    query: '', city: '', subject: '', levelKey: '',
    minPrice: '', maxPrice: '', modality: '', verifiedOnly: false, sortBy: 'pertinence',
  })

  const hasActiveFilters = filters.city || filters.subject || filters.levelKey ||
    filters.minPrice || filters.maxPrice || filters.modality || filters.verifiedOnly

  const selectCls = 'text-sm rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none'

  // ── Barre de filtres HORIZONTALE ──────────────────────────
  const FilterBar = () => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">
        <SlidersHorizontal size={14} /> Filtres
      </span>

      <select className={selectCls} value={filters.subject} onChange={e => setFilter('subject', e.target.value)}>
        <option value="">Toutes les matières</option>
        {SUBJECTS.map(s => <option key={s}>{s}</option>)}
      </select>

      <select className={selectCls} value={filters.levelKey} onChange={e => setFilter('levelKey', e.target.value)}>
        <option value="">Toutes les classes</option>
        {levelPackages.map(p => <option key={p.levelKey} value={p.levelKey}>{p.label}</option>)}
      </select>

      <select className={selectCls} value={filters.city} onChange={e => setFilter('city', e.target.value)}>
        <option value="">Toutes les villes</option>
        {CITIES.map(c => <option key={c}>{c}</option>)}
      </select>

      <select className={selectCls} value={filters.modality} onChange={e => setFilter('modality', e.target.value)}>
        <option value="">Toutes les modalités</option>
        {MODALITIES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>

      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5">
        <span className="text-xs text-gray-400">FCFA</span>
        <input type="number" placeholder="Min" step="5000" min="5000"
               className="w-16 text-sm outline-none bg-transparent text-gray-700"
               value={filters.minPrice} onChange={e => setFilter('minPrice', e.target.value)} />
        <span className="text-gray-300">–</span>
        <input type="number" placeholder="Max" step="5000" min="5000"
               className="w-16 text-sm outline-none bg-transparent text-gray-700"
               value={filters.maxPrice} onChange={e => setFilter('maxPrice', e.target.value)} />
      </div>

      <label className={`flex items-center gap-1.5 cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${filters.verifiedOnly ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-600'}`}>
        <input type="checkbox" checked={filters.verifiedOnly}
               onChange={e => setFilter('verifiedOnly', e.target.checked)} className="accent-primary w-4 h-4" />
        Vérifiés uniquement
      </label>

      {hasActiveFilters && (
        <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium px-2 py-2">
          <X size={14} /> Effacer
        </button>
      )}
    </div>
  )

  return (
    <MarketplaceShell>
      <div className="bg-surface min-h-full">
        {/* Barre du haut : recherche + tri + vue + filtres */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 bg-gray-50 rounded-xl px-3 py-2">
                <Search size={18} className="text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Rechercher un répétiteur, une matière..."
                  className="bg-transparent flex-1 outline-none text-sm text-gray-800 placeholder:text-gray-400"
                  value={filters.query}
                  onChange={e => setFilter('query', e.target.value)}
                />
                {filters.query && (
                  <button onClick={() => setFilter('query', '')}><X size={16} className="text-gray-400" /></button>
                )}
              </div>

              <select
                className={`hidden sm:block ${selectCls} w-44`}
                value={filters.sortBy}
                onChange={e => setFilter('sortBy', e.target.value)}
              >
                <option value="pertinence">Pertinence</option>
                <option value="note">Meilleures notes</option>
                <option value="prix_asc">Prix croissant</option>
                <option value="prix_desc">Prix décroissant</option>
              </select>

              <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1">
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-400'}`} title="Vue liste">
                  <List size={16} />
                </button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-400'}`} title="Vue grille">
                  <LayoutGrid size={16} />
                </button>
              </div>

              {/* Toggle filtres (mobile) */}
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors lg:hidden ${filtersOpen ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-600'}`}
              >
                <SlidersHorizontal size={16} />
                {hasActiveFilters && <span className="w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center">!</span>}
              </button>
            </div>

            {/* Barre de filtres horizontale : desktop toujours, mobile si ouvert */}
            <div className={`${filtersOpen ? 'block' : 'hidden'} lg:block mt-3 pt-3 border-t border-gray-100`}>
              <FilterBar />
            </div>
          </div>
        </div>

        {/* Résultats pleine largeur */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-gray-600 text-sm">
              <span className="font-semibold text-gray-900">{filtered.length}</span> répétiteur{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Search size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700 text-lg mb-2">Aucun répétiteur trouvé</h3>
              <p className="text-gray-400 text-sm">Essayez d'élargir vos critères de recherche.</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="btn-outline mt-4 text-sm">Effacer les filtres</button>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid'
              ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-5'
              : 'flex flex-col gap-4'
            }>
              {filtered.map(tutor => (
                <TutorCard key={tutor.id} tutor={tutor} list={viewMode === 'list'} />
              ))}
            </div>
          )}
        </div>
      </div>
    </MarketplaceShell>
  )
}

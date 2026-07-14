'use client'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useApp } from '../context/AppContext'
import TutorCard from '../components/common/TutorCard'
import { SUBJECTS, LEVELS, CITIES } from '../data/constants'
import { MODALITIES } from '../utils/helpers'
import { Search, SlidersHorizontal, X, LayoutGrid, List, Home, Building2, Users, Wifi } from 'lucide-react'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const { tutors } = useApp()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState('grid')

  const [filters, setFilters] = useState({
    query: searchParams.get('q') || '',
    city: searchParams.get('ville') || '',
    subject: searchParams.get('matiere') || '',
    level: searchParams.get('niveau') || '',
    minPrice: '',
    maxPrice: '',
    modality: '',
    verifiedOnly: false,
    sortBy: 'pertinence',
  })

  const setFilter = (key, val) => setFilters(p => ({ ...p, [key]: val }))

  const filtered = useMemo(() => {
    let result = tutors.filter(t => t.isActive && t.verificationStatus === 'verified')

    if (filters.query) {
      const q = filters.query.toLowerCase()
      result = result.filter(t =>
        `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
        t.subjects.some(s => s.toLowerCase().includes(q)) ||
        t.bio.toLowerCase().includes(q)
      )
    }
    if (filters.city) result = result.filter(t => t.city.toLowerCase().includes(filters.city.toLowerCase()))
    if (filters.subject) result = result.filter(t => t.subjects.includes(filters.subject))
    if (filters.level) result = result.filter(t => t.levels.includes(filters.level))
    if (filters.minPrice) result = result.filter(t => t.monthlyRate >= parseInt(filters.minPrice))
    if (filters.maxPrice) result = result.filter(t => t.monthlyRate <= parseInt(filters.maxPrice))
    if (filters.modality) result = result.filter(t => t.modalities?.includes(filters.modality))
    if (filters.verifiedOnly) result = result.filter(t => t.verificationStatus === 'verified')

    switch (filters.sortBy) {
      case 'note': return [...result].sort((a, b) => b.rating - a.rating)
      case 'prix_asc': return [...result].sort((a, b) => a.monthlyRate - b.monthlyRate)
      case 'prix_desc': return [...result].sort((a, b) => b.monthlyRate - a.monthlyRate)
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
    query: '', city: '', subject: '', level: '',
    minPrice: '', maxPrice: '', modality: '', verifiedOnly: false, sortBy: 'pertinence',
  })

  const hasActiveFilters = filters.city || filters.subject || filters.level ||
    filters.minPrice || filters.maxPrice || filters.modality || filters.verifiedOnly

  const FilterPanel = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Matière</label>
        <select className="input-field" value={filters.subject} onChange={e => setFilter('subject', e.target.value)}>
          <option value="">Toutes les matières</option>
          {SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Niveau</label>
        <div className="flex flex-col gap-2">
          {['', ...LEVELS].map(l => (
            <label key={l} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="level"
                checked={filters.level === l}
                onChange={() => setFilter('level', l)}
                className="accent-primary"
              />
              <span className="text-sm text-gray-700">{l || 'Tous les niveaux'}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Ville</label>
        <select className="input-field" value={filters.city} onChange={e => setFilter('city', e.target.value)}>
          <option value="">Toutes les villes</option>
          {CITIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Tarif mensuel (FCFA)</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="Min"
            className="input-field"
            value={filters.minPrice}
            onChange={e => setFilter('minPrice', e.target.value)}
            step="5000"
            min="5000"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            type="number"
            placeholder="Max"
            className="input-field"
            value={filters.maxPrice}
            onChange={e => setFilter('maxPrice', e.target.value)}
            step="5000"
            min="5000"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Modalité de cours</label>
        <div className="grid grid-cols-2 gap-2">
          {MODALITIES.map(m => {
            const icons = {
              domicile_parent: <Home size={14} />,
              domicile_repetiteur: <Building2 size={14} />,
              lieu_neutre: <Users size={14} />,
              en_ligne: <Wifi size={14} />,
            }
            const active = filters.modality === m.id
            return (
              <button
                key={m.id}
                onClick={() => setFilter('modality', active ? '' : m.id)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium transition-colors text-left ${
                  active
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {icons[m.id]}
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.verifiedOnly}
            onChange={e => setFilter('verifiedOnly', e.target.checked)}
            className="accent-primary w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">Répétiteurs vérifiés uniquement</span>
        </label>
      </div>

      {hasActiveFilters && (
        <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium">
          <X size={14} />
          Effacer les filtres
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Search input */}
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

            {/* Sort */}
            <select
              className="hidden sm:block input-field w-44 text-sm py-2"
              value={filters.sortBy}
              onChange={e => setFilter('sortBy', e.target.value)}
            >
              <option value="pertinence">Pertinence</option>
              <option value="note">Meilleures notes</option>
              <option value="prix_asc">Prix croissant</option>
              <option value="prix_desc">Prix décroissant</option>
            </select>

            {/* View mode */}
            <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-400'}`}>
                <LayoutGrid size={16} />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-400'}`}>
                <List size={16} />
              </button>
            </div>

            {/* Filter toggle (mobile) */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors lg:hidden ${filtersOpen ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-600'}`}
            >
              <SlidersHorizontal size={16} />
              Filtres
              {hasActiveFilters && (
                <span className="w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center">!</span>
              )}
            </button>
          </div>

          {/* Mobile filters dropdown */}
          {filtersOpen && (
            <div className="lg:hidden mt-3 pt-3 border-t border-gray-100">
              <FilterPanel />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-6">
          {/* Sidebar filters (desktop) */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="card sticky top-32">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <SlidersHorizontal size={16} />
                Filtres
              </h2>
              <FilterPanel />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-5">
              <p className="text-gray-600 text-sm">
                <span className="font-semibold text-gray-900">{filtered.length}</span> répétiteur{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
              </p>
              <select
                className="sm:hidden input-field w-44 text-sm py-2"
                value={filters.sortBy}
                onChange={e => setFilter('sortBy', e.target.value)}
              >
                <option value="pertinence">Pertinence</option>
                <option value="note">Meilleures notes</option>
                <option value="prix_asc">Prix croissant</option>
                <option value="prix_desc">Prix décroissant</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <Search size={48} className="text-gray-300 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-700 text-lg mb-2">Aucun répétiteur trouvé</h3>
                <p className="text-gray-400 text-sm">Essayez d'élargir vos critères de recherche.</p>
                <button onClick={clearFilters} className="btn-outline mt-4 text-sm">
                  Effacer les filtres
                </button>
              </div>
            ) : (
              <div className={viewMode === 'grid'
                ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-5'
                : 'flex flex-col gap-4'
              }>
                {filtered.map(tutor => (
                  <TutorCard key={tutor.id} tutor={tutor} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

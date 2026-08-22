'use client'
import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { SUBJECTS } from '../../data/constants'
import { formatFCFA } from '../../utils/helpers'

// Éditeur des offres du répétiteur : un tarif mensuel par classe, matières par
// classe au secondaire, avec remplissage groupé (collège / lycée).
export default function OffersEditor() {
  const { levelPackages, loadTutorOffers, saveTutorOffers } = useApp()
  const { currentUser } = useAuth()

  // state: { [levelKey]: { enabled, price, subjects[] } }
  const [state, setState] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkPrice, setBulkPrice] = useState('')

  useEffect(() => {
    if (!currentUser?.id || levelPackages.length === 0) return
    let cancelled = false
    loadTutorOffers(currentUser.id).then(offers => {
      if (cancelled) return
      const init = {}
      levelPackages.forEach(p => {
        const existing = offers.find(o => o.levelKey === p.levelKey)
        init[p.levelKey] = existing
          ? { enabled: true, price: String(existing.monthlyPrice ?? ''), subjects: existing.subjects || [] }
          : { enabled: false, price: '', subjects: [] }
      })
      setState(init)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [currentUser?.id, levelPackages, loadTutorOffers])

  const set = (lk, patch) => setState(s => ({ ...s, [lk]: { ...s[lk], ...patch } }))
  const toggleSubject = (lk, subj) => setState(s => {
    const cur = s[lk]?.subjects || []
    const next = cur.includes(subj) ? cur.filter(x => x !== subj) : [...cur, subj]
    return { ...s, [lk]: { ...s[lk], subjects: next } }
  })

  // Remplissage groupé : applique le prix (et active) à toutes les classes d'une catégorie.
  const applyBulk = (category) => {
    if (!bulkPrice) return
    setState(s => {
      const next = { ...s }
      levelPackages.filter(p => p.category === category).forEach(p => {
        next[p.levelKey] = { ...next[p.levelKey], enabled: true, price: String(bulkPrice) }
      })
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const offers = levelPackages
      .filter(p => state[p.levelKey]?.enabled)
      .map(p => ({
        levelKey: p.levelKey,
        monthlyPrice: Number(state[p.levelKey].price) || 0,
        subjects: p.hasSubjects ? (state[p.levelKey].subjects || []) : [],
      }))
    await saveTutorOffers(currentUser.id, offers)
    setSaving(false)
  }

  if (levelPackages.length === 0) {
    return <p className="text-sm text-gray-400">Les forfaits ne sont pas encore chargés. Réessayez dans un instant.</p>
  }
  if (!loaded) {
    return <p className="text-sm text-gray-400">Chargement de vos tarifs…</p>
  }

  const enabledCount = levelPackages.filter(p => state[p.levelKey]?.enabled).length

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Indiquez un <strong>tarif mensuel</strong> pour chaque classe que vous prenez, et les matières correspondantes.
        Le forfait (nombre de séances et durée) est fixe pour chaque niveau.
      </p>

      {/* Remplissage groupé */}
      <div className="bg-gray-50 rounded-xl p-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500">Remplissage rapide (prix mensuel)
          <input type="number" step="1000" className="input-field mt-1 w-32" placeholder="ex. 20000"
            value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} />
        </label>
        <button type="button" onClick={() => applyBulk('college')} className="btn-outline text-xs py-2">Appliquer au collège</button>
        <button type="button" onClick={() => applyBulk('lycee')} className="btn-outline text-xs py-2">Appliquer au lycée</button>
      </div>

      {/* Une carte par niveau */}
      <div className="space-y-3">
        {levelPackages.map(p => {
          const st = state[p.levelKey] || { enabled: false, price: '', subjects: [] }
          return (
            <div key={p.levelKey} className={`border rounded-xl p-3 transition-colors ${st.enabled ? 'border-primary bg-primary-50/30' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={st.enabled} onChange={e => set(p.levelKey, { enabled: e.target.checked })} className="w-4 h-4 accent-primary" />
                  <span className="font-semibold text-gray-800">{p.label}</span>
                  <span className="text-xs text-gray-400">{p.sessionsPerWeek}×{p.hoursPerSession}h/sem · {p.hoursPerMonth}h/mois</span>
                </label>
                {st.enabled && (
                  <div className="flex items-center gap-1">
                    <input type="number" step="1000" min="0" placeholder="Tarif/mois" className="input-field w-32 text-right"
                      value={st.price} onChange={e => set(p.levelKey, { price: e.target.value })} />
                    <span className="text-xs text-gray-400">FCFA</span>
                  </div>
                )}
              </div>

              {st.enabled && p.hasSubjects && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">Matières enseignées pour cette classe :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUBJECTS.map(subj => {
                      const on = (st.subjects || []).includes(subj)
                      return (
                        <button type="button" key={subj} onClick={() => toggleSubject(p.levelKey, subj)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${on ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {subj}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-400">{enabledCount} niveau{enabledCount > 1 ? 'x' : ''} proposé{enabledCount > 1 ? 's' : ''}</p>
        <button onClick={handleSave} disabled={saving} className="btn-primary px-6 disabled:opacity-60">
          {saving ? 'Enregistrement…' : 'Enregistrer mes tarifs'}
        </button>
      </div>
    </div>
  )
}

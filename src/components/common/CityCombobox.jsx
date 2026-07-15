'use client'
import { useState, useRef, useEffect } from 'react'
import { CITIES } from '../../data/constants'
import { ChevronDown } from 'lucide-react'

export default function CityCombobox({ value, onChange }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (value && value !== query) setQuery(value)
  }, [value])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))

  const select = (city) => {
    setQuery(city)
    onChange(city)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          className="input-field pr-8"
          placeholder="Rechercher une ville..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); onChange('') }}
        />
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <li
              key={c}
              className="px-4 py-2.5 text-sm cursor-pointer hover:bg-primary-50 hover:text-primary transition-colors"
              onMouseDown={() => select(c)}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

'use client'
import { useRef } from 'react'

const LEN = 8

export default function OtpInput({ value, onChange, focusColorClass = 'focus:border-primary' }) {
  const refs = useRef([])
  // Cases vides = chaîne vide (pas un espace) : avec maxLength=1, un espace
  // pré-rempli est déjà "1 caractère" pour le champ, ce qui empêche la
  // saisie native au clavier (seul le collage fonctionnait auparavant).
  const chars = value.split('').concat(Array(LEN).fill('')).slice(0, LEN)

  const update = (i, char) => {
    const next = [...chars]
    next[i] = char
    onChange(next.join(''))
  }

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2 justify-center"
      onPaste={e => {
        e.preventDefault()
        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN)
        onChange(text)
        refs.current[Math.min(text.length, LEN - 1)]?.focus()
      }}
    >
      {chars.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5 sm:gap-2">
          <input
            ref={el => { refs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={c}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(-1)
              update(i, v)
              if (v && i < LEN - 1) refs.current[i + 1]?.focus()
            }}
            onKeyDown={e => {
              if (e.key === 'Backspace') {
                if (!c && i > 0) { update(i - 1, ''); refs.current[i - 1]?.focus() }
                else update(i, '')
              }
            }}
            className={`w-9 h-12 sm:w-10 sm:h-13 text-center text-lg font-bold border-2 rounded-xl outline-none ${focusColorClass} transition-colors bg-white text-gray-900`}
          />
          {i === 3 && <div className="w-3 h-0.5 bg-gray-300 rounded flex-shrink-0" />}
        </div>
      ))}
    </div>
  )
}

'use client'
import { useRef } from 'react'

const LEN = 6

// Style « Dynamique » (choisi dans la démo) :
//  • focus  → la case se soulève (translateY) + ombre orange
//  • insert → le chiffre se retourne (flip 3D)
//  • valider→ cascade rebondie (status="success") ou secousse (status="error")
// `status` est optionnel : 'idle' | 'success' | 'error' (passé par la page à la vérif).
export default function OtpInput({ value, onChange, status = 'idle', focusColorClass = 'focus:border-primary' }) {
  const refs = useRef([])
  const chars = value.split('').concat(Array(LEN).fill('')).slice(0, LEN)

  const update = (i, char) => {
    const next = [...chars]
    next[i] = char
    onChange(next.join(''))
  }

  // Rejoue l'animation de « pop » (flip) sur une case donnée.
  const pop = (el) => { if (!el) return; el.classList.remove('otp-pop'); void el.offsetWidth; el.classList.add('otp-pop') }

  return (
    <>
      <style>{`
        @keyframes otpFlip { 0%{transform:perspective(240px) rotateX(-92deg);opacity:0} 100%{transform:perspective(240px) rotateX(0);opacity:1} }
        @keyframes otpWave { 0%{transform:translateY(0) scale(1)} 40%{transform:translateY(-9px) scale(1.09)} 100%{transform:translateY(0) scale(1)} }
        @keyframes otpShake { 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(3px)} 30%,50%,70%{transform:translateX(-8px)} 40%,60%{transform:translateX(8px)} }
        .otp-cell { transition: border-color .18s, box-shadow .18s, transform .18s cubic-bezier(.34,1.56,.64,1); }
        .otp-cell:focus { transform: translateY(-6px); box-shadow: 0 12px 20px -8px rgba(232,119,34,.45); }
        .otp-cell.otp-pop { animation: otpFlip .32s ease-out; }
        .otp-cell.otp-ok { animation: otpWave .5s both; }
        .otp-row.otp-err { animation: otpShake .5s; }
        @media (prefers-reduced-motion: reduce) {
          .otp-cell, .otp-cell.otp-pop, .otp-cell.otp-ok, .otp-row.otp-err { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div
        className={`otp-row flex items-center gap-2 sm:gap-2.5 justify-center ${status === 'error' ? 'otp-err' : ''}`}
        onPaste={e => {
          e.preventDefault()
          const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN)
          onChange(text)
          requestAnimationFrame(() => {
            text.split('').forEach((_, i) => pop(refs.current[i]))
            refs.current[Math.min(text.length, LEN - 1)]?.focus()
          })
        }}
      >
        {chars.map((c, i) => (
          <div key={i} className="flex items-center gap-2 sm:gap-2.5">
            <input
              ref={el => { refs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={c}
              aria-label={`Chiffre ${i + 1}`}
              style={status === 'success' ? { animationDelay: `${i * 55}ms` } : undefined}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(-1)
                update(i, v)
                if (v) { pop(e.target); if (i < LEN - 1) refs.current[i + 1]?.focus() }
              }}
              onKeyDown={e => {
                if (e.key === 'Backspace') {
                  if (!c && i > 0) { update(i - 1, ''); refs.current[i - 1]?.focus() }
                  else update(i, '')
                }
              }}
              className={`otp-cell w-11 h-14 sm:w-12 sm:h-15 text-center text-xl font-bold border-2 rounded-xl outline-none ${focusColorClass} bg-white text-gray-900 ${
                status === 'success' ? 'otp-ok border-secondary text-secondary'
                : status === 'error' ? 'border-red-400 text-red-600'
                : 'border-gray-200'
              }`}
            />
            {i === 2 && <div className="w-3 h-0.5 bg-gray-300 rounded flex-shrink-0" />}
          </div>
        ))}
      </div>
    </>
  )
}

import { useState } from 'react'
import { Star } from 'lucide-react'

export default function StarRating({ rating, size = 14, showNumber = true, count = null, className = '' }) {
  const stars = [1, 2, 3, 4, 5]
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex items-center gap-0.5">
        {stars.map(star => {
          const filled = star <= Math.floor(rating)
          const partial = !filled && star <= rating + 0.5
          return (
            <Star
              key={star}
              size={size}
              className={filled || partial ? 'text-accent fill-accent' : 'text-gray-300'}
              fill={filled ? '#F4A61D' : 'none'}
            />
          )
        })}
      </div>
      {showNumber && rating > 0 && (
        <span className="text-sm font-semibold text-gray-700">{rating.toFixed(1)}</span>
      )}
      {count !== null && (
        <span className="text-sm text-gray-400">({count})</span>
      )}
    </div>
  )
}

export function InteractiveStarRating({ value, onChange, size = 24 }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            size={size}
            className={(hovered || value) >= star ? 'text-accent' : 'text-gray-300'}
            fill={(hovered || value) >= star ? '#F4A61D' : 'none'}
          />
        </button>
      ))}
    </div>
  )
}

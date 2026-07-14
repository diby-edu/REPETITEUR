import { getInitials } from '../../utils/helpers'

export default function Avatar({ user, size = 'md', className = '' }) {
  const sizes = {
    xs: 'w-8 h-8 text-xs',
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
    '2xl': 'w-32 h-32 text-4xl',
  }

  const initials = getInitials(user?.firstName, user?.lastName)
  const color = user?.avatarColor || '#E87722'

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

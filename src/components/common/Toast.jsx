import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const icons = {
  success: <CheckCircle size={20} className="text-green-500" />,
  error: <XCircle size={20} className="text-red-500" />,
  info: <Info size={20} className="text-blue-500" />,
}

export default function Toast({ message, type = 'success' }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-bounce-in md:bottom-6">
      <div className="flex items-center gap-3 bg-white border border-gray-200 shadow-lg rounded-2xl px-5 py-3.5 min-w-[280px] max-w-sm">
        {icons[type] || icons.success}
        <p className="text-sm font-medium text-gray-800 flex-1">{message}</p>
        <button onClick={() => setVisible(false)} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

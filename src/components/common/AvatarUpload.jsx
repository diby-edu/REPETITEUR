'use client'
import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Avatar from './Avatar'

// Upload d'une photo de profil dans le bucket public "avatars".
// Appelle onUploaded(url) avec l'URL publique une fois l'envoi réussi.
export default function AvatarUpload({ user, userId, onUploaded, required = false }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [preview, setPreview] = useState(null)

  const current = preview || user?.avatarUrl

  const handleFile = async (file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErr('Image trop lourde (5 Mo max).'); return }
    if (!userId) { setErr('Session requise.'); return }
    setBusy(true); setErr('')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${userId}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) { setErr("Échec de l'envoi : " + error.message); setBusy(false); return }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${data.publicUrl}?t=${Date.now()}` // cache-bust après remplacement
      setPreview(url)
      onUploaded?.(url)
    } catch (e) { setErr('Erreur inattendue.') }
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-4">
      <div className={required && !current ? 'rounded-full ring-2 ring-red-300' : ''}>
        <Avatar user={{ ...user, avatarUrl: current }} size="xl" />
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 text-sm font-semibold text-primary border border-primary rounded-lg px-4 py-2 hover:bg-primary-50 disabled:opacity-50 transition-colors"
        >
          <Camera size={15} /> {busy ? 'Envoi…' : (current ? 'Changer la photo' : 'Ajouter une photo')}
        </button>
        <p className="text-xs text-gray-400 mt-1">
          JPG, PNG ou WebP — 5 Mo max{required && !current ? ' · obligatoire' : ''}
        </p>
        {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      </div>
    </div>
  )
}

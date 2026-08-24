'use client'
import { useRef, useState, useEffect } from 'react'
import { Camera, Upload, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Avatar from './Avatar'

// Photo de profil : au choix « Prendre une photo » (caméra) ou « Charger une image » (fichier).
// Upload dans le bucket public "avatars" → onUploaded(url) avec l'URL publique.
export default function AvatarUpload({ user, userId, onUploaded, required = false }) {
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [preview, setPreview] = useState(null)
  const [cameraOn, setCameraOn] = useState(false)

  const current = preview || user?.avatarUrl

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }
  useEffect(() => () => stopCamera(), [])

  const startCamera = async () => {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false,
      })
      streamRef.current = stream
      setCameraOn(true)
      // laisser le <video> se monter puis attacher le flux
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play?.() } }, 50)
    } catch (e) {
      setErr("Caméra indisponible — utilisez « Charger une image ».")
    }
  }

  const uploadBlob = async (blob, ext, contentType) => {
    if (!userId) { setErr('Session requise.'); return }
    if (blob.size > 5 * 1024 * 1024) { setErr('Image trop lourde (5 Mo max).'); return }
    setBusy(true); setErr('')
    try {
      const path = `${userId}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars')
        .upload(path, blob, { upsert: true, contentType })
      if (error) { setErr("Échec de l'envoi : " + error.message); setBusy(false); return }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${data.publicUrl}?t=${Date.now()}` // cache-bust après remplacement
      setPreview(url)
      onUploaded?.(url)
    } catch (e) { setErr('Erreur inattendue.') }
    setBusy(false)
  }

  const handleFile = (file) => {
    if (!file) return
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    uploadBlob(file, ext, file.type || 'image/jpeg')
  }

  const capture = () => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c) return
    // carré centré à partir du flux
    const side = Math.min(v.videoWidth, v.videoHeight)
    const sx = (v.videoWidth - side) / 2, sy = (v.videoHeight - side) / 2
    c.width = 512; c.height = 512
    c.getContext('2d').drawImage(v, sx, sy, side, side, 0, 0, 512, 512)
    c.toBlob(blob => { if (blob) { stopCamera(); uploadBlob(blob, 'jpg', 'image/jpeg') } }, 'image/jpeg', 0.9)
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className={required && !current ? 'rounded-full ring-2 ring-red-300' : ''}>
          <Avatar user={{ ...user, avatarUrl: current }} size="xl" />
        </div>
        {!cameraOn && (
          <div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={startCamera} disabled={busy}
                className="flex items-center gap-2 text-sm font-semibold text-primary border border-primary rounded-lg px-3 py-2 hover:bg-primary-50 disabled:opacity-50 transition-colors">
                <Camera size={15} /> Prendre une photo
              </button>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                <Upload size={15} /> {busy ? 'Envoi…' : 'Charger une image'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              JPG, PNG ou WebP — 5 Mo max{required && !current ? ' · obligatoire' : ''}
            </p>
            {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
        className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
      <canvas ref={canvasRef} className="hidden" />

      {cameraOn && (
        <div className="mt-3 bg-gray-50 rounded-xl p-4 flex flex-col items-center gap-3">
          <video ref={videoRef} autoPlay playsInline muted
            className="w-48 h-48 rounded-full object-cover border-2 border-primary/30 bg-black" />
          <div className="flex gap-3">
            <button type="button" onClick={capture} disabled={busy}
              className="btn-primary text-sm px-5 flex items-center gap-2">
              <Camera size={15} /> {busy ? 'Envoi…' : 'Capturer'}
            </button>
            <button type="button" onClick={stopCamera}
              className="btn-outline text-sm px-4 flex items-center gap-2">
              <X size={15} /> Annuler
            </button>
          </div>
          <p className="text-xs text-gray-400">Cadrez votre visage dans le cercle.</p>
        </div>
      )}
    </div>
  )
}

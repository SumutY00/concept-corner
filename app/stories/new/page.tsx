'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NewStoryPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Sadece görsel dosyaları destekleniyor.'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Sadece görsel destekleniyor.'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  const handleShare = async () => {
    if (!file) { setError('Lütfen bir görsel seç.'); return }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('stories')
      .upload(path, file)

    if (uploadErr) { setError('Görsel yüklenemedi: ' + uploadErr.message); setLoading(false); return }

    const { data: urlData } = supabase.storage.from('stories').getPublicUrl(path)

    const { error: insertErr } = await supabase.from('stories').insert({
      user_id: user.id,
      image_url: urlData.publicUrl,
      caption: caption.trim() || null,
    })

    if (insertErr) { setError('Hikaye paylaşılamadı: ' + insertErr.message); setLoading(false); return }

    router.push('/')
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .sn-page {
          min-height: 100dvh; background: #000;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-family: var(--cc-font-body); color: #fff; position: relative;
        }
        .sn-back {
          position: absolute; top: 20px; left: 20px; z-index: 10;
          background: rgba(255,255,255,0.12); border: none; border-radius: 50%;
          width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #fff; text-decoration: none; transition: background 0.2s;
        }
        .sn-back:hover { background: rgba(255,255,255,0.22); }

        /* Önizleme */
        .sn-preview-wrap {
          position: relative; width: 100%; max-width: 420px;
          aspect-ratio: 9/16; border-radius: 20px; overflow: hidden;
          background: #111; margin-bottom: 20px;
        }
        .sn-preview-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sn-preview-caption {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 16px; background: linear-gradient(transparent, rgba(0,0,0,0.65));
          font-size: 15px; font-weight: 500; color: #fff; text-align: center;
          min-height: 60px; display: flex; align-items: flex-end; justify-content: center;
        }

        /* Upload area */
        .sn-upload-area {
          width: 100%; max-width: 420px; aspect-ratio: 9/16;
          border: 2px dashed rgba(255,255,255,0.25); border-radius: 20px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 14px; cursor: pointer; transition: border-color 0.2s, background 0.2s;
          background: rgba(255,255,255,0.04); margin-bottom: 20px;
        }
        .sn-upload-area:hover { border-color: rgba(102,126,234,0.7); background: rgba(102,126,234,0.06); }
        .sn-upload-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex; align-items: center; justify-content: center;
        }
        .sn-upload-text { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.9); }
        .sn-upload-sub { font-size: 13px; color: rgba(255,255,255,0.45); }

        /* Caption input */
        .sn-caption-wrap {
          width: 100%; max-width: 420px;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px; overflow: hidden; margin-bottom: 14px;
        }
        .sn-caption-input {
          width: 100%; padding: 14px 16px; background: transparent;
          border: none; outline: none; color: #fff; font-size: 15px;
          font-family: var(--cc-font-body); resize: none; line-height: 1.5;
        }
        .sn-caption-input::placeholder { color: rgba(255,255,255,0.35); }
        .sn-caption-count { padding: 6px 16px 10px; font-size: 11px; color: rgba(255,255,255,0.35); text-align: right; }

        /* Buttons */
        .sn-btn {
          width: 100%; max-width: 420px; padding: 15px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none; border-radius: 14px; color: #fff;
          font-family: var(--cc-font-body); font-size: 16px; font-weight: 700;
          cursor: pointer; transition: opacity 0.2s; letter-spacing: 0.01em;
          box-shadow: 0 6px 20px rgba(102,126,234,0.4);
        }
        .sn-btn:hover:not(:disabled) { opacity: 0.88; }
        .sn-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .sn-change-btn {
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 10px; color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 500;
          padding: 8px 18px; cursor: pointer; transition: background 0.2s;
          font-family: var(--cc-font-body); margin-bottom: 12px;
        }
        .sn-change-btn:hover { background: rgba(255,255,255,0.18); }

        .sn-error {
          width: 100%; max-width: 420px; padding: 10px 14px;
          background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px; color: #fca5a5; font-size: 13px; margin-bottom: 12px;
          text-align: center;
        }

        @media (max-width: 480px) {
          .sn-preview-wrap, .sn-upload-area { max-width: 100%; border-radius: 0; }
          .sn-caption-wrap, .sn-btn { max-width: 100%; }
        }
      `}</style>

      <div className="sn-page">
        <a href="/" className="sn-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </a>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />

        {preview ? (
          <>
            <div className="sn-preview-wrap">
              <img src={preview} alt="Önizleme" className="sn-preview-img" />
              {caption && <div className="sn-preview-caption">{caption}</div>}
            </div>

            <button className="sn-change-btn" onClick={() => inputRef.current?.click()}>
              Görseli Değiştir
            </button>

            <div className="sn-caption-wrap">
              <textarea
                className="sn-caption-input"
                placeholder="Açıklama ekle... (isteğe bağlı)"
                value={caption}
                rows={2}
                maxLength={200}
                onChange={e => setCaption(e.target.value)}
              />
              <div className="sn-caption-count">{caption.length}/200</div>
            </div>
          </>
        ) : (
          <div
            className="sn-upload-area"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <div className="sn-upload-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <span className="sn-upload-text">Görsel Seç</span>
            <span className="sn-upload-sub">JPG, PNG, WEBP · 9:16 önerilir</span>
          </div>
        )}

        {error && <div className="sn-error">{error}</div>}

        <button
          className="sn-btn"
          onClick={handleShare}
          disabled={!file || loading}
        >
          {loading ? 'Paylaşılıyor...' : '✦ Hikayeni Paylaş'}
        </button>
      </div>
    </>
  )
}

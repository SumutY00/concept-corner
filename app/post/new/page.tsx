'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NewPostPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [conceptId, setConceptId] = useState('')
  const [selectedConcept, setSelectedConcept] = useState<any>(null)
  const [concepts, setConcepts] = useState<any[]>([])
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const MAX_IMAGES = 5
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data } = await supabase
        .from('concepts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      setConcepts(data ?? [])
    }
    init()
  }, [])

  const handleConceptChange = (id: string) => {
    setConceptId(id)
    const concept = concepts.find(c => c.id === id)
    setSelectedConcept(concept ?? null)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const combined = [...images, ...files].slice(0, MAX_IMAGES)
    setImages(combined)
    setPreviews(combined.map(f => URL.createObjectURL(f)))
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)
    setPreviews(newImages.map(f => URL.createObjectURL(f)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!conceptId) {
      setMessage('Lütfen bir konsept seç.')
      return
    }

    setLoading(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const imageUrls: string[] = []

    for (const file of images) {
      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, file)

      if (uploadError) {
        setMessage('Görsel yüklenemedi: ' + uploadError.message)
        setLoading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(filePath)
      imageUrls.push(urlData.publicUrl)
    }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      concept_id: conceptId,
      title,
      description,
      image_url: imageUrls[0] ?? null,
      images: imageUrls,
    })

    if (error) {
      setMessage('Paylaşım başarısız: ' + error.message)
      setLoading(false)
      return
    }

    const { data: userData } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single()

    router.push(`/profile/${userData?.username}`)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-page {
          min-height: 100vh; background: #0e0c0a;
          font-family: 'DM Sans', sans-serif; color: #f0ebe3; position: relative;
        }

        .cc-glow {
          position: fixed; top: -160px; left: -160px;
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(210,130,70,0.08) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
        }

        .cc-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 2.5rem;
          background: rgba(14,12,10,0.85); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: 'Playfair Display', serif; font-size: 18px; color: #f0ebe3; letter-spacing: 0.02em; }
        .cc-back { font-size: 13px; color: #6a6050; text-decoration: none; transition: color 0.2s; }
        .cc-back:hover { color: #f0ebe3; }

        .cc-container { position: relative; z-index: 1; max-width: 680px; margin: 0 auto; padding: 4rem 2rem; }

        .cc-title { font-family: 'Playfair Display', serif; font-size: 38px; font-weight: 700; color: #f0ebe3; line-height: 1.1; margin-bottom: 6px; }
        .cc-title em { font-style: italic; color: #c8865c; }

        .cc-divider { width: 48px; height: 1px; background: linear-gradient(90deg, #c8865c, transparent); margin: 1rem 0 2.5rem; }

        .cc-label { display: block; font-size: 11px; font-weight: 500; color: #6a6050; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 7px; }

        .cc-input, .cc-textarea, .cc-select {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 13px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; color: #f0ebe3; outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .cc-input::placeholder, .cc-textarea::placeholder { color: #3a342c; }
        .cc-input:focus, .cc-textarea:focus, .cc-select:focus { border-color: rgba(200,134,92,0.5); background: rgba(200,134,92,0.04); }
        .cc-textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
        .cc-select option { background: #1a140e; color: #f0ebe3; }

        .cc-field { margin-bottom: 1.4rem; }

        /* Konsept bilgi kartı */
        .cc-concept-info {
          background: rgba(200,134,92,0.06);
          border: 1px solid rgba(200,134,92,0.15);
          border-radius: 10px; padding: 1.2rem;
          margin-top: 10px;
        }

        .cc-concept-info-name {
          font-family: 'Playfair Display', serif;
          font-size: 18px; font-weight: 700; color: #f0ebe3;
          margin-bottom: 6px;
        }

        .cc-concept-info-desc { font-size: 13px; color: #7a7060; line-height: 1.6; margin-bottom: 8px; }

        .cc-concept-info-rules {
          font-size: 12px; color: #c8865c;
          line-height: 1.6; font-style: italic;
          padding-top: 8px;
          border-top: 1px solid rgba(200,134,92,0.1);
        }

        .cc-concept-dates {
          font-size: 11px; color: #524840;
          margin-top: 8px; letter-spacing: 0.04em;
        }

        /* Upload */
        .cc-upload-area {
          width: 100%; border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 8px; padding: 2rem; text-align: center;
          cursor: pointer; transition: border-color 0.2s, background 0.2s;
          background: rgba(255,255,255,0.02); position: relative;
        }

        .cc-upload-area:hover { border-color: rgba(200,134,92,0.4); background: rgba(200,134,92,0.03); }
        .cc-upload-area input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }

        .cc-upload-icon {
          width: 36px; height: 36px; margin: 0 auto 10px;
          border-radius: 50%; background: rgba(200,134,92,0.12);
          display: flex; align-items: center; justify-content: center;
        }

        .cc-upload-text { font-size: 14px; color: #6a6050; }
        .cc-upload-sub { font-size: 12px; color: #3a342c; margin-top: 4px; }

        .cc-preview { width: 100%; border-radius: 8px; overflow: hidden; margin-top: 12px; border: 1px solid rgba(255,255,255,0.08); }
        .cc-preview img { width: 100%; display: block; max-height: 360px; object-fit: cover; }

        .cc-btn {
          width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none; border-radius: 10px;
          font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 600; color: #fff;
          cursor: pointer; letter-spacing: 0.02em; transition: opacity 0.2s; margin-top: 0.5rem;
        }

        .cc-btn:hover:not(:disabled) { opacity: 0.88; }
        .cc-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .cc-msg-error { padding: 10px 14px; border-radius: 8px; font-size: 13px; background: rgba(200,80,70,0.15); border: 1px solid rgba(200,80,70,0.3); color: #e08878; margin-bottom: 1rem; }

        .cc-no-concepts {
          text-align: center; padding: 3rem;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
        }

        .cc-no-concepts-title { font-family: 'Playfair Display', serif; font-size: 22px; color: #3a342c; margin-bottom: 8px; }
        .cc-no-concepts-sub { font-size: 14px; color: #2a2420; }
      `}</style>

      <div className="cc-page">
        <div className="cc-glow" />

        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 36, width: 'auto' }} />
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <a href="/" className="cc-back">← Geri dön</a>
        </nav>

        <div className="cc-container">
          <h1 className="cc-title">Yeni <em>konsept.</em></h1>
          <div className="cc-divider" />

          {concepts.length === 0 ? (
            <div className="cc-no-concepts">
              <p className="cc-no-concepts-title">Aktif konsept yok.</p>
              <p className="cc-no-concepts-sub">Şu an paylaşıma açık bir konsept bulunmuyor. Yakında açılacak konseptleri takip et!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="cc-field">
                <label className="cc-label">Konsept Seç</label>
                <select
                  className="cc-select"
                  value={conceptId}
                  onChange={(e) => handleConceptChange(e.target.value)}
                  required
                >
                  <option value="">Konsept seç...</option>
                  {concepts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {selectedConcept && (
                  <div className="cc-concept-info">
                    <p className="cc-concept-info-name">{selectedConcept.name}</p>
                    {selectedConcept.description && (
                      <p className="cc-concept-info-desc">{selectedConcept.description}</p>
                    )}
                    {selectedConcept.rules && (
                      <p className="cc-concept-info-rules">📋 {selectedConcept.rules}</p>
                    )}
                    <p className="cc-concept-dates">
                      {new Date(selectedConcept.start_date).toLocaleDateString('tr-TR')} — {new Date(selectedConcept.end_date).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                )}
              </div>

              <div className="cc-field">
                <label className="cc-label">Başlık</label>
                <input
                  type="text" className="cc-input"
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  required placeholder="Konseptine bir isim ver"
                />
              </div>

              <div className="cc-field">
                <label className="cc-label">Açıklama</label>
                <textarea
                  className="cc-textarea"
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Bu konsept hakkında ne söylemek istersin? #hashtag ekleyebilirsin."
                />
                {description.match(/#[\wçğıöşüÇĞİÖŞÜ]+/gi) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {[...new Set(description.match(/#[\wçğıöşüÇĞİÖŞÜ]+/gi) ?? [])].map(tag => (
                      <span key={tag} style={{ fontSize: 12, color: '#a06090', background: 'rgba(160,96,144,0.12)', padding: '2px 8px', borderRadius: 20 }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="cc-field">
                <label className="cc-label">Görseller <span style={{ color: '#524840', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({images.length}/{MAX_IMAGES})</span></label>

                {/* Önizleme grid */}
                {previews.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }}>
                    {previews.map((src, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', aspectRatio: '1' }}>
                        {images[i]?.type.startsWith('video/')
                          ? <video src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          : <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        }
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          style={{
                            position: 'absolute', top: 4, right: 4,
                            width: 22, height: 22, borderRadius: '50%', border: 'none',
                            background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer',
                            fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >×</button>
                        {i === 0 && (
                          <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 10, background: 'rgba(200,134,92,0.85)', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>Kapak</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload alanı — max dolmadıysa göster */}
                {images.length < MAX_IMAGES && (
                  <div className="cc-upload-area">
                    <input type="file" accept="image/*,video/*" multiple onChange={handleImageChange} />
                    <div className="cc-upload-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8865c" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="cc-upload-text">{previews.length > 0 ? 'Daha fazla ekle' : 'Görsel veya video seç'}</p>
                    <p className="cc-upload-sub">JPG, PNG, WEBP, MP4 · En fazla {MAX_IMAGES} dosya</p>
                  </div>
                )}
              </div>

              {message && <div className="cc-msg-error">{message}</div>}

              <button type="submit" className="cc-btn" disabled={loading}>
                {loading ? 'Paylaşılıyor...' : 'Konsepti Paylaş'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

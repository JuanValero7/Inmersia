import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { supabase } from '../../lib/supabase.js'
import { CAT_COLOR, itint, ilum } from './tiendaHelpers.jsx'

// =============================================================
// PanelLibro · panel lateral de detalle (estilo storybook)
// Visual portado del prototipo "Calle (imagen)"; lógica de datos
// 100% real: reseñas y frases subrayadas desde Supabase, alta de
// reseña por upsert, CTA de compra y preview con LibroReel.
//
// Props:
//   libro       · fila de `libros` (+ _nuevo añadido por la Tienda)
//   user        · usuario auth
//   yaAdquirido · ya está en su biblioteca
//   yaLeido     · ya lo terminó (habilita reseñar)
//   onComprar() · añadir a la biblioteca
//   onClose()   · cerrar el panel
//   onPreview() · abrir LibroReel
// =============================================================

// Estrellas (lectura o interactivas).
function Estrellas({ valor, size = 15, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <span className="bkp-stars">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className="bkp-star"
          style={{
            fontSize: size,
            cursor: onChange ? 'pointer' : 'default',
            color: n <= (hover || valor) ? '#f0a83a' : 'rgba(74,54,34,0.22)',
          }}
          onClick={() => onChange && onChange(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}>★</span>
      ))}
    </span>
  )
}

// Portada: usa portada_url si existe; si no, genera una con el color del libro.
function Portada({ libro, cls }) {
  const c = libro.color || '#cf8a6e'
  if (libro.portada_url) {
    return <img className={clsx(cls, 'bkp-cover-img')} src={libro.portada_url} alt={libro.titulo} />
  }
  const light = ilum(c) > 0.62
  const fg   = light ? 'rgba(40,28,16,0.92)' : 'rgba(255,250,240,0.96)'
  const mark = light ? 'rgba(40,28,16,0.4)'  : 'rgba(255,247,225,0.85)'
  return (
    <div className={cls} style={{ background: `linear-gradient(150deg, ${itint(c, 0.18)}, ${itint(c, -0.16)})` }}>
      {libro._nuevo && <span className="bkp-ribbon">Nuevo</span>}
      <span className="bk-cover-band" />
      <span className="bkp-cover-mark" style={{ background: mark }} />
      <span className="bkp-cover-title" style={{ color: fg, textShadow: light ? 'none' : '0 1px 2px rgba(0,0,0,0.35)' }}>
        {libro.titulo}
      </span>
    </div>
  )
}

export default function PanelLibro({ libro, user, yaAdquirido, yaLeido, onComprar, onClose, onPreview, onEmpezarLeer }) {
  const [visible,   setVisible]   = useState(false)
  const [resenas,   setResenas]   = useState([])
  const [topQuotes, setTopQuotes] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [miResena,  setMiResena]  = useState(null)
  const [form,      setForm]      = useState({ rating: 0, texto: '' })
  const [modoForm,  setModoForm]  = useState(false)
  const [enviando,  setEnviando]  = useState(false)

  // Animar entrada
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  // Cerrar con Escape
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const fetchDatos = useCallback(async () => {
    setLoading(true)
    const [{ data: res }, { data: subs }] = await Promise.all([
      supabase
        .from('resenas_libros')
        .select('id, user_id, rating, texto, created_at')
        .eq('libro_id', libro.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('subrayados_usuario')
        .select('parrafo_id, texto_original')
        .eq('libro_id', libro.id)
        .not('parrafo_id', 'is', null),
    ])

    // Nombres por separado — no hay FK directo resenas→perfiles en PostgREST
    const resList = res || []
    let nombresMap = {}
    if (resList.length > 0) {
      const uids = [...new Set(resList.map(r => r.user_id))]
      const { data: perfs } = await supabase
        .from('perfiles').select('id, nombre').in('id', uids)
      nombresMap = Object.fromEntries((perfs || []).map(p => [p.id, p.nombre]))
    }
    const resenasConNombre = resList.map(r => ({
      ...r,
      perfiles: { nombre: nombresMap[r.user_id] || null },
    }))

    setResenas(resenasConNombre)
    const mine = resenasConNombre.find(r => r.user_id === user.id) || null
    setMiResena(mine)
    if (mine) setForm({ rating: mine.rating, texto: mine.texto || '' })

    const counts = {}
    ;(subs || []).forEach(s => {
      if (!counts[s.parrafo_id]) counts[s.parrafo_id] = { texto: s.texto_original, count: 0 }
      counts[s.parrafo_id].count++
    })
    setTopQuotes(Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 3))
    setLoading(false)
  }, [libro.id, user.id])

  useEffect(() => { fetchDatos() }, [fetchDatos])

  const ratingPromedio = resenas.length > 0
    ? (resenas.reduce((s, r) => s + r.rating, 0) / resenas.length).toFixed(1)
    : null

  async function submitResena() {
    if (!form.rating) return
    if ((form.texto?.length ?? 0) > 1000) return
    setEnviando(true)
    await supabase.from('resenas_libros').upsert(
      { user_id: user.id, libro_id: libro.id, rating: form.rating, texto: form.texto || null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,libro_id' }
    )
    await fetchDatos()
    setModoForm(false)
    setEnviando(false)
  }

  return (
    <aside className={clsx('bkp', visible && 'show')} role="dialog" aria-label="Detalle del libro">
      <button className="bkp-close" onClick={onClose} aria-label="Cerrar">×</button>

      {/* Portada + meta */}
      <div className="bkp-header">
        <Portada libro={libro} cls="bkp-cover" />
        <div className="bkp-meta">
          <h2 className="bkp-title">{libro.titulo}</h2>
          <p className="bkp-author">{libro.autor}</p>
          <button className="bkp-preview" onClick={onPreview}>◈ Preview</button>
          {(libro.anio || libro.paginas) && (
            <p className="bkp-detalle">{[libro.anio, libro.paginas && `${libro.paginas} págs.`].filter(Boolean).join(' · ')}</p>
          )}
          {ratingPromedio && (
            <div className="bkp-rating">
              <Estrellas valor={Math.round(parseFloat(ratingPromedio))} size={14} />
              <span>{ratingPromedio} · {resenas.length} reseña{resenas.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="bkp-cta">
        <button className="bkp-empezar-btn" onClick={onEmpezarLeer}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Empezar a leer
        </button>
        {yaAdquirido ? (
          <div className="bkp-adquirido">✓ Ya está en tu biblioteca</div>
        ) : (
          <button className="bkp-cta-btn" onClick={onComprar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5A8.9 8.9 0 006 4.2c-1 0-2 .2-3 .5v14a8.9 8.9 0 013-.5 8.9 8.9 0 016 2.3 8.9 8.9 0 016-2.3 8.9 8.9 0 013 .5v-14c-1-.3-2-.5-3-.5a8.9 8.9 0 00-6 2.3v14"/></svg>
            Añadir a mi Biblioteca
          </button>
        )}
      </div>

      {/* Sinopsis */}
      {libro.descripcion && (
        <div className="bkp-sec">
          <h3 className="bkp-sec-title">Sinopsis</h3>
          <p className="bkp-sinopsis">{libro.descripcion}</p>
        </div>
      )}

      {/* Categorías + Mood */}
      {((libro.categorias?.length > 0) || (libro.moods?.length > 0)) && (
        <div className="bkp-sec">
          {libro.categorias?.length > 0 && (
            <div className="bkp-tags">
              {libro.categorias.map(cat => (
                <span key={cat} className="bkp-tag bkp-tag-cat">
                  <span className="dot" style={{ background: CAT_COLOR[cat] || '#cf8a6e' }} />{cat}
                </span>
              ))}
            </div>
          )}
          {libro.moods?.length > 0 && (
            <>
              <div className="bkp-tags-label">Mood</div>
              <div className="bkp-tags">
                {libro.moods.map(m => <span key={m} className="bkp-tag bkp-tag-mood">{m}</span>)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Frases más subrayadas */}
      {topQuotes.length > 0 && (
        <div className="bkp-sec">
          <h3 className="bkp-sec-title">Frases más subrayadas</h3>
          {topQuotes.map((q, i) => (
            <blockquote key={i} className="bkp-quote">
              «{q.texto}»{q.count > 1 && <span className="bkp-quote-count">×{q.count}</span>}
            </blockquote>
          ))}
        </div>
      )}

      {/* Reseñas */}
      <div className="bkp-sec">
        <div className="bkp-sec-head">
          <h3 className="bkp-sec-title" style={{ marginBottom: 0 }}>Reseñas</h3>
          {yaLeido && !modoForm && (
            <button className="bkp-resena-btn" onClick={() => setModoForm(true)}>
              {miResena ? 'Editar mi reseña' : '+ Añadir reseña'}
            </button>
          )}
        </div>

        {modoForm && (
          <div className="bkp-form">
            <Estrellas valor={form.rating} size={22} onChange={r => setForm(f => ({ ...f, rating: r }))} />
            <textarea className="bkp-textarea" rows={4} placeholder="Escribe tu reseña (opcional)…"
              maxLength={1000} value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} />
            <div className="bkp-form-btns">
              <button className="bkp-form-save" onClick={submitResena} disabled={!form.rating || enviando}>
                {enviando ? 'Guardando…' : 'Guardar'}
              </button>
              <button className="bkp-form-cancel" onClick={() => setModoForm(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="bkp-empty">Cargando…</p>
        ) : resenas.length === 0 ? (
          <p className="bkp-empty">Aún no hay reseñas.</p>
        ) : (
          resenas.map(r => (
            <div key={r.id} className={clsx('bkp-resena', r.user_id === user.id && 'bkp-resena-mia')}>
              <div className="bkp-resena-head">
                <Estrellas valor={r.rating} size={13} />
                <span className="bkp-resena-autor">{r.perfiles?.nombre || 'Lector'}</span>
              </div>
              {r.texto && <p className="bkp-resena-texto">{r.texto}</p>}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

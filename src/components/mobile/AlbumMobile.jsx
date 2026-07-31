// src/components/mobile/AlbumMobile.jsx
import { useState, useEffect, useRef } from 'react'
import { useAlbum, formatSeg } from '../../hooks/useAlbum.js'
import '../../styles/album.css'
import '../../styles/album.mobile.css'

const SEC_META = {
  personajes:  { label: 'Personajes',  color: 'var(--rojo)' },
  lugares:     { label: 'Lugares',     color: 'var(--verde)' },
  capitulos:   { label: 'Capítulos',   color: 'var(--azul)' },
  infografias: { label: 'Infografías', color: 'var(--oro)' },
}
const ORDER_FICCION    = ['personajes', 'lugares', 'capitulos']
const ORDER_NOFICCION  = ['infografias']

// Solo las primeras 3 posiciones (las que se ven en pantalla) exigen el
// gesto de "pegar"; más allá de eso, se consideran ya pegadas — ahí no hay
// casillero propio donde clickear.
const visiblePegada = (it, i) => it.unlocked && it.url && (i >= 3 || it.pegada)

const ISearch = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>)
const IBack   = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>)
const IPlay   = ({ s = 14 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>)
const IPause  = ({ s = 14 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>)
const ISlot   = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15l4-4 3 3 4-5 7 7" /><circle cx="8.5" cy="9" r="1.4" /></svg>)
const IStick  = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v4M15 3v4M4 8h16M6 8v11a2 2 0 002 2h8a2 2 0 002-2V8" /><path d="M9.5 13.5l2 2 3-3.5" /></svg>)
const IInvest = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>)
const IForo   = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>)
const ILeer   = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.25C10.83 5.48 9.25 5 7.5 5S4.17 5.48 3 6.25v13C4.17 18.48 5.75 18 7.5 18s3.33.48 4.5 1.25m0-13C13.17 5.48 14.75 5 16.5 5S19.83 5.48 21 6.25v13C19.83 18.48 18.25 18 16.5 18s-3.33.48-4.5 1.25m0-13v13" /></svg>)
const IRotate = () => (<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.5" /><path d="M9 18h6" /></svg>)

function Cell({ item, color, idx, hero, onOpen, pegarMode, onPegar }) {
  const [pegando, setPegando] = useState(false)
  const num = String(idx + 1).padStart(2, '0')
  const cls = `cellL${hero ? ' hero' : ''}`

  if (!item || !item.unlocked) {
    return (
      <div className={`${cls} empty`}>
        <div className="eslot"><ISlot /><span>Pega tu barajita</span></div>
      </div>
    )
  }

  if (!item.pegada) {
    const handleClick = () => {
      if (!pegarMode || pegando) return
      setPegando(true)
      onPegar?.(item.key)
      setTimeout(() => setPegando(false), 500)
    }
    return (
      <div className={`${cls} pending${pegarMode ? ' armed' : ''}${pegando ? ' pegando' : ''}`} onClick={handleClick}>
        <div className="eslot pend"><IStick /><span>Para pegar</span></div>
      </div>
    )
  }

  return (
    <div className={`${cls}${pegando ? ' pegando' : ''}`} style={{ '--c': color }} title={item.name || ''} onClick={onOpen}>
      {item.url
        ? <img src={item.url} alt={item.name || ''} loading="lazy" />
        : <div className="fill">{(item.name || '?').charAt(0)}</div>}
      <div className="cvig" />
      <div className="foil" />
      <div className="cbadge">{num}</div>
      {item.name && <div className="cname">{item.name}</div>}
    </div>
  )
}

function Catrow({ kind, data, onMore, onOpen, pegarMode, onPegar }) {
  const meta = SEC_META[kind]
  const { total = 0, unlocked = 0, items = [] } = data || {}
  const slots = items.length ? items.slice(0, 3) : [{ unlocked: false }]
  const filteredItems = items.filter(visiblePegada)
  return (
    <div className="catrow">
      <div className="clabelL">
        <span className="dot" style={{ '--c': meta.color }} />
        <h3>{meta.label}</h3>
        <span className="count">{unlocked} de {total}</span>
        <span className="bar" />
      </div>
      <div className="stripL">
        {slots.map((it, i) => {
          const fi = visiblePegada(it, i) ? filteredItems.indexOf(it) : -1
          return (
            <Cell key={i} item={it} color={meta.color} idx={i} hero={i === 0}
              onOpen={fi >= 0 ? () => onOpen(kind, fi) : undefined}
              pegarMode={pegarMode} onPegar={(itemKey) => onPegar(kind, itemKey)} />
          )
        })}
        {total > 3 && (
          <div className="moreL" onClick={() => onMore(kind)}>
            <span className="dots">•••</span><span className="mlab">Ver todas</span><span className="mnum">{total}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Music({ url }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const disabled = !url
  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play().catch(() => {}); setPlaying(true) }
  }
  return (
    <div className={`musicL${playing ? ' playing' : ''}${disabled ? ' disabled' : ''}`}
      onClick={disabled ? undefined : toggle}
      title={disabled ? 'Sin banda sonora' : (playing ? 'Pausar' : 'Escuchar preview')}>
      {url && <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} preload="none" />}
      <span className="play">{playing ? <IPause /> : <IPlay />}</span>
      <span className="mt">
        <span className="mlab">Banda sonora</span>
        <span className="mname">{disabled ? 'Sin preview disponible' : (playing ? 'Reproduciendo…' : 'Preview musical')}</span>
      </span>
      <span className="waveL">{Array.from({ length: 9 }).map((_, i) => (
        <i key={i} style={{ animationDelay: `${(-i * 0.13).toFixed(2)}s`, animationDuration: `${(0.9 + ((i * 7) % 5) * 0.12).toFixed(2)}s` }} />
      ))}</span>
    </div>
  )
}

function SearchBar({ items, onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const term = q.trim().toLowerCase()
  const hits = term
    ? items.map((e, i) => ({ e, i })).filter(({ e }) =>
        e.libro.title.toLowerCase().includes(term) || (e.libro.author || '').toLowerCase().includes(term))
    : []
  return (
    <>
      <div className="searchL">
        <ISearch />
        <input type="text" value={q} autoComplete="off" placeholder="Buscar un libro…"
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)} />
      </div>
      <div className={`resultsL${open && term ? ' show' : ''}`}>
        {hits.length === 0
          ? <div className="noresL">Sin coincidencias</div>
          : hits.map(({ e, i }) => (
            <div key={e.libro.libro_id ?? i} className="resL" onMouseDown={() => { onPick(i); setQ(''); setOpen(false) }}>
              <img src={e.libro.cover || ''} alt="" style={{ background: e.libro._baseColor || '#F2792A' }} />
              <div><div className="rt">{e.libro.title}</div><div className="ra">{e.libro.author}</div></div>
            </div>
          ))}
      </div>
    </>
  )
}

// ── carrusel fullscreen de barajitas ──
function Carousel({ open, kind, startIdx, entry, onClose }) {
  const [cidx, setCidx] = useState(0)
  const lenRef = useRef(0)

  const meta = open && kind ? SEC_META[kind] : null
  const data = (open && kind) ? (entry?.secciones?.[kind] || {}) : {}
  const cells = (data.items || []).filter(visiblePegada)
  lenRef.current = cells.length

  useEffect(() => {
    if (open) setCidx(startIdx ?? 0)
  }, [open, startIdx, kind])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft')  setCidx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setCidx(i => Math.min(lenRef.current - 1, i + 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !kind || !cells.length) return null

  const safe = Math.min(Math.max(0, cidx), cells.length - 1)
  const item = cells[safe]

  return (
    <div className="carouselL" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="carouselL-inner">
        <div className="carouselL-head">
          <span className="dot" style={{ '--c': meta.color }} />
          <h3>{meta.label}</h3>
          <span className="clcount">{safe + 1} de {cells.length}</span>
          <button className="carouselL-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="carouselL-stage">
          <img src={item.url} alt={item.name || ''} />
        </div>
        {item.name && <p className="carouselL-name">{item.name}</p>}
        <div className="carouselL-nav">
          <button className="carouselL-btn" disabled={safe === 0} onClick={() => setCidx(i => i - 1)}>‹</button>
          <span className="carouselL-pos">{safe + 1} / {cells.length}</span>
          <button className="carouselL-btn" disabled={safe === cells.length - 1} onClick={() => setCidx(i => i + 1)}>›</button>
        </div>
      </div>
    </div>
  )
}

const KEY = 'inmersia-album-m-page'

export default function AlbumMobile({ user, gatoColor = 'negro', onOpenBook, onGoBack, onGoForo, onGoInvestigacion }) {
  const { items, loading, pegar } = useAlbum(user)
  const [idx, setIdx] = useState(0)
  const [sheet, setSheet] = useState(null) // { kind, idx } | null
  const [gatoMenuOpen, setGatoMenuOpen] = useState(false)
  const [pegarMode, setPegarMode] = useState(false)

  useEffect(() => {
    if (!items.length) return
    const saved = parseInt(localStorage.getItem(KEY), 10)
    if (!isNaN(saved) && saved >= 0 && saved < items.length) setIdx(saved)
  }, [items.length])

  const go = (i) => {
    if (i < 0 || i >= items.length) return
    setIdx(i); setSheet(null); setPegarMode(false); setGatoMenuOpen(false)
    try { localStorage.setItem(KEY, String(i)) } catch { /* ignore */ }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT') return
      if (sheet) return // el carrusel maneja sus propias flechas
      if (e.key === 'Escape') setSheet(null)
      if (e.key === 'ArrowLeft')  go(idx - 1)
      if (e.key === 'ArrowRight') go(idx + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [idx, items.length, sheet])

  if (loading) {
    return (
      <div className="album-m-root"><div className="album-m-rotate" style={{ display: 'flex', position: 'static', flex: 1 }}>
        <h3>Abriendo el álbum…</h3></div></div>
    )
  }
  if (!items.length) {
    return (
      <div className="album-m-root"><div className="album-m-rotate" style={{ display: 'flex', position: 'static', flex: 1 }}>
        <h3>Tu álbum está vacío</h3>
        <p>Agregá libros a tu biblioteca y empezá a leer para coleccionar barajitas.</p>
        <button className="album-m-back" onClick={onGoBack}>Ir a la biblioteca</button>
      </div></div>
    )
  }

  const safe = Math.min(idx, items.length - 1)
  const entry = items[safe]
  const { libro, pct, stats, secciones, previewAudio } = entry
  const order = libro.es_ficcion === false ? ORDER_NOFICCION : ORDER_FICCION
  const rows = [
    { k: 'Tiempo total',     v: formatSeg(stats.totalSeg) || '—' },
    { k: 'Veces abierto',    v: stats.vecesAbierto ? `${stats.vecesAbierto} ×` : '—' },
    { k: 'Sesión más larga', v: formatSeg(stats.sesionMasLargaSeg) || '—' },
    { k: 'Notas tomadas',    v: stats.notas ? `${stats.notas}` : '—' },
  ]

  // Pendientes de pegar, solo entre las primeras 3 posiciones visibles por sección.
  const pendientesVisibles = order.reduce((n, kind) => {
    const secItems = secciones[kind]?.items || []
    return n + secItems.slice(0, 3).filter(it => it.unlocked && !it.pegada).length
  }, 0)

  const onPegar = (kind, itemKey) => pegar(libro.libro_id, kind, itemKey)

  return (
    <div className="album-m-root">
      <button type="button" className="album-m-gato-wrap" aria-label="Pegar barajitas"
        onClick={() => setGatoMenuOpen(o => !o)}>
        <img className="album-m-gato" src={`/assets/biblioteca/gato-${gatoColor}-1-thumb.webp`} alt="" />
        {pendientesVisibles > 0 && <span className="album-m-gato-badge" />}
      </button>

      {gatoMenuOpen && (
        <>
          <div className="album-m-gatomenu-backdrop" onClick={() => setGatoMenuOpen(false)} />
          <div className="album-m-gatomenu">
            <p className="album-m-gatomenu-title">Álbum</p>
            <button type="button" className="album-m-gatomenu-item" disabled={!pendientesVisibles}
              onClick={() => { setPegarMode(true); setGatoMenuOpen(false) }}>
              Pegar barajitas{pendientesVisibles > 0 ? ` (${pendientesVisibles})` : ''}
            </button>
          </div>
        </>
      )}

      {pegarMode && (
        <div className="album-m-pegarhint" onClick={() => setPegarMode(false)}>
          Tocá una casilla para pegarla · <b>listo</b>
        </div>
      )}

      <div className="album-m-rotate">
        <button className="album-m-rotate-back" onClick={onGoBack} title="Volver a la biblioteca"><IBack />Biblioteca</button>
        <IRotate />
        <h3>Girá el teléfono</h3>
        <p>El álbum se abre como una doble página. Poné el teléfono en horizontal para verlo completo.</p>
      </div>

      <div className="album-m-top">
        <button className="album-m-back" onClick={onGoBack} title="Volver a la biblioteca"><IBack />Biblioteca</button>
        <SearchBar items={items} onPick={go} />
        <div className="miniPager">
          <button className="mp arrow" disabled={safe === 0} onClick={() => go(safe - 1)}>‹</button>
          <span className="mpPos">{safe + 1} / {items.length}</span>
          <button className="mp arrow" disabled={safe === items.length - 1} onClick={() => go(safe + 1)}>›</button>
        </div>
      </div>

      <div className="spreadL">
        <section className="pageL left">
          <div className="bhL">
            <p className="kick">Álbum · tu colección</p>
            <h2>{libro.title}</h2>
            <p className="author">{libro.author}</p>
          </div>

          <div className="leftbodyL">
            <div className="placaL">
              <div className="placaL-frame">
                <div className="placaL-art">
                  {libro.cover
                    ? <img src={libro.cover} alt="" />
                    : <div style={{ position: 'absolute', inset: 0, background: libro._baseColor || '#F2792A' }} />}
                  <div className="vig" />
                </div>
              </div>
            </div>

            <div className="statsL">
              <p className="sed">Inmersia · Edición de lectura</p>
              <div className="sprog">
                <div className="lab"><span className="k">Progreso</span><span className="v">{libro.leido ? 'Leído' : `${Math.round(pct)}%`}</span></div>
                <div className="strack"><div className="sfill" style={{ width: `${libro.leido ? 100 : pct}%` }} /></div>
              </div>
              <div className="sgrid">
                {rows.map(r => (
                  <div key={r.k}><span className="sv">{r.v}</span><span className="sk">{r.k}</span></div>
                ))}
              </div>
            </div>
          </div>

          <Music url={previewAudio} />

          <div className="accessL">
            <a className="accL" data-c="investigacion" onClick={() => onGoInvestigacion(libro)}>
              <span className="aic"><IInvest /></span><span className="alab">Investig.</span>
            </a>
            <a className="accL" data-c="foro" onClick={() => onGoForo(libro)}>
              <span className="aic"><IForo /></span><span className="alab">Foro</span>
            </a>
            <a className="accL" data-c="leer" onClick={() => onOpenBook(libro)}>
              <span className="aic"><ILeer /></span><span className="alab">Leer</span>
            </a>
          </div>
        </section>

        <section className="pageL right">
          {order.map(kind => (
            <Catrow key={kind} kind={kind} data={secciones[kind]}
              onMore={(k) => setSheet({ kind: k, idx: 0 })}
              onOpen={(k, i) => setSheet({ kind: k, idx: i })}
              pegarMode={pegarMode} onPegar={onPegar} />
          ))}
        </section>
      </div>

      <Carousel
        open={!!sheet}
        kind={sheet?.kind}
        startIdx={sheet?.idx ?? 0}
        entry={entry}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}

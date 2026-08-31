// Álbum de barajitas — orquestador desktop.
// Ruta: /album · Accesible desde Biblioteca.
import { useState, useMemo, useEffect, useRef } from 'react'
import { useAlbum } from '../hooks/useAlbum.js'
import { useOnboarding } from '../context/onboarding.jsx'
import LeftPage  from './album/LeftPage.jsx'
import RightPage from './album/RightPage.jsx'
import BookTabs  from './album/BookTabs.jsx'
import Bandeja   from './album/Bandeja.jsx'
import TutorialHint from './onboarding/TutorialHint.jsx'
import TutorialCartel from './onboarding/TutorialCartel.jsx'
import { TEXTO_ALBUM, CARTEL_BIBLIOTECA } from './onboarding/textos.js'
import '../styles/album.css'

function LoadingScreen() {
  return (
    <div className="album-loading">
      <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2.5, borderColor: 'rgba(242,121,42,0.28)', borderTopColor: '#F2792A' }} />
      <p>Abriendo el álbum…</p>
    </div>
  )
}

function EmptyScreen({ onGoBack }) {
  return (
    <div className="album-empty">
      <h2>Tu álbum está vacío</h2>
      <p>Agrega libros a tu biblioteca y empieza a leer para coleccionar barajitas.</p>
      <button onClick={onGoBack} className="btn-wood">Ir a la biblioteca</button>
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
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}
      onBlur={(ev) => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOpen(false) }}>
      <div className="album-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>
        <input type="text" value={q} autoComplete="off"
          placeholder="Buscar un libro de tu álbum…"
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)} />
      </div>
      {open && term && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 40,
          background: '#fffdf8', border: '2.5px solid #4a3622', borderRadius: 16,
          boxShadow: '0 22px 48px rgba(74,54,34,.22), 3px 5px 0 rgba(74,54,34,.16)', overflow: 'hidden' }}>
          {hits.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', fontWeight: 600, color: '#6b4f34' }}>Sin coincidencias en tu álbum</div>
          ) : hits.map(({ e, i }) => (
            <button key={e.libro.libro_id} onMouseDown={() => { onPick(i); setQ(''); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
                padding: '10px 14px', border: 'none', borderBottom: '1.5px solid #efe7d4', background: 'transparent', cursor: 'pointer' }}>
              <span style={{ width: 34, height: 48, flex: 'none', borderRadius: 4, overflow: 'hidden', border: '2px solid #4a3622', background: e.libro._baseColor || '#F2792A' }}>
                {e.libro.cover && <img src={e.libro.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </span>
              <span>
                <span style={{ display: 'block', fontFamily: "'Baloo 2', system-ui, sans-serif", fontWeight: 700, fontSize: 17, lineHeight: 1.05, color: '#4a3622' }}>{e.libro.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#6b4f34' }}>{e.libro.author}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Album({ user, gatoColor = 'negro', onOpenBook, onGoBack, onGoForo, onGoInvestigacion }) {
  const { items, loading, pegar } = useAlbum(user)
  const [currentIdx, setCurrentIdx] = useState(0)

  const safeIdx = useMemo(() => Math.min(currentIdx, Math.max(0, items.length - 1)), [currentIdx, items.length])

  // ── Onboarding (paso 'album'): basta con ENTRAR al Álbum para cerrar el paso.
  // Antes hacía falta pegar la última barajita del Manual; si el usuario volvía
  // a la Biblioteca sin pegarla, el paso seguía en 'album' y la pista "Ir al
  // Álbum" reaparecía cada vez → loop infinito. Ahora se avanza en el montaje,
  // una sola vez (introLanzadaRef), y se muestra la bienvenida del Álbum. ──
  const onboarding = useOnboarding()
  const tutorialAlbum = onboarding.active && onboarding.step === 'album'
  const [showAlbumIntro, setShowAlbumIntro] = useState(false)
  // Al cerrar la bienvenida el paso ya está en 'tienda_final', y ese hint vive
  // en la Biblioteca: sin este cartel el usuario se queda acá sin saber que
  // tiene que volver. Mismo tratamiento que el "ve a Hechos" de la Cartelera.
  const [cartelBiblioteca, setCartelBiblioteca] = useState(false)
  const introLanzadaRef = useRef(false)
  useEffect(() => {
    if (!tutorialAlbum || loading || introLanzadaRef.current) return
    introLanzadaRef.current = true
    setShowAlbumIntro(true)
    onboarding.advance('album')   // album → tienda_final
  }, [tutorialAlbum, loading, onboarding])

  if (loading)       return <LoadingScreen />
  if (!items.length) return <EmptyScreen onGoBack={onGoBack} />

  const entry = items[safeIdx]
  const onPegar = (seccion, itemKey) => pegar(entry.libro.libro_id, seccion, itemKey)

  return (
    <div className="album-root">
      <img className="album-gato" src={`/assets/biblioteca/gato-${gatoColor}-1.webp`} alt="" />

      <div className="album-topbar">
        <button onClick={onGoBack} className="album-back" title="Volver a la biblioteca">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Biblioteca
        </button>
        <SearchBar items={items} onPick={setCurrentIdx} />
      </div>

      <div className="album-layout">
        <div className="album-shell">
          <div className="album-spread">
            <LeftPage entry={entry} onOpenBook={onOpenBook} onGoForo={onGoForo} onGoInvestigacion={onGoInvestigacion} onPegar={onPegar} />
            <RightPage entry={entry} onPegar={onPegar} />
          </div>

          {items.length > 1 && (
            <BookTabs items={items} current={safeIdx} onSelect={setCurrentIdx} />
          )}

          <p className="album-hint">
            Cada libro de tu biblioteca abre su propia doble página · sigue leyendo para desbloquear más <b>barajitas</b>
          </p>
        </div>

        <Bandeja entry={entry} />
      </div>

      {showAlbumIntro && (
        <TutorialHint
          logo
          title={TEXTO_ALBUM.title}
          body={TEXTO_ALBUM.body}
          buttonLabel={TEXTO_ALBUM.buttonLabel}
          onClose={() => { setShowAlbumIntro(false); setCartelBiblioteca(true) }}
        />
      )}

      {cartelBiblioteca && (
        <TutorialCartel
          emoji={CARTEL_BIBLIOTECA.emoji}
          title={CARTEL_BIBLIOTECA.title}
          body={CARTEL_BIBLIOTECA.body}
          onClose={() => setCartelBiblioteca(false)}
        />
      )}
    </div>
  )
}

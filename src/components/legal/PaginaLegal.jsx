// src/components/legal/PaginaLegal.jsx
// ─────────────────────────────────────────────────────────────
// Los documentos legales como páginas públicas con dirección propia:
//   /privacidad · /terminos · /impressum
// Dentro de la app se siguen abriendo en <LegalModal>; estas páginas existen
// porque fuera de ella hacen falta enlaces que se puedan visitar: Google los
// exige para publicar "Continuar con Google" (Google Auth Platform → Marca), y
// el Impressum alemán tiene que estar a un enlace de distancia.
// Mismo contenido (Documentation/*.md) y mismo intérprete que el modal.
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DOCS, Doc } from './LegalModal.jsx'

const INK = '#4a3622'
const ACCENT = '#F2792A'
const RUTA = { privacidad: '/privacidad', terminos: '/terminos', impressum: '/impressum' }

export default function PaginaLegal({ doc }) {
  const navigate = useNavigate()
  const actual = DOCS[doc] ? doc : 'privacidad'

  useEffect(() => {
    const antes = document.title
    document.title = `${DOCS[actual].label} · Inmersia`
    window.scrollTo(0, 0)
    return () => { document.title = antes }
  }, [actual])

  return (
    <div style={{ minHeight: '100vh', background: '#fbf5ec', color: INK, fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
      <header style={{ borderBottom: `1px solid ${INK}22`, background: '#fbf5ec' }}>
        <div style={{ width: 'min(760px, 100% - 32px)', margin: '0 auto', padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link to="/" aria-label="Inmersia, inicio"><img src="/assets/inmersia-logo.png?v=4" alt="Inmersia" style={{ height: 44, width: 'auto', display: 'block' }} /></Link>
          <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {Object.entries(DOCS).map(([key, { label }]) => (
              <Link key={key} to={RUTA[key]} style={{
                background: actual === key ? ACCENT : '#f1e8d4', color: actual === key ? '#fff' : '#5a4632',
                border: `2px solid ${INK}`, borderRadius: 12, padding: '6px 10px', fontWeight: 700, fontSize: 13, textDecoration: 'none',
              }}>{label}</Link>
            ))}
          </nav>
        </div>
      </header>
      <main style={{ width: 'min(760px, 100% - 32px)', margin: '0 auto', padding: '28px 0 64px' }}>
        <div style={{ background: '#fffdf8', border: `2px solid ${INK}`, borderRadius: 20, padding: 'clamp(18px, 4vw, 34px)', boxShadow: `3px 6px 0 ${INK}22` }}>
          <Doc raw={DOCS[actual].raw} onNavigate={(k) => navigate(RUTA[k])} />
        </div>
      </main>
    </div>
  )
}

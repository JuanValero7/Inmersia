// src/components/PaginaSobre.jsx
// ─────────────────────────────────────────────────────────────
// /sobre — "Sobre Inmersia": qué es, quién está detrás, cómo se hace cada libro
// y contacto. Pública, sin cuenta. Existe sobre todo para que una persona (o el
// verificador del programa de startups de Google) pueda comprobar que detrás
// del producto hay un equipo real.
// Mismo marco visual que PaginaLegal. Los textos viven en src/content/sobre.js,
// que también usa scripts/generar-seo.mjs para el HTML estático.
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SOBRE } from '../content/sobre.js'

const INK = '#4a3622'
const ACCENT = '#F2792A'

const h2 = { fontSize: 19, fontWeight: 800, margin: '30px 0 10px' }
const p = { margin: '0 0 12px' }

export default function PaginaSobre() {
  const { fundador, proceso, modelo, contacto, english } = SOBRE

  useEffect(() => {
    const antes = document.title
    document.title = `${SOBRE.titulo} · Inmersia`
    window.scrollTo(0, 0)
    return () => { document.title = antes }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#fbf5ec', color: INK, fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
      <header style={{ borderBottom: `1px solid ${INK}22`, background: '#fbf5ec' }}>
        <div style={{ width: 'min(760px, 100% - 32px)', margin: '0 auto', padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link to="/" aria-label="Inmersia, inicio"><img src="/assets/inmersia-logo.png?v=4" alt="Inmersia" style={{ height: 44, width: 'auto', display: 'block' }} /></Link>
          <Link to="/" style={{
            background: ACCENT, color: '#fff', border: `2px solid ${INK}`, borderRadius: 12,
            padding: '6px 12px', fontWeight: 700, fontSize: 13, textDecoration: 'none',
          }}>Ir a Inmersia</Link>
        </div>
      </header>

      <main style={{ width: 'min(760px, 100% - 32px)', margin: '0 auto', padding: '28px 0 64px' }}>
        <article style={{ background: '#fffdf8', border: `2px solid ${INK}`, borderRadius: 20, padding: 'clamp(18px, 4vw, 34px)', boxShadow: `3px 6px 0 ${INK}22`, fontSize: 15.5, lineHeight: 1.65 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 12px' }}>{SOBRE.titulo}</h1>
          {SOBRE.intro.map((t, i) => <p key={i} style={p}>{t}</p>)}

          <h2 style={h2}>{fundador.titulo}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
            <img src={fundador.foto} alt={fundador.fotoAlt} width="720" height="769" loading="lazy" style={{
              width: 'min(240px, 100%)', height: 'auto', borderRadius: 16, border: `2px solid ${INK}`,
              boxShadow: `3px 5px 0 ${INK}22`, flex: '0 0 auto',
            }} />
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 800 }}>{fundador.nombre}</p>
              <p style={{ margin: '0 0 10px', color: ACCENT, fontWeight: 700 }}>{fundador.cargo}</p>
              {fundador.bio.map((t, i) => <p key={i} style={p}>{t}</p>)}
              <p style={{ ...p, fontStyle: 'italic', opacity: 0.8 }}>{fundador.credito}</p>
            </div>
          </div>

          <h2 style={h2}>{proceso.titulo}</h2>
          <p style={p}>{proceso.intro}</p>
          <ol style={{ margin: '6px 0 14px', paddingLeft: 22, listStyle: 'decimal' }}>
            {proceso.pasos.map((paso) => (
              <li key={paso.titulo} style={{ marginBottom: 8 }}>
                <strong>{paso.titulo}.</strong> {paso.texto}
              </li>
            ))}
          </ol>
          <p style={p}>{proceso.cierre}</p>

          <h2 style={h2}>{modelo.titulo}</h2>
          <p style={p}>{modelo.texto}</p>

          <h2 style={h2}>{contacto.titulo}</h2>
          <ul style={{ margin: '0 0 12px', paddingLeft: 22, listStyle: 'disc' }}>
            <li style={{ marginBottom: 4 }}>
              Correo: <a href={`mailto:${contacto.email}`} style={{ color: ACCENT, fontWeight: 700 }}>{contacto.email}</a>
            </li>
            {contacto.enlaces.map((e) => (
              <li key={e.href} style={{ marginBottom: 4 }}>
                {e.label}: <a href={e.href} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, fontWeight: 700 }}>{e.texto}</a>
              </li>
            ))}
          </ul>

          <section lang="en" style={{ marginTop: 30, paddingTop: 18, borderTop: `1.5px solid ${INK}22` }}>
            <h2 style={{ ...h2, marginTop: 0 }}>{english.titulo}</h2>
            {english.parrafos.map((t, i) => <p key={i} style={p}>{t}</p>)}
          </section>
        </article>

        <nav aria-label="Legal" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 22, fontSize: 13.5 }}>
          <Link to="/terminos" style={{ color: INK }}>Términos y Condiciones</Link>
          <Link to="/privacidad" style={{ color: INK }}>Política de Privacidad</Link>
          <Link to="/impressum" style={{ color: INK }}>Impressum</Link>
        </nav>
      </main>
    </div>
  )
}

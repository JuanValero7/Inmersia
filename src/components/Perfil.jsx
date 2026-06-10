// =============================================================
// INMERSIA — Vista Perfil (Carnet de socio)
// Va en:  src/components/perfil.jsx
//
// Mismo contrato que el componente anterior:
//   props: { user, onGoBack, onSignOut }
//   - Carga nombre/apellido desde la tabla `perfiles`.
//   - "Datos": lectura fija + botón Editar → guarda en `perfiles`.
//   - El correo es el identificador de acceso: NO se puede editar.
//   - "Seguridad": cambia la contraseña (supabase.auth.updateUser).
//   - "Transacciones" e "Historial": vistas preparadas (aún NO
//      conectadas a Supabase — datos de ejemplo, listas para
//      cablear cuando definas qué va).
//
// La barra lateral cambia de color acuarela según la sección.
// =============================================================

import React, { useState, useMemo } from 'react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase.js'
import { usePerfilData } from '../hooks/usePerfilData.js'
import '../styles/perfil.css'

// ── Color de barra por sección (acuarela derivada de la paleta) ──
export const SEC_COLOR = { datos: '#86ad9e', seguridad: '#7d8db5', transac: '#d9a05a', historial: '#cf8ea4' }

function tint(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt)
  const mix = c => Math.round((t - c) * p + c)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}
export function washBg(base) {
  return [
    `radial-gradient(58% 52% at 18% 12%, ${tint(base, 0.32)}, transparent 60%)`,
    `radial-gradient(56% 60% at 86% 70%, ${tint(base, -0.24)}, transparent 62%)`,
    `radial-gradient(44% 42% at 60% 42%, ${tint(base, 0.16)}, transparent 58%)`,
    `radial-gradient(40% 36% at 26% 84%, ${tint(base, -0.12)}, transparent 60%)`,
    `linear-gradient(158deg, ${tint(base, 0.16)} 0%, ${base} 46%, ${tint(base, -0.18)} 100%)`,
  ].join(', ')
}

// ── Iconos ────────────────────────────────────────────────────
export const I = {
  datos:     <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.5 16c.6-1.6 2-2.4 3-2.4s2.4.8 3 2.4M14 10h5M14 14h3" strokeLinecap="round"/></svg>,
  seguridad: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><path d="M12 2.5l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11v-6l8-3z" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  transac:   <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19" strokeLinecap="round"/><path d="M6 15h4" strokeLinecap="round"/></svg>,
  historial: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  lock:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round"/></svg>,
  cam:       <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l1.5-2.2h7L17 6h4a2 2 0 012 2z" strokeLinejoin="round"/><circle cx="12" cy="13" r="3.6"/></svg>,
  edit:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 00-3-3L5 17v3z" strokeLinejoin="round"/><path d="M13.5 6.5l3 3" strokeLinecap="round"/></svg>,
  logout:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round"/><polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round"/></svg>,
  receipt:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3v18l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4V3l-2 1.4L15 3l-2 1.4L11 3 9 4.4 7 3 5 4.4z" strokeLinejoin="round"/><path d="M9 9h6M9 13h6" strokeLinecap="round"/></svg>,
}

export const NAV = [
  { id: 'datos',     label: 'Datos',         icon: I.datos },
  { id: 'seguridad', label: 'Seguridad',     icon: I.seguridad },
  { id: 'transac',   label: 'Transacciones', icon: I.transac },
  { id: 'historial', label: 'Historial',     icon: I.historial },
]
export const TITLES = { datos: 'Datos de perfil', seguridad: 'Seguridad', transac: 'Transacciones', historial: 'Historial de lectura' }

// Datos de ejemplo — SOLO para previsualizar el layout. Reemplazar
// por queries reales cuando definas las tablas de transacciones/historial.
const TXN_DEMO = [
  { id: 1, desc: 'Plan Lector · mensual', fecha: '15 may 2025', monto: '$5.99' },
  { id: 2, desc: 'Plan Lector · mensual', fecha: '15 abr 2025', monto: '$5.99' },
  { id: 3, desc: 'El nombre del viento', sub: 'Compra individual', fecha: '2 abr 2025', monto: '$8.50' },
  { id: 4, desc: 'Plan Lector · mensual', fecha: '15 mar 2025', monto: '$5.99' },
]
const HIST_DEMO = [
  { id: 1, title: 'El nombre del viento', author: 'Patrick Rothfuss', fecha: '12 may 2025', pages: 662, color: '#d56a52' },
  { id: 2, title: 'La sombra del viento', author: 'Carlos Ruiz Zafón',  fecha: '3 mar 2025',  pages: 544, color: '#7d8db5' },
  { id: 3, title: 'Dune',                 author: 'Frank Herbert',       fecha: '11 ene 2025', pages: 688, color: '#e0b256' },
  { id: 4, title: 'Ficciones',            author: 'Jorge Luis Borges',   fecha: '20 oct 2024', pages: 256, color: '#86ad9e' },
]

// ════════════════════ Sección: Datos ════════════════════════
export function SecDatos({ nombre, apellido, email, miembroDesde, cargando, onSave }) {
  const [editing, setEditing] = useState(false)
  const [dN, setDN] = useState(nombre)
  const [dA, setDA] = useState(apellido)
  const [saving, setSaving] = useState(false)
  const [fb, setFb] = useState(null)

  function start() { setDN(nombre); setDA(apellido); setFb(null); setEditing(true) }

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setFb(null)
    const err = await onSave({ nombre: dN.trim(), apellido: dA.trim() })
    setSaving(false)
    if (err) { setFb({ t: 'err', m: 'No se pudo guardar: ' + err }); return }
    setEditing(false); setFb({ t: 'ok', m: 'Datos guardados ✓' })
    setTimeout(() => setFb(null), 2600)
  }

  if (editing) {
    return (
      <form onSubmit={submit} style={{ maxWidth: 520 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
          <div><label className="pf-field-label">Nombre</label>
            <input className="pf-input" value={dN} onChange={e => setDN(e.target.value)} maxLength={40} autoFocus/></div>
          <div><label className="pf-field-label">Apellido</label>
            <input className="pf-input" value={dA} onChange={e => setDA(e.target.value)} maxLength={40}/></div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label className="pf-field-label">Correo electrónico</label>
          <input className="pf-input" value={email} disabled/>
          <div className="pf-lock-note">{I.lock} El correo no se puede modificar.</div>
        </div>
        {fb && <div className={fb.t === 'ok' ? 'pf-ok' : 'pf-err'} style={{ marginBottom: 14 }}>{fb.m}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="submit" className="pf-btn pf-btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          <button type="button" className="pf-btn pf-btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
        </div>
      </form>
    )
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 14 }}>
        <div className="pf-lead">Tu información personal en Inmersia.</div>
        <button className="pf-btn pf-btn-ghost" onClick={start} disabled={cargando}>{I.edit} Editar</button>
      </div>
      <div className="pf-field-row">
        <label className="pf-field-label">Nombre</label>
        <div className="pf-field-val">{cargando ? '…' : (nombre || '—')}</div>
      </div>
      <div className="pf-field-row">
        <label className="pf-field-label">Apellido</label>
        <div className="pf-field-val">{cargando ? '…' : (apellido || '—')}</div>
      </div>
      {miembroDesde && (
        <div className="pf-field-row">
          <label className="pf-field-label">Miembro desde</label>
          <div className="pf-field-val">{miembroDesde}</div>
        </div>
      )}
      <div className="pf-field-row">
        <label className="pf-field-label">Correo electrónico</label>
        <div className="pf-field-locked">
          <span className="pf-field-val">{email}</span>
          <span style={{ color: 'var(--muted)' }} title="No editable">{I.lock}</span>
        </div>
        <div className="pf-lock-note">El correo es tu identificador de acceso y no se puede modificar.</div>
      </div>
      {fb && <div className={fb.t === 'ok' ? 'pf-ok' : 'pf-err'} style={{ marginTop: 14 }}>{fb.m}</div>}
    </div>
  )
}

// ════════════════════ Sección: Seguridad ════════════════════
export function SecSeguridad() {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [saving, setSaving] = useState(false)
  const [fb, setFb] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (p1.length < 6) { setFb({ t: 'err', m: 'La nueva contraseña debe tener al menos 6 caracteres.' }); return }
    if (p1 !== p2) { setFb({ t: 'err', m: 'Las contraseñas no coinciden.' }); return }
    setSaving(true); setFb(null)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setSaving(false)
    if (error) { setFb({ t: 'err', m: 'Error: ' + error.message }); return }
    setFb({ t: 'ok', m: 'Contraseña actualizada ✓' }); setP1(''); setP2('')
    setTimeout(() => setFb(null), 2800)
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="pf-lead" style={{ marginBottom: 20 }}>Cambiá la contraseña con la que entrás a tu carnet.</div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label className="pf-field-label">Nueva contraseña</label>
          <input className="pf-input" type="password" value={p1} onChange={e => setP1(e.target.value)} placeholder="mínimo 6 caracteres" autoComplete="new-password"/></div>
        <div><label className="pf-field-label">Confirmar nueva contraseña</label>
          <input className="pf-input" type="password" value={p2} onChange={e => setP2(e.target.value)} placeholder="repetir contraseña" autoComplete="new-password"/></div>
        {fb && <div className={fb.t === 'ok' ? 'pf-ok' : 'pf-err'}>{fb.m}</div>}
        <div style={{ marginTop: 4 }}>
          <button type="submit" className="pf-btn pf-btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Actualizar contraseña'}</button>
        </div>
      </form>
    </div>
  )
}

// ════════════════════ Sección: Transacciones ════════════════
// TODO: conectar a Supabase cuando exista la tabla de pagos/plan.
export function SecTransac() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
        <div className="pf-lead">Tu plan y tus compras.</div>
        <span className="pf-preview-pill">{I.receipt} Vista previa · datos de ejemplo</span>
      </div>
      <div className="pf-plan" style={{ marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .82, textTransform: 'uppercase', letterSpacing: '.06em' }}>Plan actual</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>Plan Lector</div>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: .85, marginTop: 2 }}>Se renueva el 15 de junio</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>$5.99<span style={{ fontSize: 13, fontWeight: 600, opacity: .8 }}> /mes</span></div>
          <button className="pf-btn pf-btn-ghost" style={{ marginTop: 8 }}>Gestionar plan</button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '4px 2px 10px' }}>Movimientos recientes</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {TXN_DEMO.map(t => (
          <div key={t.id} className="pf-txn">
            <div className="pf-txn-icon">{I.receipt}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t.desc}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>{t.sub ? t.sub + ' · ' : ''}{t.fecha}</div>
            </div>
            <span className="pf-badge">Pagado</span>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', minWidth: 62, textAlign: 'right' }}>{t.monto}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════ Sección: Historial ════════════════════
// TODO: conectar a `progreso_lectura` (libros terminados del usuario).
export function SecHistorial() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
        <div className="pf-lead">Los libros que terminaste de leer.</div>
        <span className="pf-preview-pill">{I.historial} Vista previa · datos de ejemplo</span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {[['4', 'Libros terminados'], ['2.150', 'Páginas leídas'], ['18', 'Días de racha']].map(([n, l], i) => (
          <div key={i} className="pf-stat">
            <div className="pf-stat-n">{n}</div>
            <div className="pf-stat-l">{l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {HIST_DEMO.map(b => (
          <div key={b.id} className="pf-hist">
            <div className="pf-hist-spine" style={{ background: b.color }}></div>
            <div className="pf-hist-body">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.15 }}>{b.title}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>{b.author} · {b.pages} págs.</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className="pf-badge">✓ Terminado</span>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginTop: 5 }}>{b.fecha}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════ Componente principal ══════════════════
export default function Perfil({ user, onGoBack, onSignOut }) {
  // Lógica de datos compartida con PerfilMobile (ver src/hooks/usePerfilData.js)
  const {
    sec, setSec,
    nombre, apellido, cargando, avatarUrl,
    email, miembroDesde, inicial,
    guardarDatos, onPickAvatar,
  } = usePerfilData(user)

  const navBg = useMemo(() => washBg(SEC_COLOR[sec]), [sec])

  return (
    <div className="pf-page">
      {/* filtro de grano acuarela (compartido) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="pf-grain"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" stitchTiles="stitch" result="n"/>
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 1.05"/></filter>
      </svg>

      {/* topbar */}
      <div className="pf-topbar">
        <div className="pf-brand">
          <span className="pf-brand-title">Mi Carnet</span>
          <span className="pf-brand-sub">Socio de Inmersia</span>
        </div>
        <button className="pf-back" type="button" onClick={onGoBack}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4"><path d="M12 6.04A8.97 8.97 0 006 3.75c-1.05 0-2.06.18-3 .51v14.25A8.99 8.99 0 016 18c2.3 0 4.4.87 6 2.29m0-14.25a8.97 8.97 0 016-2.29c1.05 0 2.06.18 3 .51v14.25A8.99 8.99 0 0018 18a8.97 8.97 0 00-6 2.29m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Biblioteca
        </button>
      </div>

      {/* carnet */}
      <div className="pf-carnet">
        {/* identidad sobre la unión */}
        <div className="pf-identity">
          <div className="pf-avatar-ring">
            {avatarUrl
              ? <img className="pf-avatar-img" src={avatarUrl} alt="Foto de perfil"/>
              : <div className="pf-avatar-fallback">{inicial}</div>}
            <label className="pf-avatar-cam" title="Cambiar foto">
              <input type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }}/>
              {I.cam}
            </label>
          </div>
        </div>

        {/* página izquierda: navegación (color por sección) */}
        <nav className="pf-nav" style={{ background: navBg }}>
          <div className="pf-grain"></div>
          <div className="pf-vignette"></div>
          <div className="pf-nav-list">
            {NAV.map(n => (
              <button key={n.id} className={clsx('pf-nav-item', sec === n.id && 'is-active')} onClick={() => setSec(n.id)}>
                {n.icon}{n.label}
              </button>
            ))}
          </div>
          <div className="pf-nav-spacer"></div>
          <button className="pf-logout" onClick={onSignOut}>{I.logout} Cerrar sesión</button>
        </nav>

        {/* página derecha: contenido */}
        <section className="pf-body">
          <div className="pf-content-head">
            <div className="pf-content-title">{TITLES[sec]}</div>
          </div>
          <div className="pf-content-scroll">
            {sec === 'datos' && (
              <SecDatos
                nombre={nombre} apellido={apellido} email={email}
                miembroDesde={miembroDesde} cargando={cargando} onSave={guardarDatos}/>
            )}
            {sec === 'seguridad' && <SecSeguridad/>}
            {sec === 'transac' && <SecTransac/>}
            {sec === 'historial' && <SecHistorial/>}
          </div>
        </section>
      </div>
    </div>
  )
}

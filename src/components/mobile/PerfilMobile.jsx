// src/components/mobile/PerfilMobile.jsx
// ─────────────────────────────────────────────────────────────
// CÁSCARA MOBILE DEL PERFIL (carnet de socio).
// Reescribe SOLO el chrome: en vez del carnet de dos páginas (nav
// izquierda + contenido derecha) usa un layout vertical de teléfono:
//   · header compacto    · tarjeta de identidad con acuarela por sección
//   · selector de secciones en pills horizontales (scroll)
//   · contenido a pantalla completa con scroll
//
// La lógica de datos y las secciones NO se duplican: se reutilizan
// TAL CUAL <SecDatos>, <SecSeguridad>, <SecTransac> y <SecHistorial>,
// los mismos componentes que usa el carnet de escritorio (ahora
// exportados desde perfil.jsx). Solo se replica el wiring de datos
// (carga de perfil + guardar), idéntico al de Perfil.jsx.
//
// Mismo contrato de props que Perfil.jsx:
//   { user, onGoBack, onSignOut }
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import {
  SecDatos, SecSeguridad, SecTransac, SecHistorial,
  NAV, TITLES, SEC_COLOR, washBg, I,
} from '../Perfil.jsx'                 // ← sub-vistas + helpers REUTILIZADOS (¡mayúscula!)
import '../../styles/perfil.css'        // base .pf-* (lo usan las sub-vistas)
import '../../styles/perfil.mobile.css'           // overrides + chrome mobile .pm-*

export default function PerfilMobile({ user, onGoBack, onSignOut }) {
  // — MISMA lógica de datos que Perfil.jsx (no cambia nada) —
  const [sec,       setSec]       = useState('datos')
  const [nombre,    setNombre]    = useState('')
  const [apellido,  setApellido]  = useState('')
  const [cargando,  setCargando]  = useState(true)
  const [avatarUrl, setAvatarUrl] = useState(null)

  const email = user?.email || ''

  const miembroDesde = (() => {
    if (!user?.created_at) return null
    try { return new Date(user.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' }) }
    catch { return null }
  })()

  const inicial = (nombre || email || '?').trim().charAt(0).toUpperCase() || '?'

  // Cargar perfil (idéntico a Perfil.jsx)
  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data, error } = await supabase
        .from('perfiles').select('nombre, apellido').eq('id', user.id).maybeSingle()
      if (!activo) return
      if (!error && data) { setNombre(data.nombre || ''); setApellido(data.apellido || '') }
      setCargando(false)
    })()
    return () => { activo = false }
  }, [user.id])

  // Guardar datos → null si ok, o mensaje de error
  async function guardarDatos({ nombre: n, apellido: a }) {
    const { error } = await supabase.from('perfiles').update({ nombre: n, apellido: a }).eq('id', user.id)
    if (error) return error.message
    setNombre(n); setApellido(a)
    return null
  }

  // Foto: preview local (igual que Perfil.jsx). TODO: subir a Storage.
  function onPickAvatar(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="pm-root">
      {/* filtro de grano acuarela (mismo id que usa perfil.css) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="pf-grain"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" stitchTiles="stitch" result="n"/>
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 1.05"/></filter>
      </svg>

      {/* ── Header compacto ── */}
      <header className="pm-topbar">
        <div className="pm-brand">
          <h1>Mi Carnet</h1>
          <p>Socio de Inmersia</p>
        </div>
        <button type="button" className="pm-back" onClick={onGoBack}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4"><path d="M12 6.04A8.97 8.97 0 006 3.75c-1.05 0-2.06.18-3 .51v14.25A8.99 8.99 0 016 18c2.3 0 4.4.87 6 2.29m0-14.25a8.97 8.97 0 016-2.29c1.05 0 2.06.18 3 .51v14.25A8.99 8.99 0 0018 18a8.97 8.97 0 00-6 2.29m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Biblioteca
        </button>
      </header>

      {/* ── Tarjeta de identidad — acuarela según sección ── */}
      <div className="pm-idcard" style={{ background: washBg(SEC_COLOR[sec]) }}>
        <div className="pm-idcard-grain" />
        <div className="pm-idcard-vig" />
        <div className="pm-idrow">
          <div className="pm-avatar-ring">
            {avatarUrl
              ? <img className="pm-avatar-img" src={avatarUrl} alt="Foto de perfil" />
              : <div className="pm-avatar-fallback">{inicial}</div>}
            <label className="pm-avatar-cam" title="Cambiar foto">
              <input type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }} />
              {I.cam}
            </label>
          </div>
          <div className="pm-idinfo">
            <div className="pm-idname">{cargando ? '…' : `${nombre} ${apellido}`.trim() || 'Lector'}</div>
            <div className="pm-idmail">{email}</div>
            {miembroDesde && <span className="pm-idmeta">Miembro desde {miembroDesde}</span>}
          </div>
        </div>
      </div>

      {/* ── Selector de secciones ── */}
      <div className="pm-tabs">
        {NAV.map(n => (
          <button key={n.id} type="button" className={'pm-tab' + (sec === n.id ? ' active' : '')} onClick={() => setSec(n.id)}>
            {n.icon}{n.label}
          </button>
        ))}
      </div>

      {/* ── Contenido (sub-vistas REUTILIZADAS, sin cambios) ── */}
      <div className="pm-scroll">
        <div className="pm-content">
          <div className="pm-sec-title">{TITLES[sec]}</div>
          <div className="pm-sec-gap" />
          {sec === 'datos' && (
            <SecDatos
              nombre={nombre} apellido={apellido} email={email}
              miembroDesde={miembroDesde} cargando={cargando} onSave={guardarDatos} />
          )}
          {sec === 'seguridad' && <SecSeguridad />}
          {sec === 'transac'   && <SecTransac />}
          {sec === 'historial' && <SecHistorial />}

          <button type="button" className="pm-logout" onClick={onSignOut}>{I.logout} Cerrar sesión</button>
        </div>
      </div>
    </div>
  )
}

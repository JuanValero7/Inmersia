// Plain JavaScript (.jsx)
import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { supabase } from '../../lib/supabase.js'
import { Avatar, timeAgo, fetchNombre } from './foroUtils.jsx'

export default function ForoChat({ foro, book, user, miNombre, onSesionChange }) {
  const [enSala,       setEnSala]       = useState(false)
  const [usersInSala,  setUsersInSala]  = useState([])
  const [sesionActiva, setSesionActiva] = useState(null)
  const [mensajes,     setMensajes]     = useState([])
  const [msgText,      setMsgText]      = useState('')
  const [chatPartner,  setChatPartner]  = useState(null)
  const [historial,    setHistorial]    = useState([])

  const salaChannelRef = useRef(null)
  const chatChannelRef = useRef(null)
  const mensajesEndRef = useRef(null)

  // ─── Sesión activa al montar ────────────────────────────
  useEffect(() => {
    supabase.from('chat_sesiones')
      .select('id, usuario_a, usuario_b')
      .or(`usuario_a.eq.${user.id},usuario_b.eq.${user.id}`)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
        const partnerId = data.usuario_a === user.id ? data.usuario_b : data.usuario_a
        const nombre = await fetchNombre(partnerId)
        setSesionActiva(data)
        setChatPartner({ user_id: partnerId, nombre })
        onSesionChange?.(true)
        await loadMessages(data.id)
        subscribeToChat(data.id)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  // ─── Historial al montar ────────────────────────────────
  useEffect(() => {
    loadHistorial()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foro.id, user.id])

  // ─── Listener de invitaciones ───────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`chat-invite:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_sesiones',
        filter: `usuario_b=eq.${user.id}`,
      }, async (payload) => {
        const sesion = payload.new
        const nombre = await fetchNombre(sesion.usuario_a)
        await salirSalaInternal()
        setSesionActiva(sesion)
        setChatPartner({ user_id: sesion.usuario_a, nombre })
        onSesionChange?.(true)
        await writeHistorial(sesion.usuario_a)
        await loadMessages(sesion.id)
        subscribeToChat(sesion.id)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  // ─── Auto-scroll al fondo del chat ──────────────────────
  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // ─── Cleanup al desmontar ────────────────────────────────
  useEffect(() => {
    return () => {
      if (salaChannelRef.current) supabase.removeChannel(salaChannelRef.current)
      if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current)
    }
  }, [])

  // ─── Historial ───────────────────────────────────────────
  async function loadHistorial() {
    const { data } = await supabase
      .from('chat_historial')
      .select('partner_id, created_at')
      .eq('user_id', user.id)
      .eq('foro_id', foro.id)
      .order('created_at', { ascending: false })
      .limit(25)

    if (!data?.length) return

    const seen = new Set()
    const unique = []
    for (const row of data) {
      if (!seen.has(row.partner_id)) {
        seen.add(row.partner_id)
        unique.push(row)
        if (unique.length === 5) break
      }
    }

    const partnerIds = unique.map(r => r.partner_id)
    const { data: perfiles } = await supabase
      .from('perfiles').select('id, nombre, apellido').in('id', partnerIds)
    const perfilMap = {}
    ;(perfiles || []).forEach(p => { perfilMap[p.id] = p })

    const withNames = unique.map(row => {
      const p = perfilMap[row.partner_id]
      const nombre = p?.nombre ? `${p.nombre} ${p.apellido || ''}`.trim() : 'Lector'
      return { partner_id: row.partner_id, nombre, created_at: row.created_at }
    })
    setHistorial(withNames)
  }

  async function writeHistorial(partnerId) {
    await supabase.from('chat_historial').insert({
      user_id: user.id,
      foro_id: foro.id,
      partner_id: partnerId,
    })
    loadHistorial()
  }

  // ─── Acciones ────────────────────────────────────────────
  async function loadMessages(sesionId) {
    const { data } = await supabase
      .from('chat_mensajes')
      .select('id, autor_id, contenido, created_at')
      .eq('sesion_id', sesionId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMensajes(data || [])
  }

  function subscribeToChat(sesionId) {
    if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current)
    const channel = supabase.channel(`chat-msgs:${sesionId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_mensajes',
        filter: `sesion_id=eq.${sesionId}`,
      }, (payload) => {
        setMensajes(prev =>
          prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]
        )
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'chat_sesiones',
        filter: `id=eq.${sesionId}`,
      }, () => cerrarChatLocal())
      .subscribe()
    chatChannelRef.current = channel
  }

  async function salirSalaInternal() {
    if (salaChannelRef.current) {
      await salaChannelRef.current.untrack()
      await supabase.removeChannel(salaChannelRef.current)
      salaChannelRef.current = null
    }
    setEnSala(false)
    setUsersInSala([])
  }

  async function entrarSala() {
    if (!foro || enSala) return
    const channel = supabase.channel(`foro-sala:${foro.id}`, {
      config: { presence: { key: user.id } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const others = Object.values(state).flat().filter(u => u.user_id !== user.id)
        setUsersInSala(others)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, nombre: miNombre })
          setEnSala(true)
        }
      })
    salaChannelRef.current = channel
  }

  async function iniciarChat(otroUser) {
    const { data, error } = await supabase
      .from('chat_sesiones')
      .insert({ libro_id: book.libro_id, usuario_a: user.id, usuario_b: otroUser.user_id })
      .select().single()
    if (error) return
    await salirSalaInternal()
    setSesionActiva(data)
    setChatPartner(otroUser)
    onSesionChange?.(true)
    await writeHistorial(otroUser.user_id)
    await loadMessages(data.id)
    subscribeToChat(data.id)
  }

  function cerrarChatLocal() {
    if (chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current)
      chatChannelRef.current = null
    }
    setSesionActiva(null)
    setMensajes([])
    setChatPartner(null)
    setMsgText('')
    onSesionChange?.(false)
  }

  async function cerrarChat() {
    if (sesionActiva) {
      await supabase.from('chat_sesiones').delete().eq('id', sesionActiva.id)
    }
    cerrarChatLocal()
  }

  async function enviarMensaje() {
    if (!msgText.trim() || !sesionActiva) return
    const contenido = msgText.trim()
    if (contenido.length > 500) return
    setMsgText('')
    await supabase.from('chat_mensajes').insert({
      sesion_id: sesionActiva.id, autor_id: user.id, contenido,
    })
  }

  function handleMsgKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje() }
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <main className="foro-main">

      {/* Estado 3: chat activo */}
      {sesionActiva ? (
        <div className="chat-window">
          <div className="chat-window-header">
            <div className="flex items-center gap-2">
              <Avatar name={chatPartner?.nombre || 'Lector'} small />
              <span className="chat-partner-nombre">{chatPartner?.nombre || 'Lector'}</span>
            </div>
            <button type="button" className="chat-cerrar-btn" onClick={cerrarChat}>
              Cerrar chat
            </button>
          </div>
          <p className="chat-disclaimer">
            Esta conversación es temporal y se borrará cuando cualquiera de los dos la cierre.
          </p>
          <div className="chat-mensajes">
            {mensajes.length === 0 && (
              <p className="chat-empty">Di hola para empezar la conversación.</p>
            )}
            {mensajes.map(m => {
              const esMio = m.autor_id === user.id
              return (
                <div key={m.id} className={clsx('chat-burbuja-wrap', esMio && 'mia')}>
                  <div className={clsx('chat-burbuja', esMio && 'mia')}>{m.contenido}</div>
                  <span className="chat-burbuja-hora">{timeAgo(m.created_at)}</span>
                </div>
              )
            })}
            <div ref={mensajesEndRef} />
          </div>
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              placeholder="Escribe un mensaje… (Enter para enviar)"
              maxLength={500}
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              onKeyDown={handleMsgKeyDown}
              rows={1}
            />
            <button type="button" className="foro-btn-submit" onClick={enviarMensaje} disabled={!msgText.trim()}>
              Enviar
            </button>
          </div>
        </div>

      ) : enSala ? (
        /* Estado 2: en sala de espera */
        <div className="sala-container">
          <div className="sala-header">
            <div className="sala-dot pulsing" />
            <span>En la sala de espera…</span>
          </div>
          <div className="sala-mi-card">
            <Avatar name={miNombre} />
            <span>{miNombre} <span className="sala-tu-badge">Tú</span></span>
          </div>
          {usersInSala.length === 0 ? (
            <p className="sala-empty">Esperando que otro lector entre a la sala…</p>
          ) : (
            <>
              <p className="sala-otros-label">Lectores disponibles</p>
              <div className="sala-lista">
                {usersInSala.map(u => (
                  <div key={u.user_id} className="sala-user-card">
                    <Avatar name={u.nombre} />
                    <span className="sala-user-nombre">{u.nombre}</span>
                    <button type="button" className="foro-btn-submit small" onClick={() => iniciarChat(u)}>
                      Chatear
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <button type="button" className="foro-btn-cancel salir-sala" onClick={salirSalaInternal}>
            Salir de la sala
          </button>
        </div>

      ) : (
        /* Estado 1: fuera de sala */
        <div className="chat-inicio-layout">

          {historial.length > 0 && (
            <aside className="chat-historial-panel">
              <p className="chat-historial-titulo">Últimas conversaciones</p>
              <div className="chat-historial-lista">
                {historial.map(h => (
                  <div key={h.partner_id} className="chat-historial-item">
                    <Avatar name={h.nombre} small />
                    <div className="chat-historial-info">
                      <span className="chat-historial-nombre">{h.nombre}</span>
                      <span className="chat-historial-fecha">{timeAgo(h.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          )}

          <div className={clsx('sala-container', 'centered', historial.length > 0 && 'compact')}>
            <div className="sala-intro-icon">
              <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#cf7b4c" strokeWidth="1.8">
                <path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="sala-intro-titulo">Sala de espera</h3>
            <p className="sala-intro-desc">
              Entrá a la sala para encontrar otros lectores de este libro y charlar en tiempo real.
            </p>
            <button type="button" className="foro-btn-submit" onClick={entrarSala}>
              Entrar a la sala
            </button>
            <p className="chat-aviso-temporal">
              Las conversaciones son temporales y se borran cuando cualquiera de los dos cierra el chat.
            </p>
          </div>

        </div>
      )}
    </main>
  )
}

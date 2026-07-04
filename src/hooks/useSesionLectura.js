// Registra y mantiene la sesión de lectura activa en Supabase.
// Reglas:
//   · Invitados (guestMode) no generan sesión.
//   · Al montar: busca en sessionStorage una sesión reciente (<30 min)
//     del mismo libro y usuario — si existe, la retoma sin nuevo INSERT.
//   · Al desmontar: cierra la sesión con ended_at = ahora y actualiza
//     sessionStorage para posibles reanudaciones.
//   · Si el usuario abre otro libro, el bookId no coincide y se crea
//     sesión nueva automáticamente.
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

const SESSION_KEY  = 'inm_sesion_lect'
const TIMEOUT_MS   = 30 * 60 * 1000   // 30 minutos

export function useSesionLectura(userId, book, guestMode) {
  const sessionIdRef = useRef(null)

  useEffect(() => {
    if (guestMode || !userId || !book?.libro_id) return

    const libroId = book.libro_id
    let cancelled = false

    // Intentar reanudar sesión reciente del mismo libro
    let resumed = false
    try {
      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
      if (
        stored?.bookId  === libroId &&
        stored?.userId  === userId  &&
        Date.now() - stored.lastActivity < TIMEOUT_MS
      ) {
        sessionIdRef.current = stored.sessionId
        resumed = true
      }
    } catch {}

    if (!resumed) {
      supabase
        .from('sesiones_lectura')
        .insert({ user_id: userId, libro_id: libroId })
        .select('id')
        .single()
        .then(({ data }) => {
          if (cancelled || !data) return
          sessionIdRef.current = data.id
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            sessionId: data.id, bookId: libroId, userId, lastActivity: Date.now(),
          }))
        })
    }

    return () => {
      cancelled = true
      const sid = sessionIdRef.current
      if (!sid) return

      supabase
        .from('sesiones_lectura')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sid)
        .then()

      // Actualizar timestamp para posible reanudación
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        sessionId: sid, bookId: libroId, userId, lastActivity: Date.now(),
      }))
    }
  }, [userId, book?.libro_id, guestMode])
}

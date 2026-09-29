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

// Guardar la sesión NUNCA debe poder tumbar el lector: con el almacenamiento
// bloqueado (WebView in-app de Instagram, modo privado) setItem lanza. La
// escritura de abajo vive en la limpieza del efecto, así que una excepción ahí
// se propaga al desmontar y revienta React al salir del libro. Sin
// almacenamiento solo se pierde la reanudación de sesión, que es cosmético.
function guardarSesion(datos) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(datos)) }
  catch { /* almacenamiento no disponible */ }
}

/**
 * Abre una fila en sesiones_lectura al entrar al Lector y la cierra al salir.
 *
 * Es la base de las métricas de retención: sesiones_lectura es la única fuente con un
 * user_id estable, porque PostHog va en modo cookieless y su hash rota cada día.
 * Ver supabase/consultas/cohortes.sql.
 *
 * @param {string|null} userId
 * @param {object|null} book
 * @param {boolean} guestMode   los invitados no dejan sesión
 */
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
    } catch {
      // sessionStorage corrupto o inaccesible: se cae al flujo de sesión nueva de abajo
    }

    if (!resumed) {
      supabase
        .from('sesiones_lectura')
        .insert({ user_id: userId, libro_id: libroId })
        .select('id')
        .single()
        .then(({ data }) => {
          if (cancelled || !data) return
          sessionIdRef.current = data.id
          guardarSesion({ sessionId: data.id, bookId: libroId, userId, lastActivity: Date.now() })
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
      guardarSesion({ sessionId: sid, bookId: libroId, userId, lastActivity: Date.now() })
    }
  }, [userId, book?.libro_id, guestMode])
}

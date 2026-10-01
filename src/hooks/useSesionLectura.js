// Registra y mantiene la sesión de lectura activa en Supabase.
// Reglas:
//   · Invitados (guestMode) no generan sesión.
//   · Al montar: busca en sessionStorage una sesión reciente (<30 min)
//     del mismo libro y usuario — si existe, la retoma sin nuevo INSERT.
//   · Tiempo activo (segundos_activos, migración 061): solo suma con la
//     pestaña visible y con actividad (tocar, clic, tecla, scroll) en los
//     últimos 3 min. Una pestaña olvidada o la pausa de una sesión
//     retomada ya no cuentan como lectura.
//   · Cada ~60 s, al ocultarse la pestaña y al desmontar, guarda
//     segundos_activos y ended_at. Así, si el móvil mata la app sin
//     desmontar el lector, la sesión queda guardada hasta el último minuto.
//   · Si el usuario abre otro libro, el bookId no coincide y se crea
//     sesión nueva automáticamente.
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

const SESSION_KEY     = 'inm_sesion_lect'
const TIMEOUT_MS      = 30 * 60 * 1000   // ventana para retomar la misma sesión
const INACTIVIDAD_MS  = 3 * 60 * 1000    // sin actividad más que esto = dejó de leer
const TICK_MS         = 15 * 1000        // cada cuánto se acumula tiempo activo
const GUARDAR_MS      = 60 * 1000        // cada cuánto se guarda en Supabase

// Lo que cuenta como "está leyendo". En captura y pasivos: `scroll` no
// burbujea (así se oye el de los contenedores internos) y pasivos no
// frenan el scroll.
const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']
const OPCIONES_EVENTO   = { capture: true, passive: true }

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
 * Abre una fila en sesiones_lectura al entrar al Lector, lleva su tiempo
 * activo mientras se lee y la cierra al salir.
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

    // Tiempo activo acumulado (ms) y marcas para acumularlo.
    let activosMs        = 0
    let ultimaActividad  = Date.now()
    let ultimoTick       = Date.now()
    let segundosGuardados = -1

    // Intentar reanudar sesión reciente del mismo libro. Una entrada sin
    // `segundos` es de antes de la 061: su fila no lleva tiempo activo, así
    // que no se retoma (se empezaría a contar desde 0 y se perdería lo que
    // ya tenía por marcas).
    let resumed = false
    try {
      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
      if (
        stored?.bookId  === libroId &&
        stored?.userId  === userId  &&
        typeof stored.segundos === 'number' &&
        Date.now() - stored.lastActivity < TIMEOUT_MS
      ) {
        sessionIdRef.current = stored.sessionId
        activosMs = stored.segundos * 1000
        segundosGuardados = stored.segundos
        resumed = true
      }
    } catch {
      // sessionStorage corrupto o inaccesible: se cae al flujo de sesión nueva de abajo
    }

    if (!resumed) {
      sessionIdRef.current = null
      supabase
        .from('sesiones_lectura')
        .insert({ user_id: userId, libro_id: libroId, segundos_activos: 0 })
        .select('id')
        .single()
        .then(({ data }) => {
          if (cancelled || !data) return
          sessionIdRef.current = data.id
          segundosGuardados = 0
          guardarSesion({ sessionId: data.id, bookId: libroId, userId, lastActivity: Date.now(), segundos: 0 })
        })
    }

    // Suma el tiempo desde el último tick, pero solo el tramo cubierto por
    // la actividad: hasta ultimaActividad + INACTIVIDAD_MS. Así, tras la
    // última interacción todavía cuentan hasta 3 min (leer la página), y
    // una suspensión del equipo no se cuela como lectura.
    function acumular() {
      const ahora = Date.now()
      if (document.visibilityState === 'visible') {
        const limite = Math.min(ahora, ultimaActividad + INACTIVIDAD_MS)
        if (limite > ultimoTick) activosMs += limite - ultimoTick
      }
      ultimoTick = ahora
    }

    function guardar() {
      const sid = sessionIdRef.current
      if (!sid) return
      const segundos = Math.round(activosMs / 1000)
      guardarSesion({ sessionId: sid, bookId: libroId, userId, lastActivity: Date.now(), segundos })
      if (segundos === segundosGuardados) return
      segundosGuardados = segundos
      // ended_at = el último momento que contó como lectura.
      const fin = Math.min(Date.now(), ultimaActividad + INACTIVIDAD_MS)
      supabase
        .from('sesiones_lectura')
        .update({ segundos_activos: segundos, ended_at: new Date(fin).toISOString() })
        .eq('id', sid)
        .then()
    }

    function onActividad() { ultimaActividad = Date.now() }

    function onVisibilidad() {
      if (document.visibilityState === 'hidden') {
        acumular()
        guardar()   // en móvil, ocultarse suele ser lo último antes de que maten la app
      } else {
        // Vuelve a la pestaña: lo oculto no suma y volver cuenta como actividad.
        ultimoTick = Date.now()
        ultimaActividad = Date.now()
      }
    }

    function onTick() { acumular() }
    function onGuardar() { acumular(); guardar() }

    EVENTOS_ACTIVIDAD.forEach(ev => window.addEventListener(ev, onActividad, OPCIONES_EVENTO))
    document.addEventListener('visibilitychange', onVisibilidad)
    window.addEventListener('pagehide', onGuardar)
    const tickId    = setInterval(onTick, TICK_MS)
    const guardarId = setInterval(onGuardar, GUARDAR_MS)

    return () => {
      cancelled = true
      clearInterval(tickId)
      clearInterval(guardarId)
      EVENTOS_ACTIVIDAD.forEach(ev => window.removeEventListener(ev, onActividad, OPCIONES_EVENTO))
      document.removeEventListener('visibilitychange', onVisibilidad)
      window.removeEventListener('pagehide', onGuardar)
      acumular()
      guardar()
    }
  }, [userId, book?.libro_id, guestMode])
}

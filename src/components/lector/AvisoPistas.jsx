// Formato: Plain JavaScript (.jsx)
// Aviso al empezar un capítulo: «🔎 Llegaron 4 pistas nuevas a tu mesa · Ver»
// (decisión de Juan, 10 nov 2026). Vale para la mesa de Anderson (ficción) y
// el hilo de ideas (no ficción). No frena la lectura: se va solo o al tocarlo.
// Cuenta TODAS las pistas que llegaron, señuelos incluidos (no delata cuáles
// son trampa). Solo si el juego está encendido y el capítulo trajo algo.
import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase.js'
import { queryKeys } from '../../lib/queries.js'
import { novedadesHilo } from '../../utils/hilo.js'
import '../../styles/aviso-pistas.css'

const DURA_MS = 7000

/** Pistas nuevas de la mesa de Anderson: las del último capítulo, de los personajes que ya aparecieron. */
const nuevasMesa = (estado) => (estado?.personajes ?? []).reduce((n, p) => n + (p.nuevas || 0), 0)

/**
 * @param {{ libroId: string|null|undefined, userId: string|null|undefined, esNoficcion: boolean, encendido: boolean }} opts
 */
export function useAvisoPistas({ libroId, userId, esNoficcion, encendido }) {
  const queryClient = useQueryClient()
  const [aviso, setAviso] = useState(null)   // { texto }
  const vivo = useRef(true)
  useEffect(() => () => { vivo.current = false }, [])

  // `completados` = capítulos completados tras guardar el avance.
  const avisar = useCallback(async (completados) => {
    if (!libroId || !userId || !encendido) return
    const key = esNoficcion ? queryKeys.hiloIdeas(libroId, userId) : queryKeys.mesaInvestigacion(libroId, userId)
    const rpc = esNoficcion ? 'hilo_tablero' : 'anderson_mesa'
    try {
      // Misma consulta que la pizarra / la mesa: al abrirlas ya está en la caché.
      const estado = await queryClient.fetchQuery({
        queryKey: key, staleTime: 0, retry: false,
        queryFn: async () => {
          const { data, error } = await supabase.rpc(rpc, { p_libro: libroId })
          if (error) throw error
          return data
        },
      })
      // Si el avance no se llegó a guardar, el estado es el de antes: mejor callar.
      if (!vivo.current || !estado || estado.capitulos_completados !== completados) return
      if (esNoficcion) {
        const { pistas, ideas } = novedadesHilo(estado)
        if (!pistas) return
        setAviso({ texto: `🧵 ${pistas === 1 ? 'Llegó 1 pista nueva' : `Llegaron ${pistas} pistas nuevas`} a tu pizarra`
          + (ideas ? ` y se ${ideas === 1 ? 'abrió una idea' : `abrieron ${ideas} ideas`}` : '') })
      } else {
        const n = nuevasMesa(estado)
        if (!n) return
        setAviso({ texto: `🔎 ${n === 1 ? 'Llegó 1 pista nueva' : `Llegaron ${n} pistas nuevas`} a tu mesa` })
      }
    } catch { /* sin juego o sin conexión: sin aviso */ }
  }, [libroId, userId, esNoficcion, encendido, queryClient])

  const cerrar = useCallback(() => setAviso(null), [])
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(cerrar, DURA_MS)
    return () => clearTimeout(t)
  }, [aviso, cerrar])

  return { aviso, avisar, cerrar }
}

/**
 * @param {{ aviso: { texto: string }|null, onVer: () => void, onCerrar: () => void, movil?: boolean }} props
 */
export default function AvisoPistas({ aviso, onVer, onCerrar, movil = false }) {
  if (!aviso) return null
  return (
    <div className={`avp${movil ? ' is-movil' : ''}`} role="status">
      <button type="button" className="avp-txt" onClick={onCerrar} aria-label="Cerrar el aviso">{aviso.texto}</button>
      <button type="button" className="avp-ver" onClick={() => { onCerrar(); onVer() }}>Ver</button>
    </div>
  )
}

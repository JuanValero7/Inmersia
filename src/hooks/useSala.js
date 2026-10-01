// src/hooks/useSala.js
// ─────────────────────────────────────────────────────────────
// Una sala de la Tienda (/tienda/<slug>), igual en escritorio
// (SalaVista) y en móvil (SalaMobile):
//   · la sala por su slug; si no existe o es una temporada fuera de
//     fecha, vuelve a /tienda
//   · sus libros repartidos en estanterías (utils/estanteria.js), con
//     el lomo de cada balda fijo durante la visita
//   · la secuencia en el orden en que se ven (la de «Desliza»)
//   · las demás salas visitables, para el pasillo
//   · el evento sala_abierta
// ─────────────────────────────────────────────────────────────
import { useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSalasQuery } from '../lib/queries.js'
import { armarEstanterias, secuenciaVisual } from '../utils/estanteria.js'
import { esVisitable } from '../components/tienda/salaPiezas.jsx'
import { evento } from '../lib/analytics.js'

// Dónde va el lomo de cada balda: se sortea una vez y se guarda en
// sessionStorage, así la estantería no «salta» durante la visita.
function posicionLomo(slug, clave, huecos) {
  const k = `inmersia:lomo:${slug}:${clave}`
  try {
    const guardada = sessionStorage.getItem(k)
    if (guardada != null) return Number(guardada)
  } catch { /* sin almacenamiento: se sortea en cada visita */ }
  const pos = Math.floor(Math.random() * huecos)
  try { sessionStorage.setItem(k, String(pos)) } catch { /* idem */ }
  return pos
}

/**
 * @param {string} slug
 * @param {object[]} catalogo  libros visibles (los de la sala salen de aquí)
 */
export function useSala(slug, catalogo) {
  const navigate = useNavigate()
  const { data: salas, isError } = useSalasQuery()
  const sala = salas?.find(s => s.slug === slug && esVisitable(s)) || null

  useEffect(() => {
    if (salas && !sala) navigate('/tienda', { replace: true })
  }, [salas, sala, navigate])

  const salaSlug = sala?.slug
  useEffect(() => { if (salaSlug) evento('sala_abierta', { sala: salaSlug }) }, [salaSlug])

  const porId = useMemo(() => new Map(catalogo.map(l => [l.id, l])), [catalogo])
  const librosDe = useCallback((s) => s.libros.map(id => porId.get(id)).filter(Boolean), [porId])
  const libros = useMemo(() => (sala ? librosDe(sala) : []), [sala, librosDe])

  const estanterias = useMemo(
    () => armarEstanterias(libros, (clave, huecos) => posicionLomo(slug, clave, huecos)),
    [libros, slug]
  )
  const secuencia = useMemo(() => secuenciaVisual(estanterias), [estanterias])
  const indiceDe = useMemo(() => new Map(secuencia.map((l, i) => [l.id, i])), [secuencia])

  const otras = useMemo(
    () => (salas || []).filter(s => s.slug !== slug && esVisitable(s)),
    [salas, slug]
  )

  return { sala, isError, libros, estanterias, secuencia, indiceDe, otras, librosDe }
}

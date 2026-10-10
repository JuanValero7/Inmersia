// src/hooks/useAdquirirTrasEntrar.js
// ─────────────────────────────────────────────────────────────
// Tras entrar desde el muro de la muestra (estando en /libro/:slug), agrega
// ese libro a la biblioteca respetando el límite de lecturas pendientes, que
// impone adquirir_libro() en la base (migración 076):
//   · Bajo el límite → se adquiere, se rescata lo que leyó como invitado
//     (rescatarMuestra) y sigue leyendo.
//   · Ya en el límite → no se adquiere y va a su Biblioteca con un aviso
//     (misma regla que la Tienda).
// También en cuenta nueva: sin el libro en la biblioteca el lector seguiría en
// modo muestra, sin subrayado, sin cuaderno y sin progreso.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryKeys } from '../lib/queries.js'
import { guardar, AVISOS } from '../lib/guardar.js'
import { rescatarMuestra } from '../lib/rescatarMuestra.js'
import { volvioDeGoogleEnLibro } from '../lib/progresoInvitado.js'

/**
 * @param {object|null|undefined} user
 * @returns {{ adquirirTrasEntrar: (u: object) => Promise<void>, limiteAviso: boolean, cerrarLimiteAviso: () => void }}
 */
export function useAdquirirTrasEntrar(user) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [limiteAviso, setLimiteAviso] = useState(false)

  const adquirirTrasEntrar = useCallback(async (u) => {
    if (!u?.id || !location.pathname.startsWith('/libro/')) return
    const slug = location.pathname.split('/')[2]
    if (!slug) return

    // El libro que traiga la navegación si coincide con la URL; si no (enlace
    // compartido), se busca.
    const libroNav = location.state?.book
    let libroId = (libroNav?.slug === slug || libroNav?.id === slug) ? libroNav?.libro_id : null
    if (!libroId) {
      const { data } = await supabase.from('libros').select('id').eq('slug', slug).maybeSingle()
      libroId = data?.id
    }
    if (!libroId) return

    const res = await supabase.rpc('adquirir_libro', { p_libro_id: libroId })
    if (res.error?.hint === 'limite_pendientes') {
      setLimiteAviso(true)
      navigate('/biblioteca', { replace: true })
      return
    }
    const { ok, data: nuevo } = await guardar(res, { que: 'adquirir libro tras registrarse', aviso: AVISOS.libro })
    if (!ok || !nuevo) return // falló, o ya lo tenía: sigue leyendo
    await rescatarMuestra(u.id, libroId)
    queryClient.invalidateQueries({ queryKey: queryKeys.bibliotecaUsuario(u.id) })
    // Sigue en el lector; al tener el libro deja de estar en modo muestra.
  }, [location.pathname, location.state, navigate, queryClient])

  // Al volver de "Continuar con Google" la página se recargó y el onAuthSuccess
  // del pop-up no corre: si estaba leyendo una muestra, el libro se adquiere aquí.
  useEffect(() => {
    if (user && volvioDeGoogleEnLibro()) adquirirTrasEntrar(user)
  }, [user, adquirirTrasEntrar])

  // El aviso de "límite alcanzado" se autodescarta a los 7 s.
  useEffect(() => {
    if (!limiteAviso) return
    const t = setTimeout(() => setLimiteAviso(false), 7000)
    return () => clearTimeout(t)
  }, [limiteAviso])

  const cerrarLimiteAviso = useCallback(() => setLimiteAviso(false), [])
  return { adquirirTrasEntrar, limiteAviso, cerrarLimiteAviso }
}

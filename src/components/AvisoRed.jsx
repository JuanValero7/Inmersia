// src/components/AvisoRed.jsx
// ─────────────────────────────────────────────────────────────
// Aviso global de "no pudimos cargar tus datos".
//
// Biblioteca, Tienda, Álbum y Perfil consumen las queries compartidas
// (src/lib/queries.js) con `.data ?? []`: si la red falla, la pantalla
// queda vacía y muda. En vez de un estado de error por pantalla, este
// componente se monta UNA vez en App.jsx, se suscribe al caché de
// React Query y cubre las cuatro de golpe.
//
// Dos casos distintos, porque React Query los trata distinto:
//   · Sin conexión → networkMode 'online' no deja fallar la query, la
//     deja en fetchStatus 'paused' (la pantalla giraría para siempre).
//     No ofrecemos "Reintentar": no serviría de nada, y React Query
//     reanuda sola en cuanto vuelve la conexión.
//   · Con conexión pero la query falló → status 'error' (ya van dos
//     reintentos automáticos, ver main.jsx). Ahí sí hay botón.
//
// Solo miramos queries ACTIVAS (con observadores montados): un error
// viejo de una pantalla que el usuario ya abandonó no debe dar la lata.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useQueryClient, onlineManager } from '@tanstack/react-query'

function leerEstado(queryClient) {
  const activas = queryClient.getQueryCache().findAll({ type: 'active' })
  return {
    pausadas: activas.some(q => q.state.fetchStatus === 'paused'),
    fallidas: activas.some(q => q.state.status === 'error'),
  }
}

export default function AvisoRed() {
  const queryClient = useQueryClient()
  const [estado,       setEstado]       = useState(() => leerEstado(queryClient))
  const [offline,      setOffline]      = useState(() => !onlineManager.isOnline())
  const [descartado,   setDescartado]   = useState(false)
  const [reintentando, setReintentando] = useState(false)

  // El caché emite en cada cambio de cualquier query; solo re-renderizamos
  // si alguno de los dos booleanos cambió de verdad.
  useEffect(() => queryClient.getQueryCache().subscribe(() => {
    const siguiente = leerEstado(queryClient)
    setEstado(prev =>
      prev.pausadas === siguiente.pausadas && prev.fallidas === siguiente.fallidas
        ? prev
        : siguiente
    )
  }), [queryClient])

  useEffect(() => onlineManager.subscribe(online => setOffline(!online)), [])

  const sinConexion = offline && (estado.pausadas || estado.fallidas)
  const hayAviso    = sinConexion || estado.fallidas

  // Si el problema se resolvió, el descarte previo no debe silenciar el
  // siguiente fallo.
  useEffect(() => { if (!hayAviso) setDescartado(false) }, [hayAviso])

  const reintentar = useCallback(async () => {
    setReintentando(true)
    try {
      await queryClient.refetchQueries({ type: 'active', predicate: q => q.state.status === 'error' })
    } finally {
      setReintentando(false)
    }
  }, [queryClient])

  if (!hayAviso || descartado) return null

  return (
    <div role="status" aria-live="polite"
      style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 4000, maxWidth: 460, width: 'calc(100% - 32px)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 14, padding: '14px 16px', boxShadow: '2px 4px 0 rgba(74,54,34,0.22), 0 14px 30px rgba(0,0,0,0.22)', fontFamily: "'Baloo 2', sans-serif" }}>
        <span style={{ fontSize: 20, lineHeight: 1.2 }}>{sinConexion ? '📡' : '🌧️'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#4a3622', lineHeight: 1.45 }}>
            {sinConexion
              ? 'Parece que no tienes conexión. Volveremos a cargar tus datos en cuanto regreses.'
              : 'No pudimos cargar tus datos.'}
          </p>
          {!sinConexion && (
            <button type="button" onClick={reintentar} disabled={reintentando}
              style={{ marginTop: 8, background: '#4a3622', border: 'none', borderRadius: 9, color: '#fffdf8', cursor: reintentando ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, opacity: reintentando ? 0.6 : 1, padding: '7px 14px' }}>
              {reintentando ? 'Reintentando…' : 'Reintentar'}
            </button>
          )}
        </div>
        <button type="button" onClick={() => setDescartado(true)} aria-label="Cerrar"
          style={{ background: 'transparent', border: 'none', color: '#9a6a4a', cursor: 'pointer', fontSize: 20, fontWeight: 700, lineHeight: 1, padding: 0 }}>×</button>
      </div>
    </div>
  )
}

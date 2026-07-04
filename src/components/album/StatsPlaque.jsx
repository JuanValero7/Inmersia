import { formatSeg } from '../../hooks/useAlbum.js'

// La "placa": estadísticas reales de lectura del libro. Se muestra dentro de
// la placa de la página izquierda. Mismos datos de siempre (useAlbum → stats).
export default function StatsPlaque({ stats }) {
  const { totalSeg, vecesAbierto, sesionMasLargaSeg, notas } = stats
  const rows = [
    { label: 'Tiempo total',     value: formatSeg(totalSeg)          || '—' },
    { label: 'Veces abierto',    value: vecesAbierto ? `${vecesAbierto} ×` : '—' },
    { label: 'Sesión más larga', value: formatSeg(sesionMasLargaSeg) || '—' },
    { label: 'Notas tomadas',    value: notas ? `${notas}` : '—' },
  ]

  return (
    <div className="album-plaque">
      <p className="album-plaque-title">Estadísticas de lectura</p>
      <div className="album-plaque-grid">
        {rows.map(r => (
          <div key={r.label}>
            <p className="album-plaque-stat-value">{r.value}</p>
            <p className="album-plaque-stat-label">{r.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

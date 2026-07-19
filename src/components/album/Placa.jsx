import StatsPlaque from './StatsPlaque.jsx'

// La "placa": progreso + estadísticas de lectura. Compartida entre el Álbum
// (LeftPage) y el tablero "Datos"/"Resumen" de la Cartelera (TableroDatos).
export default function Placa({ pct, leido = false, stats }) {
  return (
    <div className="album-placa album-placa--stats">
      <span className="album-placa-corner a">✦</span><span className="album-placa-corner b">✦</span>
      <span className="album-placa-corner c">✦</span><span className="album-placa-corner d">✦</span>

      <div className="album-placa-frame">
        <span className="album-placa-ribbon">★ Placa</span>
        <div className="album-placa-body">
          <p className="album-placa-edition">Inmersia · Edición de lectura</p>
          <div className="album-placa-prog">
            <div className="lab"><span className="k">Progreso</span><span className="v">{leido ? 'Leído' : `${Math.round(pct)}%`}</span></div>
            <div className="album-placa-track"><div className="album-placa-fill" style={{ width: `${pct}%` }} /></div>
          </div>
          <StatsPlaque stats={stats} />
        </div>
      </div>
    </div>
  )
}

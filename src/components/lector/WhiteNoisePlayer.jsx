// Panel de ruido ambiental para libros de no ficción.
// Reemplaza RecorderPlayer cuando book.es_ficcion === false.
// Estética clay idéntica al resto del lector.
import { memo } from 'react'
import { theme } from './clay.jsx'
import { useWhiteNoise, TIPOS_RUIDO, AMBIENCIAS } from '../../hooks/useWhiteNoise.js'

const s = {
  panel: {
    background: theme.navBg,
    border: `2px solid ${theme.ink}`,
    boxShadow: `2px 3px 0 ${theme.ink}26`,
    borderRadius: 16,
    padding: '13px 15px 14px',
    width: 310,
    fontFamily: "'Baloo 2', sans-serif",
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: 7, right: 9,
    width: 18, height: 18, borderRadius: 6,
    border: `1.5px solid ${theme.ink}55`,
    background: 'transparent', color: theme.ink,
    fontSize: 11, lineHeight: 1, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 800, color: `${theme.ink}77`,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: 7,
  },
  pillRow: { display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 },
  pill: (active) => ({
    fontSize: 11, fontWeight: 700, padding: '3px 10px',
    borderRadius: 999, border: `1.5px solid ${active ? theme.accent : `${theme.ink}44`}`,
    background: active ? theme.accent : 'transparent',
    color: active ? '#fff' : theme.ink,
    cursor: 'pointer',
  }),
  sliderRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  volLabel: { fontSize: 10, color: `${theme.ink}66`, minWidth: 28, textAlign: 'right' },
  divider: { height: 1, background: `${theme.ink}18`, margin: '10px 0' },
}

const WhiteNoisePlayer = memo(function WhiteNoisePlayer({ onClose }) {
  const { tipo, setTipo, volNoise, setVolNoise, ambiente, setAmbiente, volAmb, setVolAmb } = useWhiteNoise()

  return (
    <div style={s.panel}>
      <button type="button" onClick={onClose} style={s.closeBtn} title="Cerrar">–</button>

      {/* ── Ruido ── */}
      <div style={s.sectionLabel}>Ruido</div>
      <div style={s.pillRow}>
        {TIPOS_RUIDO.map(({ key, label }) => (
          <button key={key} type="button" style={s.pill(tipo === key)} onClick={() => setTipo(key)}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ ...s.sliderRow, opacity: tipo === 'off' ? 0.35 : 1 }}>
        <span style={{ fontSize: 13 }}>🔉</span>
        <input
          type="range" min="0" max="1" step="0.01" value={volNoise}
          disabled={tipo === 'off'}
          onChange={e => setVolNoise(parseFloat(e.target.value))}
          className="inm-vol" style={{ flex: 1 }}
        />
        <span style={s.volLabel}>{Math.round(volNoise * 100)}%</span>
      </div>

      <div style={s.divider} />

      {/* ── Ambiente ── */}
      <div style={s.sectionLabel}>Ambiente</div>
      <div style={s.pillRow}>
        {AMBIENCIAS.map(({ key, label }) => (
          <button key={key} type="button" style={s.pill(ambiente === key)} onClick={() => setAmbiente(key)}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ ...s.sliderRow, opacity: ambiente === 'ninguno' ? 0.35 : 1 }}>
        <span style={{ fontSize: 13 }}>🔉</span>
        <input
          type="range" min="0" max="1" step="0.01" value={volAmb}
          disabled={ambiente === 'ninguno'}
          onChange={e => setVolAmb(parseFloat(e.target.value))}
          className="inm-vol" style={{ flex: 1 }}
        />
        <span style={s.volLabel}>{Math.round(volAmb * 100)}%</span>
      </div>
    </div>
  )
})

export default WhiteNoisePlayer

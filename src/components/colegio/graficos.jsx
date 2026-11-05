// Piezas del panel del colegio (Salón y Colegio), pasadas de la maqueta de
// octubre (Downloads\Inmersia Escuelas.html) a React. Estilos en colegio.css.
//   · Barras: SVG a escala del contenedor, cuadrícula suave, línea de
//     referencia opcional («Meta de hoy», «Empieza…») y tooltip al pasar.
//   · El estado de cada alumno lleva ícono y palabra, nunca solo color.
import { useState, useEffect, useRef } from 'react'

const nf = new Intl.NumberFormat('es')

export const fmtMin = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`)
export const iniciales = (n) => n.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()

export function fechaCorta(iso, conMes = 'short') {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: conMes })
}

// Cifra destacada: número grande, etiqueta y detalle.
export function Kpi({ n, de = null, etiqueta, detalle = null }) {
  return (
    <div className="col-kpi">
      <span className="col-kpi-n">{n}{de != null && <small> de {de}</small>}</span>
      <span className="col-kpi-l">{etiqueta}</span>
      {detalle && <span className="col-kpi-d">{detalle}</span>}
    </div>
  )
}

// Tono del estado: 'ok' | 'warn' | 'bad' (los tres colores de la maqueta).
const ICONO = {
  ok: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>,
  warn: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /></svg>,
  bad: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M12 5v9" /><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" /></svg>,
}

export function EstadoPill({ tono, texto }) {
  if (!tono) return <span className="col-vacio">—</span>
  return <span className={`col-estado ${tono}`}>{ICONO[tono]}{texto}</span>
}

// Siete puntos, del más antiguo a hoy ('x' = leyó ese día).
export function Dias({ mascara = '.......' }) {
  const n = [...mascara].filter(c => c === 'x').length
  return (
    <span className="col-dias" title={`Leyó ${n} de los últimos 7 días`} aria-label={`${n} de 7 días`}>
      {[...mascara].map((c, i) => <i key={i} className={c === 'x' ? 'si' : ''} />)}
    </span>
  )
}

const niceMax = (v) => {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  return [1, 1.5, 2, 3, 4, 6, 8, 10].find(s => v / p <= s) * p
}
const barPath = (x, y, w, h, r) => {
  r = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

// datos: [{ x, v, color?, emph?, tip: ReactNode }]
// opt: { alto, max, ticks, cadaEtiqueta, fmtY, aria, referencia: { i, texto, izquierda } }
export function Barras({ datos, alto = 220, max: maxFijo, ticks = 4, cadaEtiqueta = 1, fmtY = (v) => nf.format(v), aria, referencia = null }) {
  const caja = useRef(null)
  const [W, setW] = useState(600)
  const [tip, setTip] = useState(null) // { x, y, contenido }
  const [sobre, setSobre] = useState(null)

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const medir = () => setW(Math.max(280, el.clientWidth))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const m = { t: referencia ? 26 : 12, r: 6, b: 26, l: 40 }
  const iw = W - m.l - m.r, ih = alto - m.t - m.b
  const max = maxFijo || niceMax(Math.max(0, ...datos.map(d => d.v)) * 1.08)
  const step = iw / Math.max(datos.length, 1)
  const gap = Math.max(2, Math.min(step * 0.28, 10)), bw = step - gap

  const mostrar = (ev, d, i) => {
    setSobre(i)
    let x = ev.clientX + 14, y = ev.clientY - 12
    if (x + 260 > window.innerWidth - 8) x = ev.clientX - 274
    setTip({ x: Math.max(8, x), y, contenido: d.tip })
  }

  return (
    <div className="col-chart" ref={caja}>
      <svg viewBox={`0 0 ${W} ${alto}`} role="img" aria-label={aria}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = (max / ticks) * i, y = m.t + ih - (v / max) * ih
          return (
            <g key={i}>
              {i > 0 && <line x1={m.l} x2={W - m.r} y1={y} y2={y} className="grid" />}
              <text x={m.l - 8} y={y + 4} textAnchor="end">{fmtY(v)}</text>
            </g>
          )
        })}
        {datos.map((d, i) => {
          const x = m.l + i * step + gap / 2, h = (d.v / max) * ih, y = m.t + ih - h
          const on = d.emph || sobre === i
          return (
            <g key={i}>
              {d.v > 0 && (
                <path d={barPath(x, y, bw, h, 4)} fill={d.color || 'var(--accent)'} className={'bar' + (on ? ' on' : '')}
                  stroke={d.emph ? 'var(--ink)' : undefined} strokeWidth={d.emph ? 1.5 : undefined} />
              )}
              {(i % cadaEtiqueta === 0 || i === datos.length - 1) && (
                <text x={x + bw / 2} y={alto - 8} textAnchor="middle">{d.x}</text>
              )}
              <rect x={m.l + i * step} y={m.t} width={step} height={ih} className="hit"
                onMouseMove={(ev) => mostrar(ev, d, i)} onMouseLeave={() => { setSobre(null); setTip(null) }} />
            </g>
          )
        })}
        <line x1={m.l} x2={W - m.r} y1={m.t + ih} y2={m.t + ih} className="base" />
        {referencia && (
          <>
            <line x1={m.l + referencia.i * step} x2={m.l + referencia.i * step} y1={m.t - 6} y2={m.t + ih} className="ref" />
            <text x={m.l + referencia.i * step + (referencia.izquierda ? -6 : 6)} y={m.t - 10} className="ref-t" textAnchor={referencia.izquierda ? 'end' : 'start'}>{referencia.texto}</text>
          </>
        )}
      </svg>
      {tip && <div className="col-tip" style={{ left: tip.x, top: tip.y }}>{tip.contenido}</div>}
    </div>
  )
}

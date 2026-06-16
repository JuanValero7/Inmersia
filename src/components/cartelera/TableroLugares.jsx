// Formato: Plain JavaScript (.jsx)
// Tablero de Lugares: una capa "verde" cubre la imagen (imageUrl) y se va
// raspando en manchas dispersas según el porcentaje, revelándola. Sólo el lienzo.
import { useEffect, useRef } from 'react'
import { rng } from './carteleraHelpers.js'

const BOARD_W = 700, BOARD_H = 860

function smooth(t) { return t * t * (3 - 2 * t) }
function valueNoise(cols, rows, rand) {
  const g = []
  for (let j = 0; j <= rows; j++) { g[j] = []; for (let i = 0; i <= cols; i++) g[j][i] = rand() }
  return (u, v) => {
    const fx = u * cols, fy = v * rows
    let x0 = Math.floor(fx), y0 = Math.floor(fy)
    if (x0 >= cols) x0 = cols - 1; if (y0 >= rows) y0 = rows - 1
    const tx = smooth(fx - x0), ty = smooth(fy - y0)
    const a = g[y0][x0], b = g[y0][x0 + 1], c = g[y0 + 1][x0], d = g[y0 + 1][x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
  }
}

function buildField(W, H) {
  const r = rng(20260602)
  const macro = valueNoise(7, 9, r)
  const mid = valueNoise(19, 23, r)
  const fine = valueNoise(64, 78, r)
  const f = new Float32Array(W * H)
  let mn = Infinity, mx = -Infinity
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      const val = macro(u, v) * 0.60 + mid(u, v) * 0.27 + fine(u, v) * 0.13
      f[y * W + x] = val; if (val < mn) mn = val; if (val > mx) mx = val
    }
  }
  const inv = 1 / (mx - mn)
  for (let i = 0; i < f.length; i++) f[i] = (f[i] - mn) * inv
  return f
}

// El campo de ruido y el "manto" usan seeds fijos → el resultado es idéntico
// en cada render. Se cachean a nivel de módulo para no recalcular ~600k px en
// cada montaje (incluidas las miniaturas del corcho de Notas).
let _fieldCache = null, _coatCache = null
function getField(W, H) { if (!_fieldCache) _fieldCache = buildField(W, H); return _fieldCache }
function getCoat(W, H) { if (!_coatCache) _coatCache = buildCoat(W, H); return _coatCache }

function buildCoat(W, H) {
  const r = rng(77713)
  const px = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      const sheen = ((1 - u) * 0.5 + (1 - v) * 0.5 - 0.5) * 24
      const grain = (r() - 0.5) * 18
      let rr = 32 + sheen * 0.85 + grain
      let gg = 60 + sheen * 1.05 + grain
      let bb = 53 + sheen * 0.95 + grain
      if (r() < 0.016) { rr += 42; gg += 50; bb += 44 }
      const i = (y * W + x) * 4
      px[i] = rr; px[i + 1] = gg; px[i + 2] = bb; px[i + 3] = 255
    }
  }
  return px
}

function Reveal({ percent }) {
  const cvs = useRef(null)
  const fieldRef = useRef(null)
  const coatRef = useRef(null)
  const ready = useRef(false)

  function paint(pct) {
    const cnv = cvs.current; if (!cnv || !ready.current) return
    const ctx = cnv.getContext('2d')
    const field = fieldRef.current, coat = coatRef.current
    const W = BOARD_W, H = BOARD_H, n = W * H
    const T = (pct / 100) * 1.06 - 0.03
    const feather = 0.012, rimW = 0.032
    const img = ctx.createImageData(W, H)
    const d = img.data
    for (let i = 0; i < n; i++) {
      const f = field[i]; const j = i * 4
      let a
      if (f <= T - feather) a = 0
      else if (f >= T) a = 255
      else a = ((f - (T - feather)) / feather) * 255
      d[j] = coat[j]; d[j + 1] = coat[j + 1]; d[j + 2] = coat[j + 2]
      if (a > 4 && f < T + rimW) {
        const k = 1 - (f - T) / rimW
        if (k > 0) { d[j] += k * 36; d[j + 1] += k * 44; d[j + 2] += k * 38 }
      }
      d[j + 3] = a
    }
    ctx.putImageData(img, 0, 0)
  }

  useEffect(() => {
    const cnv = cvs.current; cnv.width = BOARD_W; cnv.height = BOARD_H
    fieldRef.current = getField(BOARD_W, BOARD_H)
    coatRef.current = getCoat(BOARD_W, BOARD_H)
    ready.current = true
    paint(percent)
  }, [])
  useEffect(() => { paint(percent) }, [percent])

  return <canvas ref={cvs} className="cart-coat" />
}

export default function TableroLugares({ pct = 0, scale = 1, imageUrl, videoUrl, onOpenList }) {
  const containerStyle = { width: BOARD_W, height: BOARD_H, transform: `scale(${scale})`, cursor: onOpenList ? 'pointer' : 'default' }

  if (pct >= 100 && videoUrl) {
    return (
      <div className="cart-canvas cart-board" style={containerStyle} onClick={onOpenList} title={onOpenList ? 'Ver la lista' : undefined}>
        <video src={videoUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }

  return (
    <div className="cart-canvas cart-board" style={containerStyle} onClick={onOpenList} title={onOpenList ? 'Ver la lista' : undefined}>
      <div className="cart-foto">
        {imageUrl ? <img src={imageUrl} alt="" /> : <div className="cart-foto-empty" />}
      </div>
      <Reveal percent={Math.max(0, Math.min(100, pct))} />
    </div>
  )
}

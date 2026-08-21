// Formato: Plain JavaScript (.jsx)
// LANDING MOBILE de la Cartelera: re-flow del corcho apaisado del desktop
// (CarteleraLanding.jsx) a un lienzo 2×2 casi cuadrado con la hoja de
// predicciones al centro y las cuatro zonas en los cuadrantes. Mismo lenguaje
// visual — corcho, marco de madera, hilos rojos, placas, chips, placeholders
// que crecen con el avance. Reusa las piezas compartidas (carteleraZonas) y el
// corcho base (TableroNotas), igual que el desktop; sólo cambia la disposición.
//
// Modo de ajuste: 'fit' (todo a la vez, sin scroll — entra completo en pantalla)
// o 'scroll' (tablero a mayor tamaño y se recorre en vertical).
import { useState, useEffect, useRef } from 'react'
import { rng } from '../cartelera/carteleraHelpers.js'
import TableroNotas from '../cartelera/TableroNotas.jsx'
import TableroLugares from '../cartelera/TableroLugares.jsx'
import TableroPersonajes from '../cartelera/TableroPersonajes.jsx'
import TableroDatos from '../cartelera/TableroDatos.jsx'
import TableroHechos from '../cartelera/TableroHechos.jsx'
import {
  HECHOS_TYPES, HECHOS_SIZE, POLA_COLORS,
  threadChain, pick3,
  Pin, PassportPhoto, DocSheetCard, HechoItem, BlueprintBg, ZonePopup,
} from '../cartelera/carteleraZonas.jsx'

// ── Ajuste del tablero ──
const MODE = 'fit'               // 'fit' (todo a la vez, sin scroll) | 'scroll' (legible + scroll)
const IS_FIT = MODE === 'fit'

// ── Geometría 2×2 de la cartelera (folder al centro) ──────────────
// Lienzo casi cuadrado: cuatro zonas en cuadrantes alrededor de la hoja de
// predicciones central. Crece a lo ancho (no en una tira vertical) y entra
// completo en pantalla (MODE 'fit'). Mismo esquema que el desktop apaisado.
const BOARD_W = 860, BOARD_H = 1000
const FRAME = 16                 // grosor del marco de madera (px de tablero)
const COLS = 10, ROWS = 12
const SUB_W = 700                // ancho nativo de cada tablero (para escalar)

// Hoja de predicciones (hub): centro exacto del tablero
const CENTER = { cx: 430, cy: 500, w: 220, h: 234, rot: -3 }

// Alto reservado bajo la pizarra para el chip de su borde inferior
const HINT_ROOM = 34

// ── Zona PERSONAJES (cuadrante superior IZQUIERDO) ────────────────
const PERSON = { cx: 190, cy: 170 }
const PERSON_CHIP = { x: 120, y: 46 }
const PASS_W = 46, PASS_H = 58
const PASS_COLS = 5, PASS_ROWS = 2, PASS_TOTAL = PASS_COLS * PASS_ROWS   // 10
const PASS_PINS = ['#c23b2e', '#4a7fb5', '#5a8a78', '#e0b256']
const PASS_SLOTS = (() => {
  const ox = 70, oy = 120, gx = 58, gy = 72
  const out = []
  for (let row = 0; row < PASS_ROWS; row++) for (let col = 0; col < PASS_COLS; col++) {
    const i = row * PASS_COLS + col
    out.push({ x: ox + col * gx, y: oy + row * gy, pin: PASS_PINS[i % PASS_PINS.length] })
  }
  return out
})()
const PERSON_PLACA = { w: 104, h: Math.round(860 * 104 / 700), cx: 142, cy: 300, rot: 4 }
const PASS_AREA = (() => {
  const xs = PASS_SLOTS.map(s => s.x), ys = PASS_SLOTS.map(s => s.y)
  const pad = 12
  const x0 = Math.min(...xs) - PASS_W / 2 - pad, y0 = Math.min(...ys) - PASS_H / 2 - pad
  const x1 = Math.max(...xs) + PASS_W / 2 + pad, y1 = Math.max(...ys) + PASS_H / 2 + pad
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})()

// ── Zona LUGARES (mapa, cuadrante superior DERECHO) ───────────────
const MAP = { w: 284, h: 198, cx: 590, cy: 180, rot: 2.5 }
const MAP_TOP = MAP.cy - MAP.h / 2
const MAP_PLACA = { w: 100, h: Math.round(860 * 100 / 700), cx: 795, cy: 182, rot: -4 }
const PIN_SLOTS = (() => {
  const r = rng(910023)
  const out = []
  const m = 28
  let guard = 0
  while (out.length < 10 && guard++ < 500) {
    const x = m + r() * (MAP.w - m * 2)
    const y = m + r() * (MAP.h - m * 2)
    if (out.some(p => Math.hypot(p.x - x, p.y - y) < 38)) continue
    out.push({ x, y })
  }
  return out
})()

// ── Zona DATOS (cuadrante inferior IZQUIERDO) ─────────────────────
const DATOS = { cx: 190, cy: 820 }
const DATOS_CHIP = { x: 110, y: 662 }
const DATOS_PLACA = { w: MAP_PLACA.w, h: MAP_PLACA.h, cx: 356, cy: 812, rot: -3 }
const DOC_W = 104, DOC_H = 140, DOC_PER_COL = 4
const DOC_COL_X = [130, 252], DOC_TOP_Y = 694, DOC_OFF_Y = 38
const DOC_STACK = (() => {
  const r = rng(556677)
  return DOC_COL_X.map((cx, c) => {
    const sheets = []
    for (let i = 0; i < DOC_PER_COL; i++) {
      sheets.push({
        x: cx + (r() * 2 - 1) * 5,
        y: DOC_TOP_Y + DOC_H / 2 + i * DOC_OFF_Y + (r() * 2 - 1) * 3,
        rot: (r() * 2 - 1) * 4,
        pin: PASS_PINS[Math.floor(r() * PASS_PINS.length)],
        seed: 200 + c * 10 + i,
      })
    }
    return sheets
  })
})()
const DOC_FLAT = DOC_STACK.flatMap((col, c) => col.map((s, i) => ({ ...s, col: c, row: i })))
const DOC_PRIORITY = (() => { const r = rng(646464); return DOC_FLAT.map(() => r()) })()
const DATOS_AREA = (() => {
  const pad = 12
  const xs = DOC_FLAT.map(s => s.x), ys = DOC_FLAT.map(s => s.y)
  const x0 = Math.min(...xs) - DOC_W / 2 - pad, y0 = Math.min(...ys) - DOC_H / 2 - pad
  const x1 = Math.max(...xs) + DOC_W / 2 + pad, y1 = Math.max(...ys) + DOC_H / 2 + pad
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})()

// ── Zona HECHOS (cuadrante inferior DERECHO) ──────────────────────
const HECHOS_CHIP = { x: 566, y: 662 }
const HECHOS_PLACA = { w: MAP_PLACA.w, h: MAP_PLACA.h, cx: 805, cy: 812, rot: 3 }
const HECHOS_PLANO = { x: 462, y: 694, w: 286, h: 208, rot: -1.5 }
const HECHOS_SLOTS = (() => {
  const r = rng(778899)
  const cols = 3, rows = 3
  const x0 = 490, x1 = 712, y0 = 706, y1 = 880
  const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows
  const out = []
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const i = row * cols + col
    const type = HECHOS_TYPES[(col + row) % HECHOS_TYPES.length]
    const jx = (r() * 2 - 1) * 10, jy = (r() * 2 - 1) * 9
    const rot = (r() * 2 - 1) * 13
    const pin = PASS_PINS[Math.floor(r() * PASS_PINS.length)]
    const color = type === 'polaroid' ? POLA_COLORS[Math.floor(r() * POLA_COLORS.length)] : null
    out.push({ type, color, pin, rot, seed: 300 + i,
      x: x0 + (col + 0.5) * cw + jx, y: y0 + (row + 0.5) * ch + jy })
  }
  return out
})()
const HECHOS_PRIORITY = (() => { const r = rng(929292); return HECHOS_SLOTS.map(() => r()) })()
const HECHOS_AREA = (() => {
  const pad = 12
  const xs = [HECHOS_PLANO.x, HECHOS_PLANO.x + HECHOS_PLANO.w]
  const ys = [HECHOS_PLANO.y, HECHOS_PLANO.y + HECHOS_PLANO.h]
  HECHOS_SLOTS.forEach(s => {
    const { w, h } = HECHOS_SIZE[s.type]
    xs.push(s.x - w / 2 - pad, s.x + w / 2 + pad)
    ys.push(s.y - h / 2 - pad, s.y + h / 2 + pad)
  })
  const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})()

// ── Hilos rojos: cada zona → hoja de predicciones (hub central) ───
const PASS_PRIORITY = (() => { const r = rng(424242); return PASS_SLOTS.map(() => r()) })()
const PIN_PRIORITY  = (() => { const r = rng(535353); return PIN_SLOTS.map(() => r()) })()
const TIE_IN = 14
// Los cuadrantes superiores se atan al borde superior de la hoja; los
// inferiores, al borde inferior. Cada uno a su lado (izq/der) → hilos cortos.
const SHEET_TIE_PERSON = { x: CENTER.cx - CENTER.w / 2 + TIE_IN, y: CENTER.cy - 40 }
const SHEET_TIE_MAP    = { x: CENTER.cx + CENTER.w / 2 - TIE_IN, y: CENTER.cy - 40 }
const SHEET_TIE_DATOS  = { x: CENTER.cx - CENTER.w / 2 + TIE_IN, y: CENTER.cy + 48 }
const SHEET_TIE_HECHOS = { x: CENTER.cx + CENTER.w / 2 - TIE_IN, y: CENTER.cy + 48 }

// Punta absoluta de un pin del mapa (aplica el giro del mapa)
function pinAbs(p) {
  const lx = MAP.cx - MAP.w / 2 + p.x, ly = MAP.cy - MAP.h / 2 + p.y
  const a = MAP.rot * Math.PI / 180, dx = lx - MAP.cx, dy = ly - MAP.cy
  return { x: MAP.cx + dx * Math.cos(a) - dy * Math.sin(a), y: MAP.cy + dx * Math.sin(a) + dy * Math.cos(a) }
}
function docPinAbs(s) {
  const a = s.rot * Math.PI / 180, dy = -DOC_H / 2 + 8
  return { x: s.x - dy * Math.sin(a), y: s.y + dy * Math.cos(a) }
}
function hechoPinAbs(it) {
  const { h } = HECHOS_SIZE[it.type]
  const a = it.rot * Math.PI / 180, dy = -h / 2 + 6
  return { x: it.x - dy * Math.sin(a), y: it.y + dy * Math.cos(a) }
}

// Escala el tablero fijo (vertical) según el modo. En 'scroll' encaja al ancho
// y el alto define el recorrido; en 'fit' entra completo.
// `reservaAbajo`: alto libre debajo del tablero para el chip que se monta sobre
// su borde inferior (ver .cart-board-hint), igual que en el desktop.
function useBoardScale(totalW, totalH, reservaAbajo = 0) {
  const ref = useRef(null)
  const [scale, setScale] = useState(0.5)
  useEffect(() => {
    const el = ref.current; if (!el) return
    let raf = null
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w) return
      const s = MODE === 'fit'
        ? Math.min((w - 8) / totalW, (h - 8 - reservaAbajo) / totalH)
        : (w - 8) / totalW
      setScale(Math.max(0.2, Math.min(s, 1)))
    }
    const onResize = () => { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(fit) }
    fit()
    const ro = new ResizeObserver(onResize); ro.observe(el)
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [totalW, totalH, reservaAbajo])
  return [ref, scale]
}

export default function CarteleraLandingMobile({ data, esNoficcion = false, onOpenSection }) {
  const TOTAL_W = BOARD_W + FRAME * 2
  const TOTAL_H = BOARD_H + FRAME * 2
  const [scrollRef, scale] = useBoardScale(TOTAL_W, TOTAL_H, HINT_ROOM)
  const [popup, setPopup] = useState(null)   // 'personajes' | 'lugares' | 'datos' | 'hechos' | null

  const pct = data.porcentaje

  const mapSeccion = esNoficcion ? 'datos' : 'lugares'
  const mapLabel = esNoficcion ? 'Datos' : 'Lugares'
  const mapImg = data.principal?.[mapSeccion]

  const personSeccion = esNoficcion ? 'glosario' : 'personajes'
  const personLabel = esNoficcion ? 'Glosario' : 'Personajes'
  const personImg = data.principal?.[personSeccion]

  const datosSeccion = esNoficcion ? 'resumen' : 'datos'
  const datosLabel = esNoficcion ? 'Resumen' : 'Datos'

  const hechosSeccion = esNoficcion ? 'referencias' : 'hechos'
  const hechosLabel = esNoficcion ? 'Referencias' : 'Hechos'
  const hechosImg = data.principal?.[hechosSeccion]

  // Embeds fantasma: sólo posicionan el hub; corcho sin notas ni hilos propios.
  const embedsForNotas = [
    { key: personSeccion, label: personLabel, cx: PERSON.cx, cy: PERSON.cy, phantom: true },
    { key: mapSeccion, label: mapLabel, cx: MAP.cx, cy: MAP.cy, phantom: true },
    { key: datosSeccion, label: datosLabel, cx: DATOS.cx, cy: DATOS.cy, phantom: true },
    { key: hechosSeccion, label: hechosLabel, cx: 600, cy: 800, phantom: true },
  ]

  const visiblePins = PIN_SLOTS.slice(0, Math.min(10, Math.floor(pct / 10)))
  const visiblePass = PASS_SLOTS.slice(0, Math.min(PASS_TOTAL, Math.round(pct / 10)))
  const visiblePerCol = Math.min(DOC_PER_COL, Math.round(pct / 100 * DOC_PER_COL))
  const visibleHechos = HECHOS_SLOTS.slice(0, Math.round(pct / 100 * HECHOS_SLOTS.length))

  const goPerson = () => onOpenSection(personSeccion)
  const goMap = () => onOpenSection(mapSeccion)
  const goDatos = () => onOpenSection(datosSeccion)
  const goHechos = () => onOpenSection(hechosSeccion)

  const personThreads = (() => {
    const n = visiblePass.length
    if (n === 0) return []
    const idx = n >= 3 ? pick3(n, PASS_PRIORITY) : [0]
    return threadChain(SHEET_TIE_PERSON, idx.map(i => ({ x: visiblePass[i].x, y: visiblePass[i].y - PASS_H / 2 + 8 })))
  })()
  const mapThreads = (() => {
    const m = visiblePins.length
    if (m === 0) return []
    const idx = m >= 3 ? pick3(m, PIN_PRIORITY) : [...Array(m).keys()]
    return threadChain(SHEET_TIE_MAP, idx.map(i => pinAbs(visiblePins[i])))
  })()
  const datosThreads = (() => {
    const vis = DOC_FLAT.map((s, i) => i).filter(i => DOC_FLAT[i].row < visiblePerCol)
    if (vis.length === 0) return []
    const chosen = vis.length >= 3
      ? [...vis].sort((a, b) => DOC_PRIORITY[a] - DOC_PRIORITY[b]).slice(0, 3)
      : vis
    return threadChain(SHEET_TIE_DATOS, chosen.map(i => docPinAbs(DOC_FLAT[i])))
  })()
  const hechosThreads = (() => {
    const n = visibleHechos.length
    if (n === 0) return []
    const idx = n >= 3 ? pick3(n, HECHOS_PRIORITY) : [...Array(n).keys()]
    return threadChain(SHEET_TIE_HECHOS, idx.map(i => hechoPinAbs(visibleHechos[i])))
  })()

  return (
    <div className="cml-wrap cart-landing">
      <div className={`cml-scroll${IS_FIT ? ' is-fit' : ''}`} ref={scrollRef}>
        <div className="cml-sizer" style={{ width: TOTAL_W * scale, height: TOTAL_H * scale }}>
          <div className="cart-landing-frame cml-frame"
            style={{ width: BOARD_W, height: BOARD_H, padding: FRAME, transform: `scale(${scale})` }}>
            <div className="cart-landing-inner" style={{ width: BOARD_W, height: BOARD_H }}>
              <TableroNotas
                pct={pct} scale={1}
                principal={data.principal} stats={data.stats}
                esNoficcion={esNoficcion}
                notasItems={data.itemsBySeccion?.notas || []}
                onOpenSection={onOpenSection}
                onOpenNotas={() => onOpenSection('notas')}
                boardW={BOARD_W} boardH={BOARD_H} cols={COLS} rows={ROWS}
                embeds={embedsForNotas} center={CENTER} decorNotas={false} threads={false} />

              {/* Hilos rojos: cada zona → hoja de predicciones. Pasan por detrás
                  de las superficies grandes (placas, hub, mapa, plano) vía máscara. */}
              <svg className="cart-threads" width={BOARD_W} height={BOARD_H} style={{ zIndex: 9 }}>
                <defs>
                  <mask id="cmlThreadMask">
                    <rect x="0" y="0" width={BOARD_W} height={BOARD_H} fill="#fff" />
                    {[PERSON_PLACA, MAP_PLACA, DATOS_PLACA, HECHOS_PLACA, CENTER].map((p, i) => (
                      <rect key={i} x={p.cx - p.w / 2} y={p.cy - p.h / 2} width={p.w} height={p.h}
                        transform={`rotate(${p.rot} ${p.cx} ${p.cy})`} fill="#000" />
                    ))}
                    <rect x={MAP.cx - MAP.w / 2} y={MAP.cy - MAP.h / 2} width={MAP.w} height={MAP.h}
                      transform={`rotate(${MAP.rot} ${MAP.cx} ${MAP.cy})`} fill="#000" />
                    <rect x={HECHOS_PLANO.x} y={HECHOS_PLANO.y} width={HECHOS_PLANO.w} height={HECHOS_PLANO.h}
                      transform={`rotate(${HECHOS_PLANO.rot} ${HECHOS_PLANO.x + HECHOS_PLANO.w / 2} ${HECHOS_PLANO.y + HECHOS_PLANO.h / 2})`} fill="#000" />
                  </mask>
                </defs>
                <g mask="url(#cmlThreadMask)">
                  {[...personThreads, ...mapThreads, ...datosThreads, ...hechosThreads].map((d, i) => (
                    <path key={i} d={d} fill="none" stroke="#c23b2e" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
                  ))}
                </g>
              </svg>

              {/* ── ZONA PERSONAJES ── */}
              <button type="button" className="cart-zone-tag" style={{ left: PERSON_CHIP.x, top: PERSON_CHIP.y, '--tag': '#d56a52', '--tape-rot': '-2.5deg' }}
                onClick={goPerson}>{personLabel}</button>
              {visiblePass.map((s, i) => <PassportPhoto key={i} s={s} />)}
              <button type="button" className="cart-pass-zone" aria-label={`Ver ${personLabel.toLowerCase()}`}
                style={{ left: PASS_AREA.x, top: PASS_AREA.y, width: PASS_AREA.w, height: PASS_AREA.h }}
                onClick={goPerson} />
              <div className="cart-placa-holder"
                style={{ left: PERSON_PLACA.cx, top: PERSON_PLACA.cy, width: PERSON_PLACA.w, height: PERSON_PLACA.h }}>
                <button type="button" className="cart-placa" style={{ width: PERSON_PLACA.w, height: PERSON_PLACA.h, '--rot': `${PERSON_PLACA.rot}deg` }}
                  onClick={() => setPopup('personajes')} aria-label="Ver el retrato desbloqueado">
                  <span className="cart-placa-pin" />
                  <div className="cart-placa-clip">
                    <TableroPersonajes pct={pct} scale={PERSON_PLACA.w / SUB_W} imageUrl={personImg?.url} />
                  </div>
                </button>
              </div>

              {/* ── ZONA LUGARES (mapa) ── */}
              <button type="button" className="cart-zone-tag" style={{ left: MAP.cx, top: MAP_TOP - 24, '--tag': '#7C8A4F', '--tape-rot': '2deg' }}
                onClick={goMap}>{mapLabel}</button>
              <button type="button" className="cart-map"
                style={{ left: MAP.cx, top: MAP.cy, width: MAP.w, height: MAP.h,
                  transform: `translate(-50%,-50%) rotate(${MAP.rot}deg)` }}
                onClick={goMap} aria-label={`Ver lista de ${mapLabel.toLowerCase()}`}>
                <span className="cart-map-pin" />
                <img src="/assets/cartelera/mapa-placeholder.svg" alt="Mapa" draggable="false" />
                {visiblePins.map((p, i) => <Pin key={i} x={p.x} y={p.y} />)}
              </button>
              <div className="cart-placa-holder"
                style={{ left: MAP_PLACA.cx, top: MAP_PLACA.cy, width: MAP_PLACA.w, height: MAP_PLACA.h }}>
                <button type="button" className="cart-placa" style={{ width: MAP_PLACA.w, height: MAP_PLACA.h, '--rot': `${MAP_PLACA.rot}deg` }}
                  onClick={() => setPopup('lugares')} aria-label="Ver la imagen desbloqueada">
                  <span className="cart-placa-pin" />
                  <div className="cart-placa-clip">
                    <TableroLugares pct={pct} scale={MAP_PLACA.w / SUB_W} imageUrl={mapImg?.url} />
                  </div>
                </button>
              </div>

              {/* ── ZONA DATOS ── */}
              <button type="button" className="cart-zone-tag" style={{ left: DATOS_CHIP.x, top: DATOS_CHIP.y, '--tag': '#2F4A6B', '--tape-rot': '-1.5deg' }}
                onClick={goDatos}>{datosLabel}</button>
              {DOC_STACK.map((col, c) => col.slice(0, visiblePerCol).map((s, i) => (
                <DocSheetCard key={`${c}-${i}`} s={s} z={6 + i} />
              )))}
              <button type="button" className="cart-pass-zone" aria-label={`Ver ${datosLabel.toLowerCase()}`}
                style={{ left: DATOS_AREA.x, top: DATOS_AREA.y, width: DATOS_AREA.w, height: DATOS_AREA.h }}
                onClick={goDatos} />
              <div className="cart-placa-holder"
                style={{ left: DATOS_PLACA.cx, top: DATOS_PLACA.cy, width: DATOS_PLACA.w, height: DATOS_PLACA.h }}>
                <button type="button" className="cart-placa" style={{ width: DATOS_PLACA.w, height: DATOS_PLACA.h, '--rot': `${DATOS_PLACA.rot}deg` }}
                  onClick={() => setPopup('datos')} aria-label="Ver los datos desbloqueados">
                  <span className="cart-placa-pin" />
                  <div className="cart-placa-clip">
                    <TableroDatos pct={pct} scale={DATOS_PLACA.w / SUB_W} stats={data.stats} />
                  </div>
                </button>
              </div>

              {/* ── ZONA HECHOS ── */}
              <BlueprintBg rect={HECHOS_PLANO} />
              <button type="button" className="cart-zone-tag" style={{ left: HECHOS_CHIP.x, top: HECHOS_CHIP.y, '--tag': '#A9772E', '--tape-rot': '2.5deg' }}
                onClick={goHechos}>{hechosLabel}</button>
              {visibleHechos.map((it, i) => <HechoItem key={i} it={it} />)}
              <button type="button" className="cart-pass-zone" aria-label={`Ver ${hechosLabel.toLowerCase()}`}
                style={{ left: HECHOS_AREA.x, top: HECHOS_AREA.y, width: HECHOS_AREA.w, height: HECHOS_AREA.h }}
                onClick={goHechos} />
              <div className="cart-placa-holder"
                style={{ left: HECHOS_PLACA.cx, top: HECHOS_PLACA.cy, width: HECHOS_PLACA.w, height: HECHOS_PLACA.h }}>
                <button type="button" className="cart-placa" style={{ width: HECHOS_PLACA.w, height: HECHOS_PLACA.h, '--rot': `${HECHOS_PLACA.rot}deg` }}
                  onClick={() => setPopup('hechos')} aria-label="Ver la imagen desbloqueada">
                  <span className="cart-placa-pin" />
                  <div className="cart-placa-clip">
                    <TableroHechos pct={pct} scale={HECHOS_PLACA.w / SUB_W} imageUrl={hechosImg?.url} />
                  </div>
                </button>
              </div>
            </div>
            {/* A caballo sobre el borde inferior del marco, con la escala
                inversa para que el texto no encoja con el tablero. */}
            <div className="cart-board-hint" style={{ transform: `translate(-50%, 50%) scale(${1 / scale})` }}>
              Toca una categoría para ver los detalles
            </div>
          </div>
        </div>
      </div>

      <div className="cml-avance">
        <span className="cml-avance-lbl">Avance de lectura</span>
        <div className="cml-avance-bar"><span style={{ width: `${pct}%` }} /></div>
        <span className="cml-avance-pct">{pct}%</span>
      </div>

      {popup === 'lugares' && (
        <ZonePopup title={`${mapLabel} · ${pct}% desbloqueado`} listLabel={`Ver lista de ${mapLabel.toLowerCase()}`}
          onOpenList={() => { setPopup(null); goMap() }} onClose={() => setPopup(null)}
          media={<div style={{ width: 280, height: Math.round(860 * 280 / 700) }}>
            <TableroLugares pct={pct} scale={280 / SUB_W} imageUrl={mapImg?.url} videoUrl={mapImg?.videoUrl} />
          </div>} />
      )}
      {popup === 'personajes' && (
        <ZonePopup title={`${personLabel} · ${pct}% desbloqueado`} listLabel={`Ver lista de ${personLabel.toLowerCase()}`}
          onOpenList={() => { setPopup(null); goPerson() }} onClose={() => setPopup(null)}
          media={<div style={{ width: 280, height: Math.round(860 * 280 / 700) }}>
            <TableroPersonajes pct={pct} scale={280 / SUB_W} imageUrl={personImg?.url} videoUrl={personImg?.videoUrl} />
          </div>} />
      )}
      {popup === 'datos' && (
        <ZonePopup title={`${datosLabel} · ${pct}% desbloqueado`} listLabel={`Ver lista de ${datosLabel.toLowerCase()}`}
          onOpenList={() => { setPopup(null); goDatos() }} onClose={() => setPopup(null)}
          media={<div style={{ width: 280, height: Math.round(860 * 280 / 700) }}>
            <TableroDatos pct={pct} scale={280 / SUB_W} stats={data.stats} />
          </div>} />
      )}
      {popup === 'hechos' && (
        <ZonePopup title={`${hechosLabel} · ${pct}% desbloqueado`} listLabel={`Ver lista de ${hechosLabel.toLowerCase()}`}
          onOpenList={() => { setPopup(null); goHechos() }} onClose={() => setPopup(null)}
          media={<div style={{ width: 280, height: Math.round(860 * 280 / 700) }}>
            <TableroHechos pct={pct} scale={280 / SUB_W} imageUrl={hechosImg?.url} videoUrl={hechosImg?.videoUrl} />
          </div>} />
      )}
    </div>
  )
}

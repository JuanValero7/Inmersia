// Formato: Plain JavaScript (.jsx)
// Landing de la sección Investigación: una CARTELERA apaisada (más ancha que
// alta) con marco de madera oscuro (mismo tratamiento que los estantes de
// Biblioteca) que reusa el corcho (TableroNotas) en formato horizontal.
//
// Dos "zonas ricas" en la fila de arriba, con el mismo patrón:
//   · PERSONAJES = grid alineado de fotos tipo pasaporte (siluetas placeholder
//     que se agregan con el avance, hasta 10) + placa polaroid (retrato que se
//     revela con el mismo desbloqueo por polaroids) + chip.
//   · LUGARES  = mapa + pines que crecen con el avance + placa (imagen única
//     que se destapa) en la esquina + chip.
// En ambas: todo → lista de la sección; placa → pop-up. Se tejen a los hilos
// del corcho con un embed "phantom".
import { useState, useEffect, useRef } from 'react'
import { rng } from './carteleraHelpers.js'
import TableroNotas from './TableroNotas.jsx'
import TableroLugares from './TableroLugares.jsx'
import TableroPersonajes from './TableroPersonajes.jsx'
import TableroDatos from './TableroDatos.jsx'
import TableroHechos from './TableroHechos.jsx'
import ExplorarPopup from './ExplorarPopup.jsx'
import {
  HECHOS_TYPES, HECHOS_SIZE, POLA_COLORS,
  threadChain, pick3,
  Pin, PassportPhoto, DocSheetCard, HechoItem, BlueprintBg, ZonePopup,
} from './carteleraZonas.jsx'

// Geometría de la cartelera (coordenadas internas del corcho)
const BOARD_W = 1180, BOARD_H = 720
const FRAME = 26              // grosor del marco de madera (px de tablero)
const COLS = 13, ROWS = 8
const SUB_W = 700             // ancho nativo de cada tablero (para escalar)

// Las cuatro secciones son zonas ricas propias; el embed de Hechos/Referencias
// queda "phantom" (sólo teje los hilos del corcho, ya no se dibuja miniatura).
const EMBEDS_FICCION = [
  { key: 'hechos', label: 'Hechos', cx: 800, cy: 495, rot: 4, pin: '#e0b256', phantom: true },
]
const EMBEDS_NOFICCION = [
  { key: 'referencias', label: 'Referencias', cx: 800, cy: 495, rot: 4, pin: '#e0b256', phantom: true },
]

const CENTER = { cx: 592, cy: 372, w: 236, h: 252, rot: -3 }

// Alto reservado bajo la pizarra para el chip que se monta en su borde inferior
const HINT_ROOM = 40

// ── Zona LUGARES (mapa, esquina superior derecha) ─────────────────
const MAP = { w: 300, h: 210, cx: 985, cy: 170, rot: 2.5 }
const MAP_TOP = MAP.cy - MAP.h / 2
const MAP_PLACA = { w: 112, h: Math.round(860 * 112 / 700), cx: 858, cy: 258, rot: -4 }

// Hasta 10 posiciones estables de pines dentro del mapa (evitan la esquina de la placa)
const PIN_SLOTS = (() => {
  const r = rng(910023)
  const out = []
  const m = 30
  let guard = 0
  while (out.length < 10 && guard++ < 500) {
    const x = m + r() * (MAP.w - m * 2)
    const y = m + r() * (MAP.h - m * 2)
    if (x < 108 && y > MAP.h - 100) continue            // esquina de la placa
    if (out.some(p => Math.hypot(p.x - x, p.y - y) < 40)) continue
    out.push({ x, y })
  }
  return out
})()

// ── Zona PERSONAJES (esquina superior izquierda) ──────────────────
const PERSON = { cx: 245, cy: 166 }
const PERSON_CHIP = { x: 190, y: 74 }
const PASS_W = 46, PASS_H = 58
const PASS_COLS = 5, PASS_ROWS = 2, PASS_TOTAL = PASS_COLS * PASS_ROWS   // 10
const PASS_PINS = ['#c23b2e', '#4a7fb5', '#5a8a78', '#e0b256']
// grid alineado 5×2 de fotos pasaporte (se llenan en orden con el avance)
const PASS_SLOTS = (() => {
  const ox = 78, oy = 122, gx = 56, gy = 70
  const out = []
  for (let row = 0; row < PASS_ROWS; row++) for (let col = 0; col < PASS_COLS; col++) {
    const i = row * PASS_COLS + col
    out.push({ x: ox + col * gx, y: oy + row * gy, pin: PASS_PINS[i % PASS_PINS.length] })
  }
  return out
})()
const PERSON_PLACA = { w: 110, h: Math.round(860 * 110 / 700), cx: 392, cy: 170, rot: 4 }
// Rectángulo que engloba TODAS las fotos → una sola zona clickeable (sin hover por foto)
const PASS_AREA = (() => {
  const xs = PASS_SLOTS.map(s => s.x), ys = PASS_SLOTS.map(s => s.y)
  const pad = 12
  const x0 = Math.min(...xs) - PASS_W / 2 - pad, y0 = Math.min(...ys) - PASS_H / 2 - pad
  const x1 = Math.max(...xs) + PASS_W / 2 + pad, y1 = Math.max(...ys) + PASS_H / 2 + pad
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})()

// ── Zona DATOS (inferior IZQUIERDA, debajo de Personajes) ─────────
// Placa de stats pegada a la IZQUIERDA (misma proporción/tamaño que la del
// mapa). A su derecha, dos columnas de documentos A4 apilados en cascada
// vertical que llenan el alto de la zona a medida que avanza la lectura.
const DATOS = { cx: 230, cy: 500 }
const DATOS_CHIP = { x: 120, y: 330 }
const DATOS_PLACA = { w: MAP_PLACA.w, h: MAP_PLACA.h, cx: 110, cy: 460, rot: -3 }
const DOC_W = 112, DOC_H = 150, DOC_PER_COL = 5
const DOC_COL_X = [250, 372], DOC_TOP_Y = 350, DOC_OFF_Y = 43
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
// Lista plana de documentos (con col/fila) + prioridad estable → hilo de Datos
const DOC_FLAT = DOC_STACK.flatMap((col, c) => col.map((s, i) => ({ ...s, col: c, row: i })))
const DOC_PRIORITY = (() => { const r = rng(646464); return DOC_FLAT.map(() => r()) })()
// Rectángulo que engloba TODOS los documentos → una sola zona clickeable de Datos
const DATOS_AREA = (() => {
  const pad = 12
  const xs = DOC_FLAT.map(s => s.x), ys = DOC_FLAT.map(s => s.y)
  const x0 = Math.min(...xs) - DOC_W / 2 - pad, y0 = Math.min(...ys) - DOC_H / 2 - pad
  const x1 = Math.max(...xs) + DOC_W / 2 + pad, y1 = Math.max(...ys) + DOC_H / 2 + pad
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})()

// ── Zona HECHOS (inferior DERECHA, debajo de Lugares) ─────────────
// Espejo de la zona Datos: la placa (fachada nocturna que revela ventanas) se
// pega a la DERECHA y, a su izquierda, un cluster de "evidencias" variadas
// (post-it, factura, nota de bloc y polaroid de fondo OPACO) que se prenden al
// corcho a medida que avanza la lectura. Misma estructura que las otras zonas:
// chip + placeholders por avance + placa. Grilla 3×3 con jitter.
const HECHOS_CHIP = { x: 1060, y: 330 }
const HECHOS_PLACA = { w: MAP_PLACA.w, h: MAP_PLACA.h, cx: 1070, cy: 460, rot: 3 }
const HECHOS_SLOTS = (() => {
  const r = rng(778899)
  const cols = 3, rows = 3
  // Arranca a la DERECHA del borde de la hoja de predicciones (x≈710) y termina
  // antes de la placa (x≈1014), para que las evidencias no pisen ni la hoja ni la placa.
  const x0 = 760, x1 = 970, y0 = 336, y1 = 660
  const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows
  const out = []
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const i = row * cols + col
    const type = HECHOS_TYPES[(col + row) % HECHOS_TYPES.length]   // diagonal → cada columna mezcla tipos
    const jx = (r() * 2 - 1) * 12, jy = (r() * 2 - 1) * 10
    const rot = (r() * 2 - 1) * 13
    const pin = PASS_PINS[Math.floor(r() * PASS_PINS.length)]
    const color = type === 'polaroid' ? POLA_COLORS[Math.floor(r() * POLA_COLORS.length)] : null
    out.push({ type, color, pin, rot, seed: 300 + i,
      x: x0 + (col + 0.5) * cw + jx, y: y0 + (row + 0.5) * ch + jy })
  }
  return out
})()
// Prioridad estable por evidencia → el hilo elige siempre las mismas 3 piezas
const HECHOS_PRIORITY = (() => { const r = rng(929292); return HECHOS_SLOTS.map(() => r()) })()
// Plano azul (blueprint) DETRÁS de las evidencias: apaisado (más ancho que alto).
// Borde derecho a la altura de donde termina el chip "Hechos" (x≈1115); borde
// izquierdo despegado de la hoja de predicciones (x≈710) para no tocarla.
const HECHOS_PLANO = { x: 760, y: 382, w: 355, h: 232, rot: -1.5 }
// Rectángulo que engloba TODO el bloque (plano azul + evidencias) → una sola
// zona clickeable de Hechos, con el mismo tratamiento que Personajes/Mapa.
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

// ── Hilos rojos del landing ───────────────────────────────────────
// Personajes: se amarra a 3 fotos al azar (o sólo a la primera si hay <3) y baja
// a la hoja de predicciones. Lugares: ídem entre pines. NO hay hilo entre zonas.
// Prioridad aleatoria pero ESTABLE por slot → la elección no salta en cada render.
const PASS_PRIORITY = (() => { const r = rng(424242); return PASS_SLOTS.map(() => r()) })()
const PIN_PRIORITY  = (() => { const r = rng(535353); return PIN_SLOTS.map(() => r()) })()
// Puntos donde se atan los hilos: SOBRE los bordes laterales de la carpeta
// (14px adentro) para que la cuerda llegue a tocar el borde y el tramo final
// se meta por detrás gracias a la máscara. Nada se ata arriba (pestaña/clip).
const TIE_IN = 14
const SHEET_TIE_PERSON = { x: CENTER.cx - CENTER.w / 2 + TIE_IN, y: CENTER.cy - 34 }  // borde izq, arriba
const SHEET_TIE_MAP    = { x: CENTER.cx + CENTER.w / 2 - TIE_IN, y: CENTER.cy - 34 }  // borde der, arriba
const SHEET_TIE_DATOS  = { x: CENTER.cx - CENTER.w / 2 + TIE_IN, y: CENTER.cy + 42 }  // borde izq, abajo
const SHEET_TIE_HECHOS = { x: CENTER.cx + CENTER.w / 2 - TIE_IN, y: CENTER.cy + 42 }  // borde der, abajo

// Punta absoluta (coords del tablero) de un pin del mapa: aplica el giro del mapa
function pinAbs(p) {
  const lx = MAP.cx - MAP.w / 2 + p.x, ly = MAP.cy - MAP.h / 2 + p.y
  const a = MAP.rot * Math.PI / 180, dx = lx - MAP.cx, dy = ly - MAP.cy
  return { x: MAP.cx + dx * Math.cos(a) - dy * Math.sin(a), y: MAP.cy + dx * Math.sin(a) + dy * Math.cos(a) }
}
// Punta del pin (arriba, centro) de un documento, aplicando su leve giro.
// Se ancla justo por DEBAJO del pin, igual que Personajes (pin por encima).
function docPinAbs(s) {
  const a = s.rot * Math.PI / 180, dy = -DOC_H / 2 + 8
  return { x: s.x - dy * Math.sin(a), y: s.y + dy * Math.cos(a) }
}
// Punta del pin (arriba, centro) de una evidencia de Hechos, según su tipo/giro.
function hechoPinAbs(it) {
  const { h } = HECHOS_SIZE[it.type]
  const a = it.rot * Math.PI / 180, dy = -h / 2 + 6
  return { x: it.x - dy * Math.sin(a), y: it.y + dy * Math.cos(a) }
}
// `reservaAbajo`: alto que hay que dejar libre debajo del tablero para el chip
// que se monta sobre su borde inferior (ver .cart-board-hint). Coincide con el
// padding inferior de .cart-landing-stage, que clientHeight sí incluye.
function useFitScale(ref, totalW, totalH, reservaAbajo = 0) {
  const [scale, setScale] = useState(0.5)
  useEffect(() => {
    let rafId = null
    const fit = () => {
      const el = ref.current; if (!el) return
      const alto = el.clientHeight - reservaAbajo
      setScale(Math.max(0.2, Math.min(el.clientWidth / totalW, alto / totalH) * 0.98))
    }
    const onResize = () => { if (rafId) cancelAnimationFrame(rafId); rafId = requestAnimationFrame(fit) }
    fit()
    const ro = new ResizeObserver(onResize)
    if (ref.current) ro.observe(ref.current)
    return () => { ro.disconnect(); if (rafId) cancelAnimationFrame(rafId) }
  }, [ref, totalW, totalH, reservaAbajo])
  return scale
}

// TEMPORAL: para probar la composición sólo con Personajes y Lugares. Poner en
// true para volver a mostrar las zonas Datos y Hechos (y sus hilos/popups).
const SHOW_DATOS = true
const SHOW_HECHOS = true

export default function CarteleraLanding({
  subtitle, data, esNoficcion = false,
  onOpenSection, onOpenList, onGoBack, onGoForo, onGoBiblioteca,
}) {
  const stageRef = useRef(null)
  const TOTAL_W = BOARD_W + FRAME * 2
  const TOTAL_H = BOARD_H + FRAME * 2
  const scale = useFitScale(stageRef, TOTAL_W, TOTAL_H, HINT_ROOM)
  const [popup, setPopup] = useState(null)       // 'lugares' | 'personajes' | null

  // El tutorial (paso 'investigacion') se pinta desde Cartelera.jsx, que
  // sobrevive al cambio landing ⇄ ficha.

  const embeds = esNoficcion ? EMBEDS_NOFICCION : EMBEDS_FICCION
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

  // Embeds fantasma (centro de cada zona): sólo tejen los hilos hacia ellas
  const embedsForNotas = [
    ...(SHOW_HECHOS ? embeds : []),
    { key: personSeccion, label: personLabel, cx: PERSON.cx, cy: PERSON.cy, phantom: true },
    { key: mapSeccion, label: mapLabel, cx: MAP.cx, cy: MAP.cy, phantom: true },
    ...(SHOW_DATOS ? [{ key: datosSeccion, label: datosLabel, cx: DATOS.cx, cy: DATOS.cy, phantom: true }] : []),
  ]

  const visiblePins = PIN_SLOTS.slice(0, Math.min(10, Math.floor(pct / 10)))
  const visiblePass = PASS_SLOTS.slice(0, Math.min(PASS_TOTAL, Math.round(pct / 10)))
  const visiblePerCol = Math.min(DOC_PER_COL, Math.round(pct / 100 * DOC_PER_COL))
  const visibleHechos = HECHOS_SLOTS.slice(0, Math.round(pct / 100 * HECHOS_SLOTS.length))

  const goListMap = () => onOpenList(mapSeccion)
  const goListPerson = () => onOpenList(personSeccion)
  const goListDatos = () => onOpenList(datosSeccion)
  const goListHechos = () => onOpenList(hechosSeccion)

  // Hilo de Personajes: 3 fotos al azar (o sólo la primera si hay <3) → hoja.
  // Se amarra justo POR DEBAJO del pin (borde inferior de la chincheta), así la
  // cuerda sale desde abajo y el pin queda por encima, no la cuerda sobre el pin.
  const personThreads = (() => {
    const n = visiblePass.length
    if (n === 0) return []
    const idx = n >= 3 ? pick3(n, PASS_PRIORITY) : [0]
    return threadChain(SHEET_TIE_PERSON, idx.map(i => ({ x: visiblePass[i].x, y: visiblePass[i].y - PASS_H / 2 + 8 })))
  })()
  // Hilo de Lugares: 3 pines al azar (o los que haya si hay <3) → hoja
  const mapThreads = (() => {
    const m = visiblePins.length
    if (m === 0) return []
    const idx = m >= 3 ? pick3(m, PIN_PRIORITY) : [...Array(m).keys()]
    return threadChain(SHEET_TIE_MAP, idx.map(i => pinAbs(visiblePins[i])))
  })()
  // Hilo de Datos: 3 pines de documentos (o los que haya) → hoja de predicciones
  const datosThreads = (() => {
    if (!SHOW_DATOS) return []
    const vis = DOC_FLAT.map((s, i) => i).filter(i => DOC_FLAT[i].row < visiblePerCol)
    if (vis.length === 0) return []
    const chosen = vis.length >= 3
      ? [...vis].sort((a, b) => DOC_PRIORITY[a] - DOC_PRIORITY[b]).slice(0, 3)
      : vis
    return threadChain(SHEET_TIE_DATOS, chosen.map(i => docPinAbs(DOC_FLAT[i])))
  })()
  // Hilo de Hechos: 3 evidencias (o las que haya) → hoja de predicciones
  const hechosThreads = (() => {
    if (!SHOW_HECHOS) return []
    const n = visibleHechos.length
    if (n === 0) return []
    const idx = n >= 3 ? pick3(n, HECHOS_PRIORITY) : [...Array(n).keys()]
    return threadChain(SHEET_TIE_HECHOS, idx.map(i => hechoPinAbs(visibleHechos[i])))
  })()

  return (
    <div className="cart-scene cart-landing">
      <div className="topbar" style={{ zIndex: 61 }}>
        <div className="cart-portada-tag">
          <span className="cpt-label">Investigación</span>
          {subtitle && <><span className="cpt-sep">·</span><span className="cpt-book">{subtitle}</span></>}
        </div>
        <div className="cart-portada-hint">El tablero de tu investigación</div>
        <div className="actions">
          <ExplorarPopup onGoForo={onGoForo} onGoBack={onGoBack} onGoBiblioteca={onGoBiblioteca} btnClass="back-btn" />
        </div>
      </div>

      <div className="cart-landing-stage" ref={stageRef}>
        <div className="cart-landing-frame"
          style={{ width: BOARD_W, height: BOARD_H, padding: FRAME, transform: `scale(${scale})` }}>
          <div className="cart-landing-inner" style={{ width: BOARD_W, height: BOARD_H }}>
            <TableroNotas
              pct={pct} scale={1}
              principal={data.principal} stats={data.stats}
              esNoficcion={esNoficcion}
              notasItems={data.itemsBySeccion?.notas || []}
              onOpenSection={onOpenSection}
              onOpenNotas={() => onOpenList('notas')}
              boardW={BOARD_W} boardH={BOARD_H} cols={COLS} rows={ROWS}
              embeds={embedsForNotas} center={CENTER} decorNotas={false} threads={false} />

            {/* Hilos rojos propios de la landing: cada zona → hoja de predicciones,
                sin hilo entre zonas. Van por encima del mapa (z:9) para verse.
                La máscara recorta el hilo dentro del rectángulo de cada placa, para
                que pase POR DETRÁS del espacio de la imagen que se va desbloqueando. */}
            <svg className="cart-threads" width={BOARD_W} height={BOARD_H} style={{ zIndex: 9 }}>
              <defs>
                <mask id="cartThreadMask">
                  <rect x="0" y="0" width={BOARD_W} height={BOARD_H} fill="#fff" />
                  {[PERSON_PLACA, MAP_PLACA, CENTER].map((p, i) => (
                    <rect key={i} x={p.cx - p.w / 2} y={p.cy - p.h / 2} width={p.w} height={p.h}
                      transform={`rotate(${p.rot} ${p.cx} ${p.cy})`} fill="#000" />
                  ))}
                </mask>
              </defs>
              <g mask="url(#cartThreadMask)">
                {[...personThreads, ...mapThreads, ...datosThreads, ...hechosThreads].map((d, i) => (
                  <path key={i} d={d} fill="none" stroke="#c23b2e" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
                ))}
              </g>
            </svg>

            {/* ── ZONA PERSONAJES ── */}
            <button type="button" className="cart-zone-tag" style={{ left: PERSON_CHIP.x, top: PERSON_CHIP.y, '--tag': '#d56a52', '--tape-rot': '-2.5deg' }}
              onClick={goListPerson}>{personLabel}</button>
            {visiblePass.map((s, i) => <PassportPhoto key={i} s={s} />)}
            <button type="button" className="cart-pass-zone" aria-label="Ver personajes"
              style={{ left: PASS_AREA.x, top: PASS_AREA.y, width: PASS_AREA.w, height: PASS_AREA.h }}
              onClick={goListPerson} />
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
              onClick={goListMap}>{mapLabel}</button>
            <button type="button" className="cart-map"
              style={{ left: MAP.cx, top: MAP.cy, width: MAP.w, height: MAP.h,
                transform: `translate(-50%,-50%) rotate(${MAP.rot}deg)` }}
              onClick={goListMap} aria-label={`Ver lista de ${mapLabel.toLowerCase()}`}>
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
            {SHOW_DATOS && (<>
            <button type="button" className="cart-zone-tag" style={{ left: DATOS_CHIP.x, top: DATOS_CHIP.y, '--tag': '#2F4A6B', '--tape-rot': '-1.5deg' }}
              onClick={goListDatos}>{datosLabel}</button>
            {DOC_STACK.map((col, c) => col.slice(0, visiblePerCol).map((s, i) => (
              <DocSheetCard key={`${c}-${i}`} s={s} z={6 + i} />
            )))}
            <button type="button" className="cart-pass-zone" aria-label="Ver datos"
              style={{ left: DATOS_AREA.x, top: DATOS_AREA.y, width: DATOS_AREA.w, height: DATOS_AREA.h }}
              onClick={goListDatos} />
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
            </>)}

            {/* ── ZONA HECHOS ── */}
            {SHOW_HECHOS && (<>
            <BlueprintBg rect={HECHOS_PLANO} />
            <button type="button" className="cart-zone-tag" style={{ left: HECHOS_CHIP.x, top: HECHOS_CHIP.y, '--tag': '#A9772E', '--tape-rot': '2.5deg' }}
              onClick={goListHechos}>{hechosLabel}</button>
            {visibleHechos.map((it, i) => <HechoItem key={i} it={it} />)}
            <button type="button" className="cart-pass-zone" aria-label="Ver hechos"
              style={{ left: HECHOS_AREA.x, top: HECHOS_AREA.y, width: HECHOS_AREA.w, height: HECHOS_AREA.h }}
              onClick={goListHechos} />
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
            </>)}
          </div>
          {/* Se monta a caballo sobre el borde inferior del marco. Va dentro del
              marco para seguirlo al escalar, con la escala inversa para que el
              texto se lea siempre al mismo tamaño. */}
          <div className="cart-board-hint" style={{ transform: `translate(-50%, 50%) scale(${1 / scale})` }}>
            Toca una categoría para ver los detalles
          </div>
        </div>
      </div>

      <div className="dock">
        <div className="field">
          <label>Avance de lectura</label>
          <div className="dock-bar"><span style={{ width: `${pct}%` }} /></div>
          <span className="count">{pct}%</span>
        </div>
        <span className="hint">El corcho crece y cada sección se revela a medida que avanzas en la lectura</span>
      </div>

      {popup === 'lugares' && (
        <ZonePopup title={`${mapLabel} · ${pct}% desbloqueado`} listLabel={`Ver lista de ${mapLabel.toLowerCase()}`}
          onOpenList={() => { setPopup(null); goListMap() }} onClose={() => setPopup(null)}
          media={<div style={{ width: 320, height: Math.round(860 * 320 / 700) }}>
            <TableroLugares pct={pct} scale={320 / SUB_W} imageUrl={mapImg?.url} videoUrl={mapImg?.videoUrl} />
          </div>} />
      )}
      {popup === 'personajes' && (
        <ZonePopup title={`${personLabel} · ${pct}% desbloqueado`} listLabel={`Ver lista de ${personLabel.toLowerCase()}`}
          onOpenList={() => { setPopup(null); goListPerson() }} onClose={() => setPopup(null)}
          media={<div style={{ width: 320, height: Math.round(860 * 320 / 700) }}>
            <TableroPersonajes pct={pct} scale={320 / SUB_W} imageUrl={personImg?.url} videoUrl={personImg?.videoUrl} />
          </div>} />
      )}
      {SHOW_DATOS && popup === 'datos' && (
        <ZonePopup title={`${datosLabel} · ${pct}% desbloqueado`} listLabel={`Ver lista de ${datosLabel.toLowerCase()}`}
          onOpenList={() => { setPopup(null); goListDatos() }} onClose={() => setPopup(null)}
          media={<div style={{ width: 320, height: Math.round(860 * 320 / 700) }}>
            <TableroDatos pct={pct} scale={320 / SUB_W} stats={data.stats} />
          </div>} />
      )}
      {SHOW_HECHOS && popup === 'hechos' && (
        <ZonePopup title={`${hechosLabel} · ${pct}% desbloqueado`} listLabel={`Ver lista de ${hechosLabel.toLowerCase()}`}
          onOpenList={() => { setPopup(null); goListHechos() }} onClose={() => setPopup(null)}
          media={<div style={{ width: 320, height: Math.round(860 * 320 / 700) }}>
            <TableroHechos pct={pct} scale={320 / SUB_W} imageUrl={hechosImg?.url} videoUrl={hechosImg?.videoUrl} />
          </div>} />
      )}

    </div>
  )
}

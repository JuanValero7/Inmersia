// Geometría pura del tablero de la Cartelera, compartida por escritorio y móvil.
//
// ⚠️ LO ÚNICO QUE HAY QUE SABER ANTES DE TOCAR ESTO
//
// Estas funciones reciben las constantes de layout como ARGUMENTO. No las
// importan, y sobre todo NO las cierran por clausura, que es como estaban
// escritas cuando vivían duplicadas dentro de cada componente.
//
// El motivo es que escritorio y móvil usan tableros de tamaños distintos
// (1180×720 frente a 860×1000) y ~30 constantes comparten NOMBRE con valores
// diferentes:
//
//              escritorio                     móvil
//   MAP        { w:300, h:210, cx:985, … }    { w:284, h:198, cx:590, … }
//   DOC_H      150                            140
//   BOARD_W/H  1180 × 720                     860 × 1000
//
// Si alguien mueve aquí las constantes junto a las funciones, el tablero móvil
// se descoloca entero: los pines y los hilos aparecen en el sitio equivocado.
// Y es un fallo SILENCIOSO — no hay error en consola, nadie se entera hasta
// que un usuario mira el tablero en el teléfono.
//
// Por eso las constantes se quedan donde están, cada una en su componente, y
// aquí solo viven las fórmulas.
//
// La excepción es HECHOS_SIZE, que ya era compartida de antes: las dos
// plataformas la importan de carteleraZonas.jsx con los mismos valores. Por eso
// `hechoPinAbs` no necesita perfil y las otras dos sí.
import { HECHOS_SIZE } from '../components/cartelera/carteleraZonas.jsx'

/**
 * Punta absoluta (en coordenadas del tablero) de un pin del mapa, aplicando
 * el giro del propio mapa.
 * @param {{x:number, y:number}} p   posición del pin, relativa a la esquina del mapa
 * @param {{w:number, h:number, cx:number, cy:number, rot:number}} MAP  perfil de la plataforma
 * @returns {{x:number, y:number}}
 */
export function pinAbs(p, MAP) {
  const lx = MAP.cx - MAP.w / 2 + p.x, ly = MAP.cy - MAP.h / 2 + p.y
  const a = MAP.rot * Math.PI / 180, dx = lx - MAP.cx, dy = ly - MAP.cy
  return { x: MAP.cx + dx * Math.cos(a) - dy * Math.sin(a), y: MAP.cy + dx * Math.sin(a) + dy * Math.cos(a) }
}

/**
 * Punta del pin (arriba, centro) de un documento, aplicando su leve giro.
 * Se ancla justo por DEBAJO del pin, igual que Personajes (pin por encima).
 * @param {{x:number, y:number, rot:number}} s
 * @param {number} DOC_H   alto del documento en px de tablero (150 escritorio, 140 móvil)
 * @returns {{x:number, y:number}}
 */
export function docPinAbs(s, DOC_H) {
  const a = s.rot * Math.PI / 180, dy = -DOC_H / 2 + 8
  return { x: s.x - dy * Math.sin(a), y: s.y + dy * Math.cos(a) }
}

/**
 * Punta del pin (arriba, centro) de una evidencia de Hechos, según su tipo y giro.
 * No necesita perfil: HECHOS_SIZE ya es compartida por las dos plataformas.
 * @param {{x:number, y:number, rot:number, type:string}} it
 * @returns {{x:number, y:number}}
 */
export function hechoPinAbs(it) {
  const { h } = HECHOS_SIZE[it.type]
  const a = it.rot * Math.PI / 180, dy = -h / 2 + 6
  return { x: it.x - dy * Math.sin(a), y: it.y + dy * Math.cos(a) }
}

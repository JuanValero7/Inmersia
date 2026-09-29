// Guarda de sincronía entre los tokens de color de index.css y las constantes
// de JavaScript que repiten esos mismos valores.
//
// POR QUÉ HAY DOS COPIAS Y NO UNA
// Lo ideal sería que clay.jsx exportara `INK = 'var(--ink)'` y punto. No se
// puede: hay 116 sitios en el código que hacen `${INK}33` o `${INK}66` para
// pegarle un alfa al color. Con un hex eso produce `#4a362233`, que es CSS
// válido; con `var(--ink)` produce `var(--ink)33`, que no lo es, y el
// navegador descarta la regla SIN avisar. Se perderían sombras y bordes por
// toda la app y nadie se enteraría hasta verlo a ojo.
//
// La alternativa sería leer las variables con getComputedStyle al arrancar,
// pero eso ata los colores a que el CSS ya esté cargado en el momento en que
// se evalúa el módulo. Si alguna vez devolviera vacío, la app entera se
// quedaría sin color. Demasiado frágil para lo poco que aporta.
//
// Así que se aceptan las dos copias y se blinda lo único que importa: que no
// se separen. Si este test falla, uno de los dos archivos cambió solo.
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { INK, ACCENT } from './components/lector/clay.jsx'

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

/** Lee el valor de una variable CSS del bloque :root de index.css. */
function token(nombre) {
  const m = css.match(new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{3,8})`))
  if (!m) throw new Error(`No existe la variable --${nombre} en index.css`)
  return m[1].toLowerCase()
}

describe('los tokens de color no se separan entre index.css y JS', () => {
  test('--ink coincide con INK de clay.jsx', () => {
    expect(INK.toLowerCase()).toBe(token('ink'))
  })

  test('--accent coincide con ACCENT de clay.jsx', () => {
    expect(ACCENT.toLowerCase()).toBe(token('accent'))
  })

  // Si alguien añade un token nuevo a :root, este test no le obliga a nada:
  // solo vigila los dos que de verdad están duplicados en JavaScript.
  test('los tokens de marca existen y son hex de 6 dígitos', () => {
    for (const t of ['ink', 'accent', 'paper', 'cream', 'danger', 'danger-alt',
                     'gold', 'brown-soft', 'brown-mid']) {
      expect(token(t)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

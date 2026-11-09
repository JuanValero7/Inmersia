// @ts-check
// Tinta y acento de la marca como hex, para JavaScript.
//
// ⚠️ Están DUPLICADOS a propósito: son los mismos que --ink y --accent del
// bloque :root de src/index.css, que es la fuente única de la paleta.
//
// Se quedan como hex y no como 'var(--ink)' porque 116 sitios del código
// hacen `${INK}33` para pegarle un alfa. Con un hex eso da #4a362233, que es
// válido; con var(--ink) da "var(--ink)33", que el navegador descarta SIN
// avisar, y se perderían sombras y bordes por toda la app.
//
// Viven aquí, solos, para que importarlos no arrastre el resto de clay.jsx
// (que ejecuta código al cargarse) a la carga inicial. clay.jsx los
// reexporta, así que `import { INK } from '…/lector/clay.jsx'` sigue igual.
//
// Para que no se separen de index.css hay un test: src/index.tokens.test.js.

export const INK = '#4a3622'
export const ACCENT = '#F2792A'

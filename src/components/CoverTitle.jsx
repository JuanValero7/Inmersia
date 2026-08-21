// Formato: Plain JavaScript (.jsx)
// Título superpuesto en la portada ilustrada (.book-title), compartido por
// Biblioteca y Tienda (desktop y mobile).
//
// El título SIEMPRE entra completo: se mide el texto ya maquetado y se achica
// la fuente hasta que cabe en MAX_LINEAS. La caja no crece: el tope son 3
// líneas (una más que las 2 originales) y el line-clamp del CSS queda como
// red de seguridad para el caso extremo de que ni al tamaño mínimo entre.
//
// Reemplaza a las heurísticas por longitud de texto que había antes
// (tituloFontSize en Biblioteca, tituloSizeClass en Tienda): contaban
// caracteres sin saber el ancho real de la portada ni la fuente, así que los
// títulos largos terminaban recortados con elipsis.
//
// La base es la que manda el llamador por `size` (px) o, si no la manda, la
// que dicte el CSS para ese contexto (.book / .book-lg / media queries). Los
// títulos cortos conservan su tamaño de siempre; solo se achican los que no
// entran.
import { useLayoutEffect, useRef } from 'react'

export const MAX_LINEAS = 3
const MIN_RATIO = 0.45      // no baja del 45% del tamaño base
const PASO = 0.94           // reducción por paso de ajuste fino
const MAX_PASOS = 6

export default function CoverTitle({ title, size, className = 'book-title' }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelado = false
    let anchoPrevio = 0

    function ajustar() {
      if (cancelado || !el.isConnected) return
      const ancho = el.clientWidth
      if (!ancho) return
      anchoPrevio = ancho

      // Base: la del llamador o la del CSS (limpiando el inline de un ajuste previo).
      el.style.fontSize = size ? `${size}px` : ''
      const base = parseFloat(window.getComputedStyle(el).fontSize)
      if (!base) return
      const minimo = base * MIN_RATIO

      // Medir sin el tope de líneas ni la caja -webkit-box: el line-clamp
      // recorta el contenido y falsearía scrollHeight.
      const displayPrevio = el.style.display
      const clampPrevio = el.style.webkitLineClamp
      el.style.display = 'block'
      el.style.webkitLineClamp = 'unset'

      const alturaLinea = (px) => parseFloat(window.getComputedStyle(el).lineHeight) || px * 1.08
      // Tiene que entrar por los dos lados: en alto (número de líneas) y en
      // ancho. Lo segundo importa con títulos de una sola palabra larga
      // ("Meditaciones", "Pragmatismo"): no hay dónde cortar, así que la línea
      // se sale de la portada y el overflow:hidden se come la última letra.
      const entra = (px) => {
        el.style.fontSize = `${px}px`
        return el.scrollHeight <= alturaLinea(px) * MAX_LINEAS + 1 && el.scrollWidth <= ancho + 1
      }

      let px = base
      if (!entra(base)) {
        // Primera estimación y después unos pocos pasos de ajuste: con decenas
        // de portadas en pantalla sale mucho más barato que una búsqueda
        // binaria completa. El alto del texto crece de forma ~cuadrática con el
        // tamaño de fuente (más alto por línea y más líneas), de ahí la raíz;
        // el ancho de una línea sin cortes crece lineal, de ahí el cociente
        // directo. Manda el más exigente de los dos.
        const porAlto = Math.sqrt(alturaLinea(base) * MAX_LINEAS / el.scrollHeight)
        const porAncho = ancho / el.scrollWidth
        px = Math.max(minimo, base * Math.min(1, porAlto, porAncho))
        let pasos = 0
        while (px > minimo && !entra(px) && pasos++ < MAX_PASOS) {
          px = Math.max(minimo, px * PASO)
        }
      }

      el.style.fontSize = `${px.toFixed(2)}px`
      el.style.display = displayPrevio
      el.style.webkitLineClamp = clampPrevio
    }

    ajustar()
    // Las fuentes propias cambian las métricas: re-medir cuando estén listas.
    document.fonts?.ready.then(ajustar)
    // Solo interesa el ancho: la altura la cambiamos nosotros al achicar la
    // fuente y reaccionar a eso sería un bucle.
    const ro = new ResizeObserver(() => {
      if (el.clientWidth && el.clientWidth !== anchoPrevio) ajustar()
    })
    ro.observe(el)
    return () => { cancelado = true; ro.disconnect() }
  }, [title, size])

  return <span ref={ref} className={className}>{title}</span>
}

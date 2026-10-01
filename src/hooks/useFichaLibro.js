// src/hooks/useFichaLibro.js
// ─────────────────────────────────────────────────────────────
// Datos de la ficha de un libro, iguales en escritorio (FichaLibro)
// y en móvil (FichaLibroMobile): solo cambia cómo se pintan.
//   · escenas del avance (libro_reels): imagen de cabecera y nº de escenas
//   · resumen (vista libros_resumen): «Lo que trae en Inmersia» y «Así empieza»
//   · sala del libro (salas 066): la etiqueta de la cabecera
// ─────────────────────────────────────────────────────────────
import { useMemo } from 'react'
import { useLibroReelsQuery, useLibroResumenQuery, useSalasQuery } from '../lib/queries.js'
import { anioMostrar, tiempoLectura, partirSinopsis, recortar } from '../utils/formato.js'

// «Así empieza» se corta aquí para que la ficha no se convierta en un capítulo.
const LARGO_PRIMERA_LINEA = 280

/**
 * @param {object} libro  fila de `libros` (catálogo)
 * @returns {object} lo que la ficha necesita, ya formateado
 */
export function useFichaLibro(libro) {
  const { data: escenas = [] } = useLibroReelsQuery(libro?.id)
  const { data: resumen, isLoading: cargandoResumen } = useLibroResumenQuery(libro?.id)
  const { data: salas = [] } = useSalasQuery()

  return useMemo(() => {
    const esFiccion = libro?.es_ficcion !== false
    // La etiqueta de la cabecera nombra una sala del pasillo, no la temporada.
    const sala = salas.find(s => s.tipo === 'sala' && s.libros.includes(libro?.id)) || null

    // Una tarjeta en 0 no se enseña: «0 ilustraciones» resta en vez de sumar.
    const teselas = resumen ? [
      resumen.palabras > 0 && {
        clave: 'tiempo',
        valor: tiempoLectura(resumen.palabras),
        texto: `de lectura · ${resumen.capitulos} ${resumen.capitulos === 1 ? 'capítulo' : 'capítulos'}`,
      },
      resumen.ilustraciones > 0 && { clave: 'ilustraciones', valor: resumen.ilustraciones, texto: 'ilustraciones' },
      resumen.sonidos > 0 && { clave: 'sonidos', valor: resumen.sonidos, texto: 'momentos con sonido' },
      resumen.fichas > 0 && {
        clave: 'fichas',
        valor: resumen.fichas,
        texto: esFiccion ? 'personajes y lugares en la Investigación' : 'fichas en la Investigación',
      },
    ].filter(Boolean) : []

    // Cabecera: la escena 2 del avance (la 1 suele repetir la portada).
    const imagenCabecera = (escenas[1] || escenas[0])?.imagen_url || null

    return {
      escenas,
      imagenCabecera,
      sala,
      anio: anioMostrar(libro),
      teselas,
      cargandoResumen,
      primeraLinea: recortar(resumen?.primera_linea || '', LARGO_PRIMERA_LINEA),
      sinopsis: partirSinopsis(libro?.descripcion),
    }
  }, [libro, escenas, resumen, cargandoResumen, salas])
}

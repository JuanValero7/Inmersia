// Copy del tutorial guiado, en un solo lugar: cada pantalla tiene versión
// desktop y móvil, y los textos deben coincidir palabra por palabra.
// Los pop-ups son cortos a propósito: uno largo se ve incómodo y nadie lo lee.

// La pista de la mascota va en el cuerpo y se muestra SIEMPRE, también en
// escritorio: está redactada como condicional ("si estás desde tu celular"), así
// que quien lee en computadora igual se entera de cómo se navega en el teléfono.
// Por eso ya no existe `extraMovil`.
export const TEXTO_INTRO_CARTELERA = {
  title: 'Tu cartelera de investigación',
  body: 'Aquí queda guardado todo lo que vas descubriendo. Cada sección se llena a medida que progresas en el libro y va revelando sus imágenes secretas. Toca una sección para ver los detalles. Si estás desde tu celular, una vez estés en los detalles de una categoría toca a nuestra mascota para desplazarte entre ellas.',
  buttonLabel: 'Continuar',
}

// El "ve a Hechos" salió del pop-up Y del tablero: ahora es un cartel grande que
// aparece recién cuando el usuario abre una sección (los detalles). Ahí es donde
// hace falta saber cuál es la próxima parada; en el tablero ya lo dice la pista
// del marco ("Toca una categoría para ver los detalles").
// No se puede descartar ni se apaga al llegar a Hechos: se queda hasta que el
// usuario sale al Foro (que es cuando avanza el paso y la Cartelera se desmonta).
export const CARTEL_HECHOS = {
  emoji: '🔎',
  title: 'Tu próxima parada',
  body: 'Cuando termines de curiosear, entra a la sección Hechos: ahí te espera la siguiente instrucción.',
}

export const TEXTO_ALBUM_HINT = {
  title: 'Conoce tu Álbum',
  body: 'El sitio de recompensas y logros de Inmersia.',
  buttonLabel: 'Ir al Álbum',
}

export const TEXTO_ALBUM = {
  title: 'Tu álbum de barajitas',
  body: 'Cada libro agrega páginas a tu álbum. Las barajitas se desbloquean con tu lectura y las pegas cuando quieras.',
  buttonLabel: 'Entendido',
}

// Mismo cartel grande que el de Hechos, por el mismo motivo: al cerrar el pop-up
// del Álbum el paso ya avanzó a 'tienda_final', y ese hint vive en la Biblioteca.
// Sin esto el usuario se queda en el Álbum sin saber que tiene que volver.
export const CARTEL_BIBLIOTECA = {
  emoji: '📚',
  title: 'Ya casi terminamos',
  body: 'Cuando termines de ver tu álbum, vuelve a la Biblioteca: ahí te espera el último paso.',
}

// Cierre del tutorial. Se queda con el "va por la casa" (antes vivía en el
// pop-up del Álbum) porque es acá donde el usuario puede ir a la Tienda.
export const TEXTO_TIENDA_FINAL = {
  title: 'Último paso',
  body: 'Ve a la Tienda y elige tu primer libro: ese va por la casa.',
  buttonLabel: 'Entendido',
}

// Paso 'tienda': se muestra en la FACHADA, antes de que el usuario cruce la
// puerta, porque el límite decide qué puede llevarse de adentro.
export const TEXTO_TIENDA_LIMITE = {
  title: 'Antes de entrar',
  body: 'En Inmersia puedes tener hasta 5 libros sin terminar a la vez. Al llegar a ese tope la tienda cierra sus puertas hasta que termines alguno.',
  buttonLabel: 'Entendido',
}

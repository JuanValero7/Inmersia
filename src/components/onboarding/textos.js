// Copy del tutorial guiado, en un solo lugar: cada pantalla tiene versión
// desktop y móvil, y los textos deben coincidir palabra por palabra.
// Los pop-ups son cortos a propósito: uno largo se ve incómodo y nadie lo lee.

// Paso 'manual': aparece apenas el usuario entra al Manual del Explorador
// (capítulo 1), antes de que sepa que las instrucciones están en el propio
// texto del libro. Sin esto algunos abrían el manual y se quedaban esperando
// algo en la interfaz, en vez de ponerse a leer.
export const TEXTO_MANUAL_HINT = {
  title: 'Antes de empezar',
  body: 'Este manual te lo explica todo. Solo tienes que leerlo: ahí encontrarás las instrucciones para dar tus primeros pasos en Inmersia.',
  buttonLabel: 'Entendido',
}

// La pista de la mascota va en el cuerpo y se muestra SIEMPRE, también en
// escritorio: está redactada como condicional ("si estás desde tu celular"), así
// que quien lee en computadora igual se entera de cómo se navega en el teléfono.
// Por eso ya no existe `extraMovil`.
export const TEXTO_INTRO_CARTELERA = {
  title: 'Tu investigación',
  body: 'Aquí queda guardado todo lo que vas descubriendo. Cada sección se llena a medida que progresas en el libro y va revelando sus imágenes secretas. Toca una sección para ver los detalles. Si estás desde tu celular, una vez estés en los detalles de una categoría toca a nuestra mascota para desplazarte entre ellas.',
  buttonLabel: 'Continuar',
}

// El "ve a Hechos" salió del pop-up Y del tablero: ahora es un cartel grande que
// aparece recién cuando el usuario abre una sección (los detalles). Ahí es donde
// hace falta saber cuál es la próxima parada; en el tablero ya lo dice la pista
// del marco ("Toca una categoría para ver los detalles").
// No se puede descartar ni se apaga al llegar a Hechos: se queda hasta que el
// usuario sale al Foro (que es cuando avanza el paso y la Cartelera se desmonta).
// La pista de la mascota es un recordatorio: el pop-up de TEXTO_INTRO_CARTELERA
// ya la menciona una vez, pero se cierra y no vuelve a verse, mientras que este
// cartel queda fijo en pantalla durante toda la visita a la sección. Mismo truco
// que ahí (condicional en el cuerpo, se muestra siempre) para no duplicar el texto.
export const CARTEL_HECHOS = {
  emoji: '🔎',
  title: 'Tu próxima parada',
  body: 'Cuando termines de curiosear, entra a la sección Hechos: ahí te espera la siguiente instrucción. Si estás desde tu celular, toca a nuestra mascota para cambiar de categoría.',
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

// ── Pistas de primera vez ───────────────────────────────────
// Reemplazan al tour obligatorio: cada una sale UNA vez, la primera vez que el
// usuario se encuentra con la función (ver context/pistas.jsx y Pista.jsx).
// `bodyMovil` solo cuando la instrucción cambia en el teléfono.
export const PISTAS = {
  sonido: {
    emoji: '🔊',
    title: 'Este libro suena',
    body: 'Toca el texto que brilla en naranja para escucharlo.',
  },
  ilustracion: {
    emoji: '🖼️',
    title: 'Nueva ilustración',
    body: 'Las ilustraciones aparecen junto al libro a medida que avanzas. Pulsa → para verla en grande.',
    bodyMovil: 'Las ilustraciones aparecen a medida que avanzas. Toca la foto que asoma para verla en grande.',
  },
  herramientas: {
    emoji: '✏️',
    title: 'Tus herramientas',
    body: 'Toca al gato de abajo: ahí están tu Cuaderno y el subrayado.',
  },
  investigacion: {
    emoji: '🔎',
    title: 'Tu investigación ganó pistas',
    body: 'Cada capítulo que lees suma personajes, lugares y hechos a tu tablero de Investigación.',
  },
  foro: {
    emoji: '💬',
    title: '¿Quieres comentarlo?',
    body: 'Cada libro tiene su Foro, con comentarios y un chat en vivo con otros lectores. Lo encuentras en Explorar.',
  },
  fin_libro: {
    emoji: '🎉',
    title: '¡Terminaste el libro!',
    body: 'Mira en tu Cuaderno qué predicciones acertaste, deja tu reseña con la estrella o cuéntalo en el Foro.',
  },
  investigacion_tablero: {
    emoji: '🔎',
    title: 'Tu tablero de investigación',
    body: 'Toca una sección del tablero para ver sus detalles. Se van llenando a medida que lees.',
  },
  investigacion_secciones: {
    emoji: '🧭',
    title: 'Cambiar de sección',
    body: 'Usa las lengüetas de arriba para pasar de una sección a otra. «Tablero» te devuelve al corcho.',
    bodyMovil: 'Toca al gato de abajo para pasar de una sección a otra o volver al tablero.',
  },
  foro_pestanas: {
    emoji: '💬',
    title: 'El Foro del libro',
    body: 'En Comentarios dejas tu opinión y respondes a otros. En Chat conversas en vivo con quien esté conectado.',
  },
  album: {
    emoji: '🃏',
    title: 'Ganaste barajitas',
    body: 'Cada capítulo que lees desbloquea barajitas nuevas. Pégalas en tu Álbum.',
  },
  // Cierre del camino "Empezar a leer" (y de quien se registró desde un libro):
  // la primera vez que vuelve a la Biblioteca. Hace de último paso del tour, que
  // esta gente se saltó: dónde se buscan libros nuevos y el tope de 5.
  tienda: {
    emoji: '📚',
    title: '¿Buscas tu próximo libro?',
    body: 'Ve a la Tienda: ahí encuentras libros nuevos cuando quieras. Puedes tener hasta 5 sin terminar a la vez.',
  },
  comunidades: {
    emoji: '👥',
    title: 'Lee acompañado',
    body: 'En Comunidades te unes a un grupo con un código de invitación o buscas uno público. Cuando lees con tu comunidad, ves sus notas dentro del libro.',
  },
}

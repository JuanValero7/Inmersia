// Copy del tutorial guiado, en un solo lugar: cada pantalla tiene versión
// desktop y móvil, y los textos deben coincidir palabra por palabra.
// Los pop-ups son cortos a propósito: uno largo se ve incómodo y nadie lo lee.

export const TEXTO_INTRO_CARTELERA = {
  title: 'Bienvenido a tu cartelera de investigación',
  body: 'Cada sección guarda información y un premio que se desbloquean según tu porcentaje de lectura. Selecciona cualquier elemento para ver sus detalles.',
  // Solo móvil: en escritorio no hay nada que tocar.
  extraMovil: 'Si nuestra mascota aparece en los detalles, tócala.',
  buttonLabel: 'Continuar',
}

// El "ve a Hechos" salió del pop-up: lo dice esta pista un segundo después.
export const PISTA_HECHOS = 'Cuando quieras seguir, entra a la sección Hechos.'

export const TEXTO_ALBUM_HINT = {
  title: 'Conoce tu Álbum',
  body: 'El sitio de recompensas y logros de Inmersia.',
  buttonLabel: 'Ir al Álbum',
}

export const TEXTO_ALBUM = {
  title: 'Tu álbum de logros',
  body: 'Cada libro es una página con el recorrido que has hecho en Inmersia. Esperamos que disfrutes de la lectura desde este nuevo ángulo.',
  buttonLabel: 'Entendido',
}

// Cierre del tutorial. Se queda con el "va por la casa" (antes vivía en el
// pop-up del Álbum) porque es acá donde el usuario puede ir a la Tienda.
export const TEXTO_TIENDA_FINAL = {
  title: 'Último paso',
  body: 'Ve a la Tienda y elige tu primer libro: ese va por la casa.',
  buttonLabel: 'Entendido',
}

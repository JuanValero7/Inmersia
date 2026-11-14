// src/components/landing/escritores/escritoresData.js
// ─────────────────────────────────────────────────────────────
// Datos de la landing de escritores (/escritores): las 8 paradas del viaje
// del libro. Cada parada tiene su época (lo que pasaba entonces, en chico) y
// lo que hace Inmersia hoy (la tarjeta, en grande): el contenido de la
// tarjeta vive en Cuerpos.jsx, por `id`.
// Imágenes, capturas y sonidos en public/assets/landing/escritores/.
// `gato` = pose de Mancha (blanco-1…7); variadas a pedido de Juan (14 nov).
// ─────────────────────────────────────────────────────────────

export const ASSET = '/assets/landing/escritores'
export const LOGO = '/assets/inmersia-logo.png'

export const ERAS = [
  { id: 'egipto', img: 'egipto-barca', lado: 'izq', etq: '2500 a.C.', cuando: 'Egipto · hacia el 2500 a.C.', t: 'Jeroglíficos y papiro',
    h: 'Para llegar a alguien, un texto se copiaba a mano y viajaba en barca por el Nilo.',
    paso: 'Todo empieza contigo', gato: 6 },
  { id: 'roma', img: 'roma-carro', lado: 'der', etq: 'Siglo I', cuando: 'Roma · siglo I', t: 'La invención de las páginas',
    h: 'Con el códice, el abuelo del libro, por primera vez se puede ir directo a una parte.',
    paso: 'Preparamos tu libro para el lector', gato: 2 },
  { id: 'presentacion', img: 's12-monje', lado: 'izq', etq: 'Siglo XII', cuando: 'Europa · siglo XII', t: 'Los libros se iluminan',
    h: 'En los monasterios, los libros se copiaban y se pintaban: escenas, figuras y letras de oro.',
    paso: 'Cómo se presenta tu libro', gato: 3 },
  { id: 'ilustraciones', img: '1710-diligencia', lado: 'izq', etq: '1710', cuando: 'Londres · hacia 1710', t: 'La portada sale a la calle',
    h: 'Los libreros imprimían portadas de más y las pegaban en las calles para anunciar sus libros.',
    paso: 'Las imágenes dentro de tu libro', gato: 7 },
  { id: 'cartelera', img: '1751-velero', lado: 'der', etq: '1751', cuando: 'Francia · 1751', t: 'Todo lo que hay que saber, en fichas',
    h: 'La Enciclopedia de Diderot ordena el saber en entradas, con referencias de una a otra.',
    paso: 'La cartelera de investigación', gato: 5 },
  { id: 'sonido', img: '1938-auto', lado: 'izq', etq: '1938', cuando: 'La radio · 1938', t: 'Las historias empiezan a sonar',
    h: 'El radioteatro cuenta historias con efectos en vivo: una puerta que cruje, la lluvia, pasos.',
    paso: 'Sonido', gato: 4 },
  { id: 'juegos', img: '1979-furgoneta', lado: 'der', etq: '1979', cuando: '1979', t: 'El lector decide',
    h: 'Llegan los libros de «Elige tu propia aventura»: el lector toma decisiones y la historia cambia.',
    paso: 'Juegos dentro de tu libro', gato: 1 },
  { id: 'lectores', img: '2026-tienda', lado: 'izq', etq: '2026', cuando: 'Hoy · 2026', t: 'Y llega a Inmersia',
    h: 'El libro llega a la tienda, y por primera vez el autor puede ver qué pasa después.',
    paso: 'Mis lectores', gato: 2 },
]

// Los 9 estilos de ilustración, en el orden de ART_STYLES (analyze.py) y de
// escritor/Ilustraciones.jsx. Un ejemplo real de cada uno en estilos/e<n>.webp.
export const ESTILOS = ['Óleo clásico', 'Grabado a plumilla', 'Acuarela', 'Art Nouveau', 'Aventura clásica', 'Pulp', 'Arte conceptual', 'Expresionista', 'Impresionista']

// Secciones de la cartelera, con los colores de cartelera/carteleraHelpers.js.
export const SECCIONES_FICCION = [
  ['Personajes', 'Quiénes habitan el relato', '#d56a52'],
  ['Lugares', 'Dónde sucede todo', '#7C8A4F'],
  ['Hechos', 'Lo que ya ha ocurrido', '#F5A623'],
  ['Datos', 'Pistas y detalles a recordar', '#2F4A6B'],
  ['Notas', 'Las predicciones y apuntes del lector', '#BE6173'],
]
export const SECCIONES_NOFICCION = [
  ['Glosario', 'Conceptos clave del libro', '#d56a52'],
  ['Datos', 'Referencias del mundo real', '#7C8A4F'],
  ['Referencias', 'Ideas y obras citadas', '#F5A623'],
  ['Resumen', 'Lo esencial de cada capítulo', '#2F4A6B'],
  ['Notas', 'Las predicciones y apuntes del lector', '#BE6173'],
]

// Muestras de sonido: efectos (los de la landing de colegios) y ambientes
// (de public/sounds/ambiente). El ruido blanco no es un archivo: se genera.
export const EFECTOS = [['sfx-escotilla', 'Una escotilla'], ['sfx-golpe', 'Un golpe'], ['sfx-grito', 'Un grito']]
export const AMBIENTES = [['carruaje_viaje_a', 'Carruaje'], ['tormenta_a', 'Tormenta'], ['velero_cubierta_a', 'Velero']]

// src/components/landing/colegios/colegiosData.js
// ─────────────────────────────────────────────────────────────
// Contenido de la landing para colegios (compartido por LandingColegios.jsx y
// LandingColegiosMobile.jsx). Capturas, ilustraciones y sonidos viven en
// public/assets/landing/colegios/; las capturas móviles llevan el sufijo -m,
// como las de la landing de lectores.
//
// Maqueta de referencia (aprobada el 2026-11-10, versión móvil el 11):
// Documents/Inmersia_maquetas/landing/colegios/index.html (fuera del repo)
// ─────────────────────────────────────────────────────────────

export const ASSETS = '/assets/landing/colegios/'
export const LOGO = '/assets/inmersia-logo.png?v=4'
export const asset = (archivo) => ASSETS + archivo

// Dato de lectura de cada país (bloque «Lo que ya sabemos»). PISA 2025 (OCDE,
// publicado el 8 sep 2026), lectura, cambio contra 2022. Venezuela no participa
// en PISA: su dato es la evaluación SECEL 2025 de la UCAB.
// `zonas`: husos horarios del navegador con los que se elige el país por defecto.
export const PAISES = [
  { id: 'ar', nombre: 'Argentina', zonas: ['America/Argentina/', 'America/Buenos_Aires', 'America/Cordoba', 'America/Mendoza'],
    dato: { big: '−12', txt: 'puntos bajó Argentina en lectura en PISA 2025, de 401 a 389. El 59 % de los alumnos no llega al nivel mínimo.', src: 'OCDE, PISA 2025 · septiembre 2026' } },
  { id: 'cl', nombre: 'Chile', zonas: ['America/Santiago', 'America/Punta_Arenas', 'Pacific/Easter'],
    dato: { big: '−12', txt: 'puntos bajó Chile en lectura en PISA 2025, de 448 a 436. Sigue primero en América Latina, pero cayó.', src: 'OCDE, PISA 2025 · septiembre 2026' } },
  { id: 'co', nombre: 'Colombia', zonas: ['America/Bogota'],
    dato: { big: '−10', txt: 'puntos bajó Colombia en lectura en PISA 2025, de 409 a 399.', src: 'OCDE, PISA 2025 · septiembre 2026' } },
  { id: 'es', nombre: 'España', zonas: ['Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta'],
    dato: { big: '−23', txt: 'puntos bajó España en lectura en PISA 2025, hasta 451: su peor resultado desde que existe PISA.', src: 'OCDE, PISA 2025 · septiembre 2026' } },
  { id: 'mx', nombre: 'México', zonas: ['America/Mexico_City', 'America/Cancun', 'America/Merida', 'America/Monterrey', 'America/Matamoros',
    'America/Chihuahua', 'America/Ciudad_Juarez', 'America/Ojinaga', 'America/Mazatlan', 'America/Bahia_Banderas', 'America/Hermosillo', 'America/Tijuana'],
    dato: { big: '−7', txt: 'puntos bajó México en lectura en PISA 2025, de 415 a 408.', src: 'OCDE, PISA 2025 · septiembre 2026' } },
  { id: 'pe', nombre: 'Perú', zonas: ['America/Lima'],
    dato: { big: '−18', txt: 'puntos bajó Perú en lectura en PISA 2025, de 408 a 390. Volvió al nivel de hace una década.', src: 'OCDE, PISA 2025 · septiembre 2026' } },
  { id: 've', nombre: 'Venezuela', zonas: ['America/Caracas'],
    dato: { big: '7 de 10', txt: 'estudiantes evaluados reprobaron comprensión lectora en 2025. Venezuela no participa en PISA.', src: 'UCAB, SECEL 2025' } },
]

// País por defecto: el del huso horario del navegador (sin pedir ubicación ni
// llamar a nada de afuera); si no coincide, la región del idioma; si no, Perú.
export function paisInicial() {
  try {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const porZona = PAISES.find((p) => p.zonas.some((z) => (z.endsWith('/') ? zona.startsWith(z) : zona === z)))
    if (porZona) return porZona
    const region = (navigator.language || '').split('-')[1]?.toLowerCase()
    const porIdioma = PAISES.find((p) => p.id === region)
    if (porIdioma) return porIdioma
  } catch { /* sin Intl: país por defecto */ }
  return PAISES.find((p) => p.id === 'pe')
}

// Noche 3: las notificaciones que interrumpen al visitante. [app, texto, color, letra]
export const NOTIFICACIONES = [
  ['Grupo 3.º B', '14 mensajes nuevos', '#25a35a', 'G'],
  ['Fotos', 'vale.rmz te etiquetó en una historia', '#d6336c', 'F'],
  ['Videos', 'Un canal que sigues subió un video nuevo', '#e03131', '▶'],
  ['Juego', '¡Tu recompensa diaria vence en 1 hora!', '#7048e8', 'J'],
  ['Grupo 3.º B', 'Camila: mañana hay que entregar algo??', '#25a35a', 'G'],
  ['Fotos', 'A 3 personas les gustó tu publicación', '#d6336c', 'F'],
  ['Videos', 'En vivo ahora: el streamer que sigues', '#e03131', '▶'],
  ['Grupo 3.º B', 'Diego: alguien ya leyó lo de Kipling??', '#25a35a', 'G'],
  ['Juego', 'Tus amigos te esperan en la partida', '#7048e8', 'J'],
]

// Arriba de todo, escrito con tiza en la pizarra de Pedro: los cuatro puntos y la escena a la que lleva cada uno.
export const RESUMEN = [
  { esc: 'noche1', dia: 'Día 1', titulo: 'Lectura inmersiva', texto: 'Ilustraciones, sonido y juegos dentro del libro.' },
  { esc: 'dia2', dia: 'Día 2', titulo: 'Stealth assessment y recompensas', texto: 'Se evalúa mientras juegan. Los premios los pone el profe.' },
  { esc: 'noche15', dia: 'Día 15', titulo: 'Comunidad segura', texto: 'La clase lee junta, en un aula privada.' },
  { esc: 'dia28', dia: 'Día 28', titulo: 'Trackeo de lectura y evaluaciones', texto: 'Quién va al día y cuánto entendió cada uno.' },
]

// Día 2: cada tipo de libro trae sus juegos (en no ficción no hay mapa del tesoro,
// concurso, corazonadas ni desafío del gato).
export const TIPOS_DE_LIBRO = [
  { id: 'ficcion', nombre: 'Ficción',
    juegos: ['Mapa del tesoro', 'Corazonadas', 'El concurso', 'Mesa de investigación', 'Desafío del gato'] },
  { id: 'noficcion', nombre: 'No ficción',
    juegos: ['El falsificador', 'Hilo de ideas', 'Explícaselo a…', 'Cápsula del tiempo'] },
]

// Noche 1: la corazonada (mismo funcionamiento que la app).
export const CORAZONADA = {
  pregunta: '¿Harvey terminará siendo uno más de la tripulación?',
  contexto: 'Harvey no quería trabajar por diez dólares y medio al mes. Ahora limpia la cubierta con Dan.',
  opciones: ['Sí, se gana su lugar en el barco', 'No, se escapa en el primer puerto'],
  nivel: { 1: 'Me lo huelo', 2: 'Bastante seguro', 3: '¡Segurísimo!' },
  pose: { 0: 7, 1: 6, 2: 4, 3: 1 }, // pose de Katana según los ovillos jugados
  saldo: 12,
}

// Noche 12: el concurso.
export const CONCURSO = {
  saldo: 31,
  pregunta: '¿Qué quiso decir el señor de Filadelfia?',
  contexto: '«Ese chico, Cheyne, es la mayor molestia de a bordo. No lo necesitamos aquí. Es demasiado desvergonzado.»',
  opciones5050: ['Que Harvey nunca fue a la escuela', 'Que Harvey tiene dinero, pero no sabe nada de la vida'],
  ok5050: 1,
  // Juez de la maqueta: busca ideas de la respuesta correcta. En la app lo hace una IA.
  aciertos: /(vida|plata|dinero|rico|mimad|malcriad|aprend|trabaj|madur|realidad|consentid)/i,
  referencia: 'Es ironía: Harvey ya fue al colegio y tiene dinero de sobra, pero no sabe nada de la vida. Su verdadera educación empieza en el barco.',
  veredictos: {
    ok: ['is-ok', '¡Correeeecto!', 'Lo entendiste: la frase es irónica.', 3],
    casi: ['is-casi', 'Uy, casi', 'Vas cerca. Fíjate en lo que dice justo después: los doscientos dólares al mes.', 1],
    no: ['is-no', 'Ehhhh, no', 'No es eso. Harvey sí fue al colegio: lo llevan a Europa a terminar su educación.', 0],
  },
}

// Noche 17: la mesa de investigación, con pistas reales de los capítulos 1 a 5.
export const MESA = {
  saldo: 20,
  pistas: {
    p1: [1, 'Harvey le cuenta a todos que recibe doscientos dólares al mes para sus gastos.'],
    p2: [1, 'Harvey dice que le dará quince dólares a la camarera para que cuide a su madre.'],
    p3: [1, 'Harvey le ofrece a Troop pagarle al contado para que lo lleve a Nueva York.'],
    p4: [1, 'Harvey le grita a Troop y golpea la cubierta con el pie.'],
    p5: [1, 'Harvey acusa a la tripulación de robarle ciento treinta y cuatro dólares.'],
    p6: [1, 'Harvey le dice a Troop que no va a trabajar en el barco.'],
    p7: [5, 'Harvey imita a cada pescador hasta aprender cómo trabaja.'],
    p8: [5, 'Harvey aprende a sacar agua moviendo rápido el cubo.'],
    p9: [5, 'Harvey hace de intérprete con unos pescadores franceses.'],
  },
  recetas: [
    { pistas: ['p1', 'p2', 'p3'], ok: 1, texto: 'Harvey cree que todo se arregla con dinero',
      opciones: ['Harvey es generoso con quienes trabajan para él.', 'Harvey cree que todo se arregla con dinero.', 'Harvey quiere mucho a su madre.'] },
    { pistas: ['p4', 'p5', 'p6'], ok: 2, texto: 'Harvey no acepta que nadie le dé órdenes',
      opciones: ['Harvey tiene miedo de quedarse en el barco.', 'Harvey odia a los pescadores.', 'Harvey no acepta que nadie le dé órdenes.'] },
    { pistas: ['p7', 'p8', 'p9'], ok: 0, texto: 'Harvey empieza a sentirse parte de la tripulación',
      opciones: ['Harvey empieza a sentirse parte de la tripulación.', 'Harvey quiere llegar a ser capitán del barco.', 'Harvey solo trabaja para que le paguen.'] },
  ],
  orden: ['p4', 'p1', 'p7', 'p5', 'p8', 'p2', 'p9', 'p6', 'p3'],
}

// Katana responde las dudas de los colegios.
export const FAQ = [
  ['¿Y si el profe no se lleva bien con la tecnología?', 'Asignar un libro es elegirlo y poner una fecha. Los alumnos entran con un código. Si algo se traba, nos escribe por WhatsApp y lo resolvemos.'],
  ['¿Quién ve lo que escriben los chicos?', 'El profe ve resultados y cantidades. Lo que el alumno escribe para sí mismo no lo ve nadie. La excepción es el desafío del gato, y el alumno lo sabe porque dice «Lo lee tu profe».'],
  ['¿Cuánto cuesta?', 'El piloto es gratis: un curso, un libro, seis semanas. Lo que viene después lo conversamos en una llamada corta.'],
  ['¿Están los libros de nuestro plan lector?', 'Muchos clásicos ya están. Mándenos su lista y le decimos cuáles hay y cuáles preparamos para su colegio.'],
  ['¿Necesitan computadora o instalar algo?', 'No. Funciona en el navegador del celular, la tablet o la compu.'],
  ['¿Desde qué edad?', 'Desde los 12 años, entrando con el código del aula. El colegio se encarga de la autorización de las familias, como con cualquier plataforma escolar.'],
  ['¿Y los datos de los alumnos?', 'Firmamos con el colegio un acuerdo de tratamiento de datos. Inmersia nace en Berlín y cumple el reglamento europeo de protección de datos.'],
]

export const CONTACTO = {
  whatsapp: '+4917669428028',
  whatsappVisible: '+49 176 69428028',
  whatsappUrl: 'https://wa.me/4917669428028?text=Hola%2C%20quiero%20participar%20en%20el%20piloto%20de%20Inmersia',
  correo: 'juanvalero@inmersia.io',
}

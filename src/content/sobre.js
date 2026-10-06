// src/content/sobre.js
// ─────────────────────────────────────────────────────────────
// Textos de /sobre ("Sobre Inmersia"). Única fuente para los dos sitios que
// los pintan: src/components/PaginaSobre.jsx (la app) y scripts/generar-seo.mjs
// (el HTML estático que leen los rastreadores y el verificador del programa de
// startups de Google, que pide poder validar negocio, equipo y producto en una
// web pública). Por eso es JS plano, sin JSX: el script lo importa desde Node.
//
// Cambiar un texto aquí lo cambia en los dos sitios. Mantener el tuteo.
// ─────────────────────────────────────────────────────────────

export const SOBRE = {
  ruta: '/sobre',
  titulo: 'Sobre Inmersia',
  descripcion:
    'Quién está detrás de Inmersia y cómo se hace cada libro: análisis con Gemini, ' +
    'ilustraciones, diseño sonoro y tableros de investigación.',

  intro: [
    'Inmersia es una plataforma para leer clásicos como se merecen: cada libro llega ' +
    'ilustrado capítulo a capítulo, con su propio paisaje sonoro, un tablero para seguir ' +
    'a los personajes, los lugares y las pistas de la trama, y barajitas para coleccionar ' +
    'mientras lees. Leer en Inmersia es gratis mientras estamos en acceso anticipado.',
  ],

  fundador: {
    titulo: 'Quién está detrás',
    nombre: 'Juan Valero',
    cargo: 'Fundador',
    foto: '/assets/sobre/juan.webp',
    fotoAlt: 'Juan Valero, fundador de Inmersia',
    bio: [
      'Ingeniero industrial (Universidad Simón Bolívar), venezolano, vive en Berlín. Lleva ' +
      'nueve años diseñando sistemas de optimización para plataformas digitales en América ' +
      'Latina y Europa, y escribe novelas. Inmersia nace de juntar las dos cosas: la ' +
      'ingeniería y el amor por los libros.',
    ],
    credito: 'Identidad visual: Mariana Gregorini.',
  },

  proceso: {
    titulo: 'Cómo se hace un libro en Inmersia',
    intro:
      'Detrás de cada libro hay un proceso de producción construido desde cero para ' +
      'Inmersia, en el que la inteligencia artificial hace buena parte del trabajo pesado. ' +
      'El motor principal es Gemini, de Google.',
    pasos: [
      {
        titulo: 'Lectura y análisis',
        texto:
          'Gemini lee el libro capítulo a capítulo: identifica a los personajes (también ' +
          'cuando aparecen con apodos o nombres distintos), los lugares, los objetos y los ' +
          'momentos clave de la trama, y resume cada capítulo.',
      },
      {
        titulo: 'El tablero de investigación',
        texto:
          'Con ese análisis se arma el tablero de cada libro: fichas de personajes y lugares ' +
          'y las pistas que van apareciendo a medida que avanzas en la lectura.',
      },
      {
        titulo: 'Las ilustraciones',
        texto:
          'Gemini describe cada escena (quién aparece, cómo es el lugar, qué luz tiene) y un ' +
          'modelo de generación de imágenes la convierte en ilustración, con un estilo ' +
          'coherente para todo el libro.',
      },
      {
        titulo: 'El sonido',
        texto:
          'Gemini propone qué debería sonar en cada capítulo (la lluvia en la ventana, una ' +
          'taberna llena, el mar) y ElevenLabs genera esos efectos y ambientes, que el lector ' +
          'reproduce mientras lees.',
      },
      {
        titulo: 'La traducción',
        texto:
          'Cuando una obra no tiene una buena versión en español de dominio público, Gemini ' +
          'la traduce y después revisa la traducción y el estilo en una segunda pasada.',
      },
    ],
    cierre:
      'La IA hace el trabajo de producción; qué libros entran, cómo se ve cada uno y cómo ' +
      'se lee lo decide una persona.',
  },

  modelo: {
    titulo: 'Modelo',
    texto:
      'Inmersia funcionará con una suscripción: un libro al mes y acceso completo a todo lo ' +
      'demás (ilustraciones, sonido, tableros, clubes), con la opción de comprar libros ' +
      'sueltos. También ofreceremos licencias para clubes de lectura y colegios, y un espacio ' +
      'para que autores nuevos publiquen y vendan sus libros.',
  },

  contacto: {
    titulo: 'Contacto',
    email: 'hola@inmersia.io',
    enlaces: [
      { label: 'Instagram', texto: '@inmersia.io', href: 'https://www.instagram.com/inmersia.io/' },
      { label: 'LinkedIn', texto: 'Inmersia', href: 'https://www.linkedin.com/company/inmersia-io' },
      { label: 'LinkedIn', texto: 'Juan Valero', href: 'https://www.linkedin.com/in/juan-alevalero-zam' },
    ],
  },

  // Para quien revise la página sin leer español.
  english: {
    titulo: 'About Inmersia',
    parrafos: [
      'Inmersia is an immersive reading platform for Spanish-language literature, founded ' +
      'in 2026 by Juan Valero in Berlin. Classic books are rebuilt as illustrated, ' +
      'sound-designed reading experiences with interactive investigation boards and ' +
      'collectible cards.',
      'Every book goes through a production pipeline built around Google\'s Gemini models, ' +
      'which analyze each chapter, extract characters, places and plot events, describe the ' +
      'scenes to illustrate, plan the sound design and translate texts when needed. Sound ' +
      'effects are generated with ElevenLabs. Contact: hola@inmersia.io',
      'Business model: subscription (one book per month plus full platform access), group ' +
      'licenses for book clubs and schools, and a marketplace for new authors. Free during ' +
      'early access.',
    ],
  },
}

// Sin la barra final (inmersia.io/caso) las rutas assets/… apuntarían a la raíz del sitio.
if (location.pathname === '/caso') location.replace('/caso/' + location.search);

// ─────────────────────────────────────────────────────────────
// Lo que más se cambia está aquí arriba.
// El nombre del colegio también se puede pasar en la dirección: inmersia.io/caso/?colegio=San%20Agustín
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  colegio: '',
  web: 'https://www.inmersia.io',
  piloto: [['1', 'curso', 'var(--naranja2)'], ['1', 'libro', 'var(--mostaza)'], ['6', 'semanas', 'var(--verde)'], ['Gratis', 'sin letra chica', 'var(--azul)']],
  pido: 'A cambio le pido dos cosas: su opinión sincera y dos llamadas cortas durante el piloto.',
  segundosDuelo: 20,
};
const qs = new URLSearchParams(location.search);
const COLEGIO = qs.get('colegio') || CONFIG.colegio;

const PAGINA = [
  '-Lo que debe haber sido seis o siete veces -respondió Tom Platt secamente-. Una buena estiba es una estiba, sea como sea; hay una manera buena y otra mala de hacerlo. Si tú hubieras visto cuatrocientas toneladas de hierro colocadas en...',
  '-¡Eh! -gritó Manuel, reanudando su trabajo, sin detenerse hasta que el depósito provisional de cubierta quedó completamente vacío.',
  'En cuanto el último pescado bajó por la escotilla, Disko se retiró con su hermano. Manuel y Long Jack se dirigieron a proa, y Tom Platt se detuvo sólo el tiempo suficiente para cerrar la escotilla. Medio minuto más tarde Harvey oyó profundos ronquidos, mientras observaba extrañado a Dan y Penn.',
  '-Esta vez lo he hecho un poco mejor, Danny -dijo Penn, cuyos párpados se cerraban de puro sueño-. Pero supongo que mi deber es ayudarte a limpiar.',
];

// Frases de la página que suenan al tocarlas (solo en la versión Inmersia)
const SFX = [
  ['gritó Manuel', 'sfx-grito.mp3'],
  ['reanudando su trabajo', 'sfx-golpe.mp3'],
  ['el último pescado bajó por la escotilla', 'sfx-pescado.mp3'],
  ['cerrar la escotilla', 'sfx-escotilla.mp3'],
];
const conSonidos = t => SFX.reduce((acc, [frase, archivo]) =>
  acc.replace(frase, `<span class="sfx" data-sfx="${archivo}">${frase}</span>`), t);

// Las seis pistas del caso. x/y = centro de la tarjeta en el tablero.
const PISTAS = [
  {
    tag: 'Pista 1 · La atención', col: 'var(--rosa)', glow: '#e9b3a6', x: 300, y: 235, rot: -3,
    titulo: 'El celular gana siempre', res: '→ El duelo',
    lead: 'No perdieron la capacidad de concentrarse: no hay evidencia sólida de eso. Lo que pasa es que el libro pierde la pelea por su atención.',
    notas: [
      { big: '−15', txt: 'puntos bajó Perú en lectura en PISA 2025. Volvió al nivel de hace una década.', src: 'OCDE · Minedu, setiembre 2026', c: '#fde3dc' },
      { big: '1 de 3', txt: 'chicos de 8 a 18 años disfruta leer en su tiempo libre. El mínimo en 20 años.', src: 'National Literacy Trust, Reino Unido, 2025', c: '#fff1a8' },
      { big: '43 %', txt: 'de lo que hacemos al día es hábito. Y en casi todos los hábitos hay un celular cerca.', src: 'Wendy Wood, Universidad del Sur de California', c: '#dff0e8' },
      { big: 'Querer ≠ disfrutar', txt: 'El celular despierta las ganas de seguir mirando, no el placer. No lo pasan bien, pero no lo sueltan.', src: 'Kent Berridge, Universidad de Michigan', c: '#efe3f7' },
    ],
    duelo: true,
  },
  {
    tag: 'Pista 2 · La experiencia', col: 'var(--naranja2)', glow: '#f6c08f', x: 1300, y: 235, rot: 3,
    titulo: 'Un PDF contra TikTok', res: '→ La tienda',
    lead: 'Del otro lado hay color, música y una sorpresa cada pocos segundos. Del nuestro, una fotocopia en blanco y negro.',
    notas: [
      { big: '8 h 39 min', txt: 'al día pasa un adolescente frente a pantallas para entretenerse, sin contar el colegio.', src: 'Common Sense Media, EE. UU., 2021', c: '#fff1a8' },
      { big: 'La sorpresa', txt: 'Nunca saben si el próximo video será bueno, y por eso siguen mirando. Es la recompensa variable que estudió Skinner.', src: 'B. F. Skinner', c: '#fde3dc' },
      { big: 'La fotocopia', txt: 'Letra chica, sin imágenes, sin sonido, igual para todos. Así llega el libro hoy.', src: '', c: '#e9e8e3' },
    ],
    resp: () => `
      <span class="chip" data-c="var(--naranja2)">La respuesta</span>
      <h2>Hacer menos aburrido lo aburrido</h2>
      <p class="lead lead-corta">Una tienda que habla el idioma de las historias de Instagram.</p>
      <div class="fila f-tienda">
        <figure class="tel"><span class="paso-n">1</span><div class="marco-tel"><img src="assets/tienda-sala.jpg" alt=""></div>
          <figcaption><b>Entra a una sala</b>Aventura, terror, romance, filosofía…</figcaption></figure>
        <figure class="tel"><span class="paso-n">2</span><div class="marco-tel"><img src="assets/tienda-historia-sala.jpg" alt=""></div>
          <figcaption><b>Mira el avance</b>Como una historia: desliza y aparece el siguiente libro.</figcaption></figure>
        <figure class="tel"><span class="paso-n">3</span><div class="marco-tel"><img src="assets/tienda-ficha.jpg" alt=""></div>
          <figcaption><b>Se lo lleva</b>«Comenzar a leer» o a su biblioteca. Gratis.</figcaption></figure>
        <figure class="pol" data-c="var(--naranja2)" data-r="3" data-w="420"><span class="paso-n">4</span><img src="assets/biblioteca.jpg" alt="">
          <figcaption><b>Su biblioteca</b>Retoma donde lo dejó, en el celular o la computadora.</figcaption></figure>
      </div>`,
  },
  {
    tag: 'Pista 3 · El incentivo', col: 'var(--mostaza)', glow: '#efd27e', x: 260, y: 490, rot: 2,
    titulo: 'Nada lo empuja a seguir', res: '→ Álbum y cartelera',
    lead: 'Termina el capítulo 1 y no pasa nada. La única razón para abrir el 2 es la nota.',
    notas: [
      { big: 'La nota llega tarde', txt: 'Cuando llega la prueba, el que se quedó en el capítulo 2 ya se rindió hace rato.', src: '', c: '#fff1a8' },
      { big: 'Ahora, no en un mes', txt: 'A los adolescentes los mueven más las recompensas inmediatas que las lejanas.', src: 'Laurence Steinberg, Child Development, 2009', c: '#fde3dc' },
      { big: 'Los juegos lo saben', txt: 'Cada nivel desbloquea algo nuevo. Por eso vuelven al día siguiente.', src: '', c: '#dff0e8' },
    ],
    resp: () => `
      <span class="chip" data-c="var(--mostaza)">La respuesta</span>
      <h2>Cada capítulo desbloquea algo</h2>
      <div class="fila f-album">
        <figure class="pol" data-c="var(--mostaza)" data-r="-3" data-w="600"><img src="assets/album.jpg" alt="">
          <figcaption><b>El álbum</b>Cartas ilustradas de personajes, lugares y capítulos que se desbloquean a medida que avanzan.</figcaption></figure>
        <div data-w="660">
          <b class="sub-tit">La cartelera se llena con cada lectura</b>
          <p class="sub-txt">Personajes y lugares aparecen con su imagen cuando el libro los presenta. Sin adelantar nada.</p>
          <span class="etq" data-c="var(--rosa)">Personajes</span><br>
          ${[['harvey_cheyne', 'Harvey Cheyne', -3], ['manuel', 'Manuel', 2], ['disko_troop', 'Disko Troop', -2], ['dan_troop', 'Dan Troop', 3]]
            .map(([f, n, r]) => `<span class="ficha-cart" data-w="128" data-r="${r}"><img src="assets/per-${f}.jpg" alt=""><span>${n}</span></span>`).join('')}
          <br><span class="etq" data-c="var(--verde)">Lugares</span><br>
          ${[['la_virgen_the_virgin', 'La Virgen', 2], ['gloucester_puerto', 'Puerto de Gloucester', -2]]
            .map(([f, n, r]) => `<span class="ficha-cart" data-w="200" data-r="${r}"><img src="assets/lug-${f}.jpg" alt=""><span>${n}</span></span>`).join('')}
        </div>
      </div>`,
  },
  {
    tag: 'Pista 4 · Las preguntas', col: 'var(--azul)', glow: '#a9bfdc', x: 1340, y: 490, rot: -2,
    titulo: 'ChatGPT ya leyó el libro', res: '→ Predicciones y repaso',
    lead: 'Si la pregunta es «¿qué pasó en el capítulo 3?», la respuesta está a un clic. Se puede contestar sin abrir el libro.',
    notas: [
      { big: '1 de 4', txt: 'adolescentes ya usó ChatGPT para hacer tareas del colegio: el doble que un año antes.', src: 'Pew Research Center, EE. UU., 2025', c: '#e3ebf7' },
      { big: '10 segundos', txt: 'Lo que tarda una IA en resumir cualquier clásico, capítulo por capítulo.', src: '', c: '#fff1a8' },
      { big: 'El resumen no es el libro', txt: 'Sabe qué pasó, pero no lo vivió. Y en clase se nota.', src: '', c: '#dff0e8' },
    ],
    resp: () => `
      <span class="chip" data-c="var(--azul)">La respuesta</span>
      <h2>No preguntamos qué pasó. Preguntamos qué va a pasar.</h2>
      <div class="fila f-preg">
        <div data-w="330">
          <figure class="pol" data-c="var(--azul)" data-r="-3"><img src="assets/predicciones.jpg" alt="">
            <figcaption><b>Predicciones</b>Antes de cada capítulo apuesta qué va a pasar. Queda guardado antes de saberlo: ningún resumen lo responde.</figcaption></figure>
        </div>
        <div data-w="300">
          <figure class="pol" data-c="var(--rosa)" data-r="3"><img class="img-250" src="assets/subrayados.jpg" alt="">
            <figcaption><b>Lo que subrayó la clase</b>Para abrir la discusión: «¿por qué 14 de ustedes marcaron esta frase?»</figcaption></figure>
        </div>
        <div data-w="270">
          <div class="story"><img src="assets/ilus-cap3.jpg" alt="">
            <div class="barritas"><i class="ya"></i><i class="ya"></i><i></i></div>
            <div class="arriba">ANTERIORMENTE EN CAPITANES INTRÉPIDOS</div>
            <div class="abajo"><span class="cap">Donde lo dejaste</span><h4>Capítulo 3</h4>
              <ul><li>Harvey se viste como pescador</li><li>Harvey pesca su primer halibut</li><li>Disko Troop señala el regreso</li></ul>
              <span class="seguir">▸ Seguir leyendo</span></div></div>
          <p class="story-pie"><b>«Anteriormente en…»</b> Si pasaron días, un repaso de lo que ya leyó. Sin buscar el resumen afuera.</p>
        </div>
        <div class="caja caja-piloto" data-w="300">
          <b class="caja-tit">Sus propias preguntas</b>
          <p class="caja-txt">Que usted deje preguntas dentro del libro, en el capítulo que elija, y vea lo que respondió cada alumno.</p>
          <span class="piloto-badge">Lo construimos con ustedes en el piloto</span>
        </div>
      </div>`,
  },
  {
    tag: 'Pista 5 · La soledad', col: 'var(--verde)', glow: '#9fc2b4', x: 330, y: 745, rot: -2,
    titulo: 'Cada uno lee solo', res: '→ Comunidades',
    lead: 'Leen solos, en su casa, cada uno a su ritmo. Lo único que comparten es la prueba.',
    notas: [
      { big: 'Sin recreo', txt: 'Las series se ven solos, pero se comentan en el recreo. El libro no tiene recreo.', src: '', c: '#dff0e8' },
    ],
    resp: () => `
      <span class="chip" data-c="var(--verde)">La respuesta</span>
      <h2>Leer juntos, cada uno a su ritmo</h2>
      <div class="fila f-com">
        <figure class="pol" data-c="var(--verde)" data-r="-3" data-w="380"><img class="img-440" src="assets/comunidades.jpg" alt="">
          <figcaption><b>La comunidad del curso</b>Un libro, una fecha, y por dónde va cada uno.</figcaption></figure>
        <figure class="pol" data-c="var(--azul)" data-r="2" data-w="470">
          <img class="img-440" src="assets/comentarios.jpg" alt="" data-falta="comentarios y notitas dentro del libro<br>(assets/comentarios.jpg)">
          <figcaption><b>Dentro del libro</b>Comentarios y notitas de sus compañeros, en la página donde pasa.</figcaption></figure>
        <ul class="puntos puntos-com" data-w="390">
          <li>El profe crea la comunidad con un código de invitación.</li>
          <li>Eligen un libro y una fecha para terminarlo.</li>
          <li>Ven por dónde va cada uno: un empujón sano, sin tablas de posiciones.</li>
        </ul>
      </div>`,
  },
  {
    tag: 'Pista 6 · El profe', col: 'var(--lila)', glow: '#c9b6de', x: 1270, y: 745, rot: 3,
    titulo: 'El papel no le cuenta nada al profe', res: '→ Panel docente',
    lead: '¿Quién lo está leyendo? ¿Quién se quedó en el capítulo 2? ¿Quién leyó solo el resumen? Hoy la respuesta llega con la prueba, cuando ya es tarde.',
    notas: [
      { big: '¿Quién?', txt: '¿Quién va al día y quién se quedó atrás?', src: '', c: '#efe3f7' },
      { big: '¿Dónde?', txt: '¿Por qué capítulo va cada uno?', src: '', c: '#fff1a8' },
      { big: '¿Cuándo?', txt: '¿Lo leyó, o pasó las páginas la noche antes?', src: '', c: '#e3ebf7' },
    ],
    resp: () => `
      <span class="chip" data-c="var(--lila)">La respuesta</span>
      <h2>Un panel para el docente</h2>
      <div class="fila f-panel">
        <figure class="pol" data-c="var(--lila)" data-r="-2" data-w="560"><img class="img-520" src="assets/panel.jpg" alt=""></figure>
        <div data-w="640">
          <ul class="puntos">
            <li>Quién va al día y quién se quedó atrás</li>
            <li>Quién no abre el libro hace días</li>
            <li>Quién pasó capítulos demasiado rápido para haberlos leído</li>
            <li>Por qué capítulo va cada alumno</li>
            <li>Las frases que más subrayó la clase</li>
            <li>Una vista de todo el colegio, con informe en PDF</li>
          </ul>
          <div class="caja caja-priv"><p class="caja-txt"><b>Y nunca muestra lo que el alumno escribe en privado:</b> ni sus conversaciones, ni sus predicciones, ni sus notas. Sin tablas de posiciones.</p></div>
          <p class="nota-maqueta">Maqueta con datos de ejemplo: lo terminamos de diseñar con ustedes en el piloto.</p>
        </div>
      </div>`,
  },
];

// ── pasos de la presentación ──
const PASOS = [{ s: 'portada' }, { s: 'apuesta' }, { s: 'tablero', v: 0, r: 0 }];
PISTAS.forEach((p, k) => {
  PASOS.push({ s: 'tablero', v: k + 1, r: k, nueva: k });
  PASOS.push({ s: 'tablero', v: k + 1, r: k, ov: [k, 'pista'] });
  if (p.duelo) {
    PASOS.push({ s: 'tablero', v: k + 1, r: k, ov: [k, 'duelo1'] });
    PASOS.push({ s: 'tablero', v: k + 1, r: k, ov: [k, 'duelo2'] });
  } else {
    PASOS.push({ s: 'tablero', v: k + 1, r: k, ov: [k, 'resp'] });
  }
  PASOS.push({ s: 'tablero', v: k + 1, r: k + 1, resuelta: k });
});
PASOS.push({ s: 'tablero', v: 6, r: 6, cerrado: true });
PASOS.push({ s: 'final' });

let paso = 0, anterior = -1, apuesta = null, extra = null, timer = null;
const $ = id => document.getElementById(id);

// Valores de cada pieza (color, giro, ancho…) que vienen en data-* de las plantillas.
// Se aplican por código porque la política de seguridad del sitio no admite estilos escritos en el HTML.
function vars(root) {
  root.querySelectorAll('[data-c],[data-r],[data-w],[data-bg],[data-delay]').forEach(el => {
    const d = el.dataset;
    if (d.c) el.style.setProperty('--c', d.c);
    if (d.r) el.style.setProperty('--r', d.r + 'deg');
    if (d.w) el.style.width = d.w + 'px';
    if (d.bg) el.style.background = d.bg;
    if (d.delay) el.style.animationDelay = d.delay + 's';
  });
  // Captura que aún no existe: un recuadro que avisa en vez de una imagen rota.
  root.querySelectorAll('img[data-falta]').forEach(img => img.addEventListener('error', () => {
    const aviso = document.createElement('div');
    aviso.className = 'falta ' + img.className;
    aviso.innerHTML = 'Falta la captura:<br>' + img.dataset.falta;
    img.replaceWith(aviso);
  }));
}

// ── sonido ──
// Ambiente del round 2: el mar y el barco crujiendo, con entrada y salida suaves.
const AMB = [[new Audio('assets/olas.mp3'), .7], [new Audio('assets/amb-aparejo.mp3'), .3]];
AMB.forEach(([a]) => { a.loop = true; a.volume = 0; });
let fade = null, muteado = false, nivel = 0;
function marOn() {
  if (muteado) return;
  clearInterval(fade); AMB.forEach(([a]) => a.play().catch(() => {}));
  fade = setInterval(() => { nivel = Math.min(1, nivel + .05); AMB.forEach(([a, v]) => a.volume = v * nivel); if (nivel >= 1) clearInterval(fade); }, 80);
}
function marOff() {
  clearInterval(fade);
  fade = setInterval(() => {
    nivel = Math.max(0, nivel - .07); AMB.forEach(([a, v]) => a.volume = v * nivel);
    if (nivel <= 0) { clearInterval(fade); AMB.forEach(([a]) => a.pause()); }
  }, 50);
}
const efectos = {};
function efecto(archivo, el) {
  const a = efectos[archivo] || (efectos[archivo] = new Audio('assets/' + archivo));
  a.currentTime = 0; a.volume = 1; a.play().catch(() => {});
  if (el) { el.classList.add('suena-ya'); setTimeout(() => el.classList.remove('suena-ya'), 900); }
}
let actx = null;
function sfx(tipo) {
  try {
    actx = actx || new AudioContext();
    const t = actx.currentTime, g = actx.createGain(); g.connect(actx.destination);
    const o = actx.createOscillator(); o.connect(g);
    if (tipo === 'pin') { o.type = 'triangle'; o.frequency.setValueAtTime(1300, t); o.frequency.exponentialRampToValueAtTime(260, t + .07); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .09); }
    else { o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + .18); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .22); }
    o.start(t); o.stop(t + .25);
  } catch (e) {}
}

// ── armado fijo ──
$('expediente').textContent = COLEGIO ? 'Expediente: ' + COLEGIO : 'Expediente abierto';
$('pildColegio').textContent = COLEGIO ? 'El tablero de ' + COLEGIO : 'El tablero de su colegio';
$('centroColegio').textContent = COLEGIO || '';
$('botonWeb').href = CONFIG.web;
$('pido').textContent = CONFIG.pido;
$('tiles').innerHTML = CONFIG.piloto.map(([a, b, c]) => `<div data-c="${c}"><b>${a}</b><span>${b}</span></div>`).join('');
vars($('tiles'));
$('numeros').innerHTML = Array.from({ length: 11 }, (_, i) => `<button data-n="${i}">${i}</button>`).join('');
$('numeros').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  apuesta = +b.dataset.n; sfx('pin'); pintarApuesta();
});
function pintarApuesta() {
  document.querySelectorAll('#numeros button').forEach(b => b.classList.toggle('sel', +b.dataset.n === apuesta));
  $('notaN').textContent = apuesta === null ? '¿? de 10' : apuesta + ' de 10';
  $('nota').style.display = apuesta === null ? 'none' : 'block';
  if (apuesta === null) {
    $('finTitulo').textContent = 'Bienvenidos a Inmersia';
    $('finSub').textContent = 'El piloto es para que más alumnos terminen el libro.';
  } else {
    $('finTitulo').textContent = `Usted apostó ${apuesta} de 10.`;
    $('finSub').textContent = 'El piloto es para mover ese número.';
  }
}
pintarApuesta();

// anillo y tarjetas
const CX = 800, CY = 480, R = 215;
// Ángulo del anillo donde llega el hilo de cada pista (y donde se enciende su tramo)
const ANG = [-120, -60, 180, 0, 120, 60];
const polar = (a, r = R) => [CX + r * Math.cos(a * Math.PI / 180), CY + r * Math.sin(a * Math.PI / 180)];
$('anillo').innerHTML = PISTAS.map((p, k) => {
  const a0 = ANG[k] - 27, a1 = ANG[k] + 27, [x0, y0] = polar(a0), [x1, y1] = polar(a1);
  return `<path class="seg" id="seg${k}" d="M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}"/>`;
}).join('');
PISTAS.forEach((p, k) => $('seg' + k).style.setProperty('--g', p.glow));
$('cards').innerHTML = PISTAS.map((p, k) =>
  `<div class="card" id="card${k}" data-k="${k}">
     <i class="pin"></i><span class="tag">${p.tag}</span><b class="ct">${p.titulo}</b><span class="res">${p.res}</span><span class="sello">RESUELTO</span></div>`).join('');
PISTAS.forEach((p, k) => {
  const c = $('card' + k);
  c.style.left = p.x + 'px'; c.style.top = p.y + 'px';
  c.style.setProperty('--rot', p.rot + 'deg'); c.style.setProperty('--col', p.col);
});
$('cuerdas').innerHTML = PISTAS.map((p, k) => {
  const sx = p.x + (p.x < CX ? 140 : -140), sy = p.y, [ex, ey] = polar(ANG[k], R + 10);
  const mx = (sx + ex) / 2, my = (sy + ey) / 2 + 40;
  return `<g id="cuerda${k}"><path class="hilo" d="M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}"/><circle cx="${sx}" cy="${sy}" r="6" fill="#c0392b"/></g>`;
}).join('');
$('cards').addEventListener('click', e => {
  const c = e.target.closest('.card.ok'); if (!c || PASOS[paso].ov) return;
  const k = +c.dataset.k; extra = [k, PISTAS[k].duelo ? 'duelo2' : 'resp']; pintar(false);
});

// ── overlays ──
function htmlOverlay(k, modo) {
  const p = PISTAS[k];
  const cerrar = '<button class="cerrar" title="Cerrar (Esc)">×</button>';
  if (modo === 'pista') return cerrar + `<span class="chip" data-c="${p.col}">${p.tag}</span><h2>${p.titulo}</h2><p class="lead">${p.lead}</p>
    <div class="notas">${p.notas.map((n, i) => `<div class="n" data-bg="${n.c}" data-r="${[-2, 1.5, -1, 2, -1.5][i % 5]}" data-delay="${.35 + i * .25}">
      <b>${n.big}</b><p>${n.txt}</p>${n.src ? `<small>${n.src}</small>` : ''}</div>`).join('')}</div>`;
  if (modo === 'resp') return cerrar + p.resp();
  const foto = modo === 'duelo1'
    ? `<div class="foto r1">`
    : `<div class="foto r2">`;
  const fotocopia = foto + `<div class="cab">CAPITANES INTRÉPIDOS — RUDYARD KIPLING</div>${PAGINA.map(t => `<p>${t}</p>`).join('')}<div class="num">— 40 —</div></div>`;
  if (modo === 'duelo1') return cerrar + `<span class="chip" data-c="${p.col}">${p.tag}</span><h2>El duelo · Ronda 1: así llega el libro hoy</h2>
    <div class="duelo">${fotocopia}
      <div class="reloj"><svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="104" fill="#fff" stroke="#e7dccb" stroke-width="14"/>
        <circle id="arco" cx="120" cy="120" r="104" fill="none" stroke="#f2792a" stroke-width="14" stroke-linecap="round" transform="rotate(-90 120 120)" stroke-dasharray="653.5" stroke-dashoffset="0"/>
        <text id="seg" x="120" y="146" text-anchor="middle" class="t" fill="#4a3622">${CONFIG.segundosDuelo}</text></svg>
        <p id="relojTxt">Léalo con calma.<br>Tiene ${CONFIG.segundosDuelo} segundos.</p></div></div>`;
  return cerrar + `<span class="chip" data-c="${p.col}">${p.tag}</span><h2>El duelo · Ronda 2: la misma página, en Inmersia</h2>
    <div class="duelo">${fotocopia}<div class="vs">VS</div>
      <div class="libro entra">
        <figure class="hoja izq"><img src="assets/ilus-cap2.jpg" alt=""><figcaption>Capítulo 2 · La vida a bordo</figcaption>
          <div class="suena${muteado ? ' mudo' : ''}" id="suena"><span class="barras"><i></i><i></i><i></i><i></i></span><span id="suenaTxt">${muteado ? 'Sonido apagado' : 'Suena: el mar'}</span></div>
          <p class="toque">Toque las frases que brillan</p>
          <div class="num">39</div></figure>
        <div class="hoja der">${PAGINA.map(t => `<p>${conSonidos(t)}</p>`).join('')}<div class="num">40</div></div>
      </div>
      <img class="gato-pag" src="assets/negro-3.webp" alt="">
      <div class="pregunta">¿Cuál cree que leería un chico de 14 años?</div></div>`;
}
function relojDuelo() {
  clearInterval(timer);
  let s = CONFIG.segundosDuelo; const total = s;
  const arco = $('arco'); if (!arco) return;
  timer = setInterval(() => {
    s--; $('seg').textContent = Math.max(s, 0);
    arco.style.transition = 'stroke-dashoffset 1s linear';
    arco.setAttribute('stroke-dashoffset', 653.5 * (1 - s / total));
    if (s <= 0) { clearInterval(timer); $('relojTxt').innerHTML = '¿Ya?<br>¿Qué recuerda?'; sfx('sello'); }
  }, 1000);
}
$('ov').addEventListener('click', e => {
  if (e.target.closest('.cerrar')) cerrarOverlay();
  const f = e.target.closest('.sfx');
  if (f) { efecto(f.dataset.sfx, f); return; }
  const s = e.target.closest('.suena');
  if (s) { muteado = !muteado; s.classList.toggle('mudo', muteado); $('suenaTxt').textContent = muteado ? 'Sonido apagado' : 'Suena: el mar'; muteado ? marOff() : marOn(); }
});
$('velo').addEventListener('click', cerrarOverlay);
function cerrarOverlay() {
  if (extra) { extra = null; pintar(false); return; }
  if (PASOS[paso].ov) ir(paso + 1);
}

// ── pintar el paso actual ──
function pintar(animar) {
  const P = PASOS[paso];
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  $(P.s).classList.add('on');
  clearInterval(timer);
  const ov = extra || P.ov;
  const sonando = ov && ov[1] === 'duelo2';
  if (!sonando) marOff();

  if (P.s === 'tablero') {
    const tab = $('tablero');
    tab.classList.toggle('cerrado', !!P.cerrado); tab.classList.remove('abre');
    $('selloCentro').textContent = P.cerrado ? 'CASO CERRADO' : 'CASO ABIERTO';
    PISTAS.forEach((p, k) => {
      const c = $('card' + k), vis = k < P.v, ok = k < P.r;
      c.classList.toggle('vis', vis); c.classList.toggle('ok', ok);
      c.classList.toggle('entra', animar && P.nueva === k);
      c.classList.toggle('recien', animar && P.resuelta === k);
      $('cuerda' + k).style.display = vis ? '' : 'none';
      const h = $('cuerda' + k).querySelector('.hilo');
      h.classList.toggle('ok', ok); h.style.stroke = ok ? p.glow : '';
      const s = $('seg' + k); s.classList.toggle('on', ok); s.style.stroke = ok ? p.glow : '';
    });
    if (animar && P.nueva !== undefined) setTimeout(() => sfx('pin'), 250);
    if (animar && P.resuelta !== undefined) setTimeout(() => sfx('sello'), 120);
  }
  if (P.s === 'final') $('final').classList.toggle('entra', animar);

  const o = $('ov'), v = $('velo');
  if (ov) {
    const mismo = o.dataset.k == ov[0] && o.dataset.m === ov[1] && o.classList.contains('on');
    if (!mismo) {
      o.innerHTML = htmlOverlay(ov[0], ov[1]); o.dataset.k = ov[0]; o.dataset.m = ov[1]; vars(o);
      o.classList.remove('pop'); void o.offsetWidth; if (animar || extra) o.classList.add('pop');
    }
    o.classList.add('on'); v.classList.add('on');
    if (ov[1] === 'duelo1' && !extra) relojDuelo();
    if (sonando) marOn();
  } else {
    o.classList.remove('on'); v.classList.remove('on'); o.dataset.m = '';
  }
  $('cont').textContent = (paso + 1) + ' / ' + PASOS.length;
}

let enPortal = false;
function ir(n) {
  if (enPortal) return;
  n = Math.max(0, Math.min(PASOS.length - 1, n));
  if (n === paso) return;
  extra = null;
  const adelante = n === paso + 1;
  if (adelante && PASOS[paso].cerrado && PASOS[n].s === 'final') {
    enPortal = true; marOff(); sfx('sello');
    $('tablero').classList.add('abre'); $('flash').classList.add('va');
    setTimeout(() => { paso = n; pintar(true); $('flash').classList.remove('va'); enPortal = false; }, 1250);
    return;
  }
  paso = n; pintar(adelante);
}
$('entrar').addEventListener('click', () => ir(paso + 1));
$('prev').onclick = () => ir(paso - 1);
$('next').onclick = () => ir(paso + 1);
document.addEventListener('keydown', e => {
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); ir(paso + 1); }
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); ir(paso - 1); }
  else if (e.key === 'Escape') { if (extra) cerrarOverlay(); }
  else if (e.key === 'Home') ir(0);
  else if (e.key === 'End') ir(PASOS.length - 1);
  else if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {});
  else if (e.key === 'h' || e.key === 'H') $('nav').classList.toggle('oculto');
  else if (PASOS[paso].s === 'apuesta' && /^[0-9]$/.test(e.key)) { apuesta = +e.key; pintarApuesta(); sfx('pin'); }
});

function escalar() {
  const k = Math.min(innerWidth / 1600, innerHeight / 900);
  $('stage').style.transform = `scale(${k})`;
}
addEventListener('resize', escalar); escalar();
// ?paso=N abre directo en ese paso; ?apuesta=N deja la apuesta hecha (para ensayar)
paso = Math.max(0, Math.min(PASOS.length - 1, +(qs.get('paso') || 0)));
if (qs.has('apuesta')) { apuesta = +qs.get('apuesta'); pintarApuesta(); }
pintar(false);

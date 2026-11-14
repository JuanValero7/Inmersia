// «Ver cómo es» de los juegos. Pinta lo que la página define en window.JUEGOS:
// por juego, su ficha (qué es, cuándo aparece, qué ves tú en Mis lectores) y
// los pasos con su captura real (img/<prefijo>_<m|d>_<paso>.webp). Un paso con
// `solo: 'm'` existe solo en el teléfono. El modo (teléfono/computadora) vale
// para toda la página; empieza en teléfono.
(function () {
  const JUEGOS = window.JUEGOS || []
  let modo = 'm'
  const estado = {}  // id del juego → índice del paso

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const pasos = (j) => j.pasos.filter(p => !p.solo || p.solo === modo)
  const img = (j, p) => `img/${j.prefijo}_${modo}_${p.img}.webp`

  function pintarVisor(j) {
    const el = document.querySelector(`#${j.id} .visor`)
    const ps = pasos(j)
    const k = Math.min(estado[j.id] || 0, ps.length - 1)
    estado[j.id] = k
    const p = ps[k]
    const marco = modo === 'm'
      ? `<div class="tel"><img src="${img(j, p)}" alt="${esc(p.t)}"></div>`
      : `<div class="pc"><div class="pc-barra"><i></i><i></i><i></i></div><img src="${img(j, p)}" alt="${esc(p.t)}"></div>`
    el.innerHTML = `
      <div class="paso-cab"><span class="paso-n">${k + 1}</span>
        <div><h3>${esc(p.t)}</h3><p>${esc(p.d)}</p></div><span class="de">${k + 1} de ${ps.length}</span></div>
      <div class="escena">
        <button type="button" class="flecha" data-ir="-1" aria-label="Paso anterior" ${k === 0 ? 'disabled' : ''}>‹</button>
        ${marco}
        <button type="button" class="flecha" data-ir="1" aria-label="Paso siguiente" ${k === ps.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      <div class="minis">${ps.map((q, i) => `<button type="button" data-paso="${i}" class="${i === k ? 'on' : ''}" aria-label="Paso ${i + 1}: ${esc(q.t)}"><img src="${img(j, q)}" alt="" loading="lazy"></button>`).join('')}</div>`
    el.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { estado[j.id] = k + Number(b.dataset.ir); pintarVisor(j) })
    el.querySelectorAll('[data-paso]').forEach(b => b.onclick = () => { estado[j.id] = Number(b.dataset.paso); pintarVisor(j) })
    // Precarga el siguiente para que la flecha no espere.
    if (ps[k + 1]) new Image().src = img(j, ps[k + 1])
  }

  function pintar() {
    document.getElementById('juegos').innerHTML = JUEGOS.map(j => `
      <section class="juego" id="${j.id}">
        <aside class="info">
          <div class="kicker">${esc(j.kicker)}</div>
          <h2>${esc(j.nombre)}</h2>
          <p class="lead">${esc(j.lead)}</p>
          <dl>
            <dt>Cuándo aparece</dt><dd>${esc(j.cuando)}</dd>
            <dt>Qué entrena</dt><dd>${esc(j.mide)}</dd>
            <dt>Qué ves tú en Mis lectores</dt><dd>${esc(j.tu)}</dd>
          </dl>
        </aside>
        <div class="visor"></div>
      </section>`).join('')
    JUEGOS.forEach(pintarVisor)
  }

  document.querySelectorAll('.modo button').forEach(b => b.onclick = () => {
    modo = b.dataset.modo
    document.querySelectorAll('.modo button').forEach(x => x.classList.toggle('on', x === b))
    JUEGOS.forEach(pintarVisor)
  })
  // Flechas del teclado: mueven el juego que está más a la vista.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const centro = window.innerHeight / 2
    const j = JUEGOS.map(x => [x, document.getElementById(x.id).getBoundingClientRect()])
      .sort((a, b) => Math.abs((a[1].top + a[1].bottom) / 2 - centro) - Math.abs((b[1].top + b[1].bottom) / 2 - centro))[0]?.[0]
    if (!j) return
    const n = pasos(j).length
    estado[j.id] = Math.max(0, Math.min(n - 1, (estado[j.id] || 0) + (e.key === 'ArrowRight' ? 1 : -1)))
    pintarVisor(j)
  })

  pintar()
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView()
})()

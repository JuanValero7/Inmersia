// Formato: Plain JavaScript (.jsx)
// La mesa de investigación (método Anderson), con la disposición de la maqueta
// combinada (Documents/Inmersia_maquetas/colegios/maqueta-mesa-combinada.html):
//   · móvil: personajes en chips · mesa de madera con 3 cartas · aviso de lo que
//     hay por descubrir · pestañas Pistas / Ficha;
//   · PC: personajes, «Lo que sabes de…» y la mesa a la izquierda; las pistas a
//     la derecha.
// Las reglas viven en la base de datos (migración 087): aquí solo se elige y se
// pinta el estado que devuelve. Cabecera y navegación las pone quien la monta
// (Cartelera.jsx / CarteleraMobile.jsx).
import { useState } from 'react'
import { useMesaInvestigacion } from '../../hooks/useMesaInvestigacion.js'
import '../../styles/mesa.css'

const LETRAS = ['A', 'B', 'C']
const VACIO = [null, null, null]

function Ovillo() {
  return (
    <svg className="mesa-ovillo" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M33 33 q5 9 13 7" className="mesa-ovillo-hebra" />
      <circle cx="22" cy="22" r="17" className="mesa-ovillo-bola" />
      <g className="mesa-ovillo-hebra"><path d="M8 16 q14 -7 27 5" /><path d="M6 24 q16 -9 31 4" /><path d="M10 32 q13 -10 25 -1" /><path d="M17 6 q-7 15 2 32" /><path d="M26 6 q-8 15 0 32" /></g>
    </svg>
  )
}

/** Busca el retrato de un personaje entre los de la Cartelera (ya filtrados por capítulo). */
function retratoDe(pj, personajesCartelera = []) {
  const n = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const it = personajesCartelera.find(c => n(c.nombre) === n(pj.nombre))
    || personajesCartelera.find(c => n(c.nombre).includes(n(pj.corto)))
  return it?.imagen?.url || null
}

/**
 * @param {object} props
 * @param {string|null} props.libroId
 * @param {string|null} props.userId
 * @param {boolean} [props.movil]
 * @param {object[]} [props.personajesCartelera]   para los retratos de los chips
 */
export default function MesaInvestigacion({ libroId, userId, movil = false, personajesCartelera = [] }) {
  const { estado, cargando, jugar, elegir, ocupado } = useMesaInvestigacion(libroId, userId)
  const [pjSel, setPjSel] = useState(null)
  const [lab, setLab] = useState(VACIO)
  const [aviso, setAviso] = useState(null)     // { tipo: 'ok'|'bad', titulo, texto, extras: [] }
  const [ver, setVer] = useState(null)         // pista con la cita abierta
  const [tab, setTab] = useState('pistas')

  if (cargando) return <div className="mesa-root mesa-cargando"><div className="spinner" /></div>
  if (!estado) return <div className="mesa-root"><p className="mesa-vacio">Este libro todavía no tiene mesa de investigación.</p></div>

  const abierta = estado.abierta
  const personajes = estado.personajes
  // Con una jugada abierta, la mesa se queda en su personaje hasta elegir la conclusión.
  const pjId = abierta?.personaje
    || (personajes.some(p => p.id === pjSel) ? pjSel : personajes[0]?.id) || null
  const pj = personajes.find(p => p.id === pjId) || null

  const piezas = [
    ...estado.cartas.map(c => ({ ...c, comp: true })),
    ...estado.pistas,
  ]
  const porId = Object.fromEntries(piezas.map(p => [p.id, p]))
  const delPj = piezas.filter(p => p.pj === pjId)
  const parejas = estado.parejas || []
  const enMesa = abierta ? abierta.pistas : lab
  const lleno = lab.every(Boolean)

  const elegirPj = (id) => {
    if (abierta || id === pjId) return
    setPjSel(id); setLab(VACIO); setAviso(null); setVer(null)
  }
  const poner = (id) => {
    if (abierta || ocupado || lab.includes(id)) return
    const i = lab.indexOf(null)
    if (i < 0) return
    setAviso(null)
    setLab(lab.map((x, k) => (k === i ? id : x)))
  }
  const quitar = (i) => { if (!abierta && !ocupado) { setAviso(null); setLab(lab.map((x, k) => (k === i ? null : x))) } }

  const combinar = async () => {
    if (!lleno || ocupado || !pjId) return
    try {
      const r = await jugar({ personaje: pjId, pistas: lab })
      setLab(VACIO)
      if (r.resultado === 'casi') setAviso({ tipo: 'bad', titulo: 'Casi', texto: 'Dos de estas sí van juntas: te las dejé marcadas con 🔗 en la lista.' })
      else if (r.resultado === 'no_encajan') setAviso({ tipo: 'bad', titulo: 'No encajan juntas', texto: 'Prueba con tres que cuenten algo en común.' })
      else setAviso(null)
    } catch (e) {
      setAviso({ tipo: 'bad', titulo: 'No se pudo jugar', texto: e.message })
    }
  }

  const concluir = async (opcion) => {
    if (!abierta || ocupado) return
    try {
      const r = await elegir({ jugada: abierta.jugada, opcion })
      if (r.resultado === 'acierto') {
        const extras = []
        if (r.pasan) extras.push(r.pasan === 1 ? 'Otra pista que también lo mostraba pasa a la ficha.' : `Otras ${r.pasan} pistas que también lo mostraban pasan a la ficha.`)
        if (r.quedan) extras.push(r.quedan === 1 ? 'Una de las tres se queda en la lista: todavía sirve para otra cosa.' : `${r.quedan} de las tres se quedan en la lista: todavía sirven para otra cosa.`)
        if (r.premio) extras.push(`¡Perfil al día! Ganas ${r.premio} ovillos.`)
        setAviso({ tipo: 'ok', titulo: '¡Nueva deducción!', texto: r.texto, extras })
      } else {
        setAviso({ tipo: 'bad', titulo: 'No es eso', texto: 'Las pistas vuelven a la lista; esa respuesta queda tachada.' })
      }
    } catch (e) {
      setAviso({ tipo: 'bad', titulo: 'No se pudo elegir', texto: e.message })
    }
  }

  // ── Piezas ──
  const chips = (
    <div className="mesa-chips" role="tablist" aria-label="Personajes">
      {personajes.map(p => {
        const foto = retratoDe(p, personajesCartelera)
        return (
          <button key={p.id} type="button" role="tab" className="mesa-chip" aria-selected={p.id === pjId}
            disabled={!!abierta && p.id !== pjId} onClick={() => elegirPj(p.id)}>
            {foto ? <img src={foto} alt="" /> : <span className="mesa-chip-ini">{p.corto[0]}</span>}
            {p.corto} <small>{p.hechas}/{p.total}</small>
            {p.nuevas > 0 && <span className="mesa-chip-nuevo" title="Pistas nuevas" />}
          </button>
        )
      })}
    </div>
  )

  const marcas = (id) => parejas.map((par, i) => (par.includes(id)
    ? <span key={i} className={`mesa-par par-${i % 6}`} title="Va junto con otra pista marcada igual">🔗{i + 1}</span> : null))

  const cartaMesa = (id, i, mini) => {
    const p = porId[id]
    if (!p) return null
    return (
      <div key={i} className={`mesa-cartax${p.comp ? ' is-comp' : ''}`}
        {...(mini ? {} : { role: 'button', tabIndex: 0, onClick: () => quitar(i), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); quitar(i) } } })}>
        <span className="mesa-cartax-cp">{p.comp ? 'DEDUCCIÓN' : `CAP. ${p.cap}`}</span>
        <span className="mesa-cartax-palo">{p.comp ? '★' : '♦'}</span>
        <span className="mesa-cartax-t">{p.comp ? p.texto : p.resumen}</span>
        {!mini && <span className="mesa-cartax-x" title="Devolver">×</span>}
      </div>
    )
  }

  const mesa = (
    <div className="mesa-tabla">
      {aviso && !abierta && (
        <div className={`mesa-res is-${aviso.tipo}`} role="status">
          <span className="mesa-res-k">{aviso.titulo}</span>
          {aviso.texto && <span className={aviso.tipo === 'ok' ? 'mesa-res-big' : ''}>{aviso.texto}</span>}
          {(aviso.extras || []).map((x, i) => <span key={i}>{x}</span>)}
        </div>
      )}
      {abierta ? (<>
        <div className="mesa-slots is-mini">{abierta.pistas.map((id, i) => cartaMesa(id, i, true))}</div>
        <div className="mesa-q">¿Qué te dicen estas tres?</div>
        <div className="mesa-opts">
          {abierta.opciones.map((o, i) => (
            <button key={i} type="button" className="mesa-opt" disabled={abierta.tachadas.includes(i) || ocupado} onClick={() => concluir(i)}>
              <span className="mesa-opt-lt">{LETRAS[i]}</span>{o}
            </button>
          ))}
        </div>
      </>) : (<>
        <div className="mesa-slots">
          {enMesa.map((id, i) => (id ? cartaMesa(id, i, false) : <div key={i} className="mesa-cartax is-vacia">Pista {i + 1}</div>))}
        </div>
        <div className="mesa-btns">
          <span className="mesa-saldo" title="Tus ovillos en este libro"><Ovillo />{estado.saldo}</span>
          <button type="button" className="mesa-jugar" onClick={combinar} disabled={!lleno || ocupado || estado.saldo < 1}>
            {ocupado ? 'Pensando…' : 'Jugar'} <small><Ovillo />1</small>
          </button>
        </div>
        {estado.saldo < 1 && <div className="mesa-sin-ovillos">Te quedaste sin ovillos.</div>}
      </>)}
    </div>
  )

  const pendientes = pj && (
    <div className="mesa-pend">
      {pj.por_descubrir + pj.mas_adelante === 0
        ? <b>¡Perfil completo!</b>
        : <>🔎 {pj.por_descubrir
            ? <><b>{pj.por_descubrir} {pj.por_descubrir === 1 ? 'deducción' : 'deducciones'} por descubrir</b> con lo que ya leíste</>
            : 'Nada por descubrir con lo que ya leíste'}
          {pj.mas_adelante > 0 && ' · sigue leyendo para más'}</>}
    </div>
  )

  const carta = (p) => {
    const enLab = enMesa.includes(p.id)
    const pulsar = () => poner(p.id)
    const teclas = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pulsar() } }
    if (p.comp) {
      return (
        <div key={p.id} role="button" tabIndex={0} className={`mesa-carta is-comp${enLab ? ' en-mesa' : ''}`} onClick={pulsar} onKeyDown={teclas}>
          <span className="mesa-carta-tag">Deducción</span>
          <span className="mesa-carta-t">{p.texto}</span>
          <span className="mesa-pars">{marcas(p.id)}</span>
        </div>
      )
    }
    return (
      <div key={p.id} role="button" tabIndex={0} className={`mesa-carta${enLab ? ' en-mesa' : ''}`} onClick={pulsar} onKeyDown={teclas}>
        <span className="mesa-carta-pin" />
        {p.cap === estado.capitulos_completados && <span className="mesa-carta-tag">Nuevo</span>}
        <span><span className="mesa-carta-cap">Cap. {p.cap}</span></span>
        <span className="mesa-carta-t">{p.resumen}</span>
        {ver === p.id && <span className="mesa-carta-cita">«{p.cita}»</span>}
        <button type="button" className="mesa-carta-ver" onClick={(e) => { e.stopPropagation(); setVer(ver === p.id ? null : p.id) }}>
          {ver === p.id ? 'Cerrar' : 'Ver en el libro'}
        </button>
        <span className="mesa-pars">{marcas(p.id)}</span>
      </div>
    )
  }

  const lista = (
    <div className="mesa-lista">
      {delPj.map(carta)}
      {delPj.length === 0 && (
        <div className="mesa-vacio">
          {pj?.hechas ? 'No te quedan pistas por alinear de este personaje.' : `Todavía no hay pistas de ${pj?.corto}.`} Sigue leyendo para encontrar más.
        </div>
      )}
    </div>
  )

  // «Lo que te faltó» solo llega al terminar el libro y quedarse sin ovillos (migración 088).
  const libroTerminado = estado.total_capitulos > 0 && estado.capitulos_completados >= estado.total_capitulos
  const faltaron = (estado.faltaron || []).filter(f => f.pj === pjId)
  const ficha = pj && (
    <div className="mesa-ficha">
      <div className="mesa-ficha-h">LO QUE SABES DE<b>{pj.nombre}</b></div>
      {pj.deducciones.map(d => (
        <div key={d.id} className="mesa-concl">
          {d.texto}
          {d.confirman > 0 && <small>+{d.confirman} {d.confirman === 1 ? 'pista más lo confirma' : 'pistas más lo confirman'}</small>}
        </div>
      ))}
      {pj.por_descubrir > 0 && <div className="mesa-falta">{pj.por_descubrir} {pj.por_descubrir === 1 ? 'deducción' : 'deducciones'} por descubrir con lo que ya leíste</div>}
      {pj.mas_adelante > 0 && !libroTerminado && <div className="mesa-falta is-leer">Sigue leyendo: hay más por descubrir</div>}
      {libroTerminado && !estado.faltaron && pj.por_descubrir + pj.mas_adelante > 0 && (
        <div className="mesa-falta is-leer">Terminaste el libro: sigue jugando. Lo que te faltó se muestra cuando te quedes sin ovillos.</div>
      )}
      {faltaron.length > 0 && (
        <div className="mesa-faltaron">
          <div className="mesa-faltaron-h">Lo que te faltó</div>
          {faltaron.map((f, i) => (
            <div key={i} className="mesa-faltaron-it">
              <b>{f.texto}</b>
              <ul>{f.pistas.map((t, k) => <li key={k}>{t}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (personajes.length === 0) {
    return (
      <div className={`mesa-root ${movil ? 'is-movil' : 'is-pc'}`}>
        <p className="mesa-vacio">Todavía no hay nadie en la mesa. Sigue leyendo: los personajes llegan cuando el libro te cuenta quiénes son.</p>
      </div>
    )
  }

  if (movil) {
    return (
      <div className="mesa-root is-movil">
        {chips}
        {mesa}
        <div className="mesa-bajo">
          {pendientes}
          <div className="mesa-seg" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'pistas'} onClick={() => setTab('pistas')}>Pistas de {pj?.corto}</button>
            <button type="button" role="tab" aria-selected={tab === 'ficha'} onClick={() => setTab('ficha')}>Ficha</button>
          </div>
          {tab === 'pistas' ? lista : ficha}
        </div>
      </div>
    )
  }

  return (
    <div className="mesa-root is-pc">
      <div className="mesa-izq">
        {chips}
        {pendientes}
        {ficha}
        {mesa}
      </div>
      <div className="mesa-der">
        <span className="mesa-washi">Pistas de {pj?.corto}</span>
        {lista}
      </div>
    </div>
  )
}

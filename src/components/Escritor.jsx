// Rincón del escritor — ruta /escritor (solo escritorio).
// Maqueta aprobada: Documents/Inmersia_maquetas/escritor/rincon-escritor.html
// (pantallas 1 y 3: el estudio con su repisa). Desde aquí se abren las
// salas de Sonido, Imágenes, Análisis y Juegos (fase 5: pedidos que
// prepara Juan; él los ve en /escritor/pedidos).
// En el teléfono no hay versión (decisión de Juan): se dice que se use la
// computadora.
// Quién ve qué lo decide la base (migración 103): aquí solo se pinta.
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import useIsMobile from '../hooks/useIsMobile.js'
import { usePerfilQuery } from '../lib/queries.js'
import { useEscritorQuery, useLibrosEscritorQuery, useBorrarLibroEscritor, mensajeErrorEscritor } from '../hooks/useEscritor.js'
import Repisa from './escritor/Repisa.jsx'
import TarjetasLibro from './escritor/TarjetasLibro.jsx'
import ModalSubirLibro from './escritor/ModalSubirLibro.jsx'
import SalaSonido from './escritor/SalaSonido.jsx'
import SalaImagenes from './escritor/SalaImagenes.jsx'
import SalaAnalisis from './escritor/SalaAnalisis.jsx'
import SalaJuegos from './escritor/SalaJuegos.jsx'
import '../styles/escritor.css'

const GATO = '/assets/landing/gatos/blanco-2.webp'

/**
 * @param {object} props
 * @param {{ id: string, email?: string }} props.user
 * @param {() => void} props.onLeer      vuelve a la Biblioteca
 * @param {() => void} props.onGoPerfil
 * @param {(slug: string) => void} props.onPonerSonido  abre el libro en el lector con el panel de sonidos
 * (ficción: Sonido abre la Sala de sonido, con «hazlo tú» y «automático»; fase 2b)
 */
export default function Escritor({ user, onLeer, onGoPerfil, onPonerSonido, isSuperuser = false, onPedidos, onLectores }) {
  const isMobile = useIsMobile()
  const { data: escritor, isLoading: cargandoEscritor, isError: errorEscritor } = useEscritorQuery(user?.id)
  const { data: libros = [], isLoading: cargandoLibros } = useLibrosEscritorQuery(user?.id, !!escritor)
  const { data: perfil } = usePerfilQuery(user?.id)
  const borrar = useBorrarLibroEscritor(user?.id)
  const [subiendo, setSubiendo] = useState(false)
  // Al volver de «Ver en la cartelera», se reabre la sala con su libro.
  const location = useLocation()
  const [elegidoId, setElegidoId] = useState(location.state?.libroId ?? null)
  const [infoRuidos, setInfoRuidos] = useState(false)
  const [sala, setSala] = useState(location.state?.sala ?? null) // 'sonido' | 'imagenes' | 'analisis' | 'juegos'

  const nombre = perfil?.nombre ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : ''
  const inicial = (nombre || user?.email || '?').charAt(0).toUpperCase()
  const elegido = libros.find(l => l.id === elegidoId) || libros[0] || null

  const cabecera = (
    <header className="esc-cab"><div className="esc-cab-in">
      <img src="/assets/inmersia-logo.png" alt="Inmersia" />
      <span className="esc-lugar">Rincón del escritor</span>
      <span className="esc-hueco" />
      {isSuperuser && <button type="button" className="esc-pill esc-plana" onClick={onPedidos}>Pedidos de juegos</button>}
      <button type="button" className="esc-pill esc-plana" onClick={onLeer}>Leer en Inmersia</button>
      <button type="button" className="esc-avatar" onClick={onGoPerfil} title="Mi perfil" aria-label="Mi perfil">{inicial}</button>
    </div></header>
  )

  if (isMobile) {
    return (
      <div className="esc-page">
        <div className="esc-aviso">
          <img src={GATO} alt="" />
          <h1>Rincón del escritor</h1>
          <p>Tu libro se trabaja desde la computadora. Entra a inmersia.io desde ahí y lo encuentras en tu estudio.</p>
          <button type="button" className="esc-pill" onClick={onLeer}>Volver a la biblioteca</button>
        </div>
      </div>
    )
  }

  if (cargandoEscritor) {
    return <div className="esc-page">{cabecera}<p className="esc-msg">Abriendo tu estudio…</p></div>
  }
  if (errorEscritor) {
    return <div className="esc-page">{cabecera}<p className="esc-msg">No pudimos abrir tu estudio. Revisa tu conexión.</p></div>
  }
  if (!escritor) {
    return (
      <div className="esc-page">{cabecera}
        <div className="esc-aviso">
          <img src={GATO} alt="" />
          <h1>El Rincón del escritor</h1>
          <p>Aquí los escritores suben su libro y le ponen sonido, imágenes y juegos. Tu cuenta todavía no tiene el modo escritor. Si te dieron un código de escritor, canjéalo en Comunidades → Tengo una invitación.</p>
        </div>
      </div>
    )
  }

  const pedirBorrado = async (libro) => {
    const ok = window.confirm(`¿Eliminar «${libro.titulo}»?\n\nSe borra todo: el texto y lo que le hayas hecho. No se puede deshacer.`)
    if (!ok) return
    try {
      await borrar.mutateAsync(libro.id)
      setElegidoId(null)
    } catch (e) {
      window.alert(mensajeErrorEscritor(e, 'No pudimos eliminar el libro. Inténtalo de nuevo.'))
    }
  }

  if (sala === 'sonido' && elegido?.es_ficcion) {
    return (
      <div className="esc-page">
        {cabecera}
        <SalaSonido user={user} libro={elegido} saldo={Number(escritor.saldo_cupon)}
          onVolver={() => setSala(null)} onAbrirLibro={() => onPonerSonido(elegido.slug)} />
      </div>
    )
  }
  if (sala === 'imagenes' && elegido) {
    return (
      <div className="esc-page">
        {cabecera}
        <SalaImagenes user={user} libro={elegido} saldo={Number(escritor.saldo_cupon)} onVolver={() => setSala(null)} />
      </div>
    )
  }

  if (sala === 'juegos' && elegido) {
    return (
      <div className="esc-page">
        {cabecera}
        <SalaJuegos user={user} libro={elegido} saldo={Number(escritor.saldo_cupon)}
          onVolver={() => setSala(null)} onIrAnalisis={() => setSala('analisis')} />
      </div>
    )
  }
  if (sala === 'analisis' && elegido) {
    return (
      <div className="esc-page">
        {cabecera}
        <SalaAnalisis user={user} libro={elegido} saldo={Number(escritor.saldo_cupon)} onVolver={() => setSala(null)} />
      </div>
    )
  }

  return (
    <div className="esc-page esc-estudio-ancho">
      {cabecera}
      <main className="esc-rincon">
        <div className="esc-rincon-cab">
          <img src={GATO} alt="" />
          <div className="esc-rincon-txt">
            <h1>Tu estudio</h1>
            <p>Aquí viven tus libros. Súbelo una vez y desde aquí le pones sonido, imágenes y juegos.</p>
          </div>
          <button type="button" className="esc-pill esc-naranja esc-grande" onClick={() => setSubiendo(true)}>＋ Agregar libro</button>
        </div>

        <Repisa libros={libros} cargando={cargandoLibros} elegidoId={elegido?.id}
          onElegir={(id) => { setElegidoId(id); setInfoRuidos(false) }} onAgregar={() => setSubiendo(true)} />

        {!cargandoLibros && libros.length === 0 && (
          <p className="esc-vacio-nota">Tu repisa está vacía. Tu primer libro aparecerá aquí.</p>
        )}

        {elegido && (
          <section className="esc-herramientas">
            <div className="esc-herr-tit">
              <h2>{elegido.titulo}</h2>
              <span>
                {elegido.capitulos} capítulos · {elegido.palabras.toLocaleString('es')} palabras
                {!elegido.portada_url && ' · sin portada todavía'}
              </span>
              <span className="esc-hueco" />
              <button type="button" className="esc-borrar" disabled={borrar.isPending}
                onClick={() => pedirBorrado(elegido)}>
                {borrar.isPending ? 'Eliminando…' : 'Eliminar libro'}
              </button>
            </div>
            <TarjetasLibro infoRuidos={infoRuidos}
              onSala={(s) => (s === 'sonido' && !elegido.es_ficcion ? setInfoRuidos(v => !v) : setSala(s))}
              onLectores={() => onLectores(elegido.id)} />
            {infoRuidos && !elegido.es_ficcion && (
              <div className="esc-info-ruidos">
                <h3>Tu libro ya tiene sonido</h3>
                <p>Los libros de no ficción no llevan efectos ni ambientes: distraerían de las ideas. En su lugar, tus lectores tienen siempre a mano ruidos para concentrarse (blanco, rosa, marrón, lluvia, río, olas y fuego) y los mezclan como quieran. No tienes que hacer nada ni cuesta nada.</p>
              </div>
            )}
          </section>
        )}
      </main>

      {subiendo && (
        <ModalSubirLibro user={user} autorPorDefecto={nombre}
          onCerrar={() => setSubiendo(false)}
          onGuardado={(id) => setElegidoId(id)} />
      )}
    </div>
  )
}

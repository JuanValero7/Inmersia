// Perfil → Denuncias (solo superusuario). Lo que se denunció en las
// comunidades y las acciones de moderación. Datos y acciones en
// src/hooks/useDenuncias.js (migración 060).
import { useState } from 'react'
import { useDenunciasQuery, useResolverDenuncia } from '../../hooks/useDenuncias.js'
import { haceCuanto } from '../../hooks/useCapaComunidad.js'
import '../../styles/comunidades.css'

const TIPO = {
  comentario_lectura: 'Comentario en el libro',
  mensajito: 'Mensajito',
  foro: 'Comentario del foro',
  comunidad: 'Comunidad',
}
const SELLO = {
  descartada: 'Descartada',
  borrado: 'Contenido borrado',
  sacado: 'Sacado de la comunidad',
  renombrada: 'Nombre y descripción quitados',
  cerrada: 'Comunidad cerrada',
}

function estadoOriginal(d) {
  if (d.tipo === 'comunidad') return d.original_existe ? 'La comunidad sigue abierta' : 'La comunidad ya no existe'
  if (d.original_existe) return 'El original sigue publicado'
  if (d.tipo === 'mensajito') return 'Ya no existe: lo borró quien lo recibió o se borró al leerlo'
  return 'Ya no existe: lo borró su autor o un moderador'
}

function Tarjeta({ d, resuelta, resolver, ocupada }) {
  const [confirmando, setConfirmando] = useState(null)   // 'borrar' | 'sacar' | 'renombrar' | 'cerrar'
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState(null)
  const esComunidad = d.tipo === 'comunidad'
  const autor = d.denunciado_nombre || 'Alguien que ya no está en Inmersia'
  const ocupado = ocupada === d.id

  const aplicar = async (accion) => {
    setError(null)
    const err = await resolver(d.id, accion)
    if (err) setError(err)
    setConfirmando(null)
  }

  const textos = {
    borrar: [`¿Borrar ${d.tipo === 'mensajito' ? 'el mensajito' : 'el comentario'} de ${autor}? No se puede deshacer.`, 'Borrar'],
    sacar: [esComunidad
      ? `¿Sacar a ${autor} de su comunidad? La moderación pasa al siguiente miembro.`
      : `¿Sacar a ${autor} de ${d.comunidad_nombre}? ${d.comunidad_privada ? 'Solo podrá volver con el código de invitación.' : 'Como es pública, podrá volver a unirse.'}`, 'Sacar'],
    renombrar: ['La comunidad pasará a llamarse «Comunidad sin nombre», sin descripción. Su moderador tendrá que ponerle otro nombre.', 'Quitar'],
    cerrar: ['Se borra la comunidad con sus miembros, comentarios y mensajitos. No se puede deshacer. Escribe su nombre para confirmar:', 'Cerrar para siempre'],
  }
  const puedeSacar = !!d.denunciado_id && !!d.comunidad_id

  return (
    <article className="dn-den">
      <div className="dn-top">
        <span className={'dn-tipo ' + d.tipo}>{TIPO[d.tipo] || d.tipo}</span>
        <span className="dn-donde">
          {d.comunidad_nombre || 'Foro general'}
          <span> · {esComunidad
            ? `${d.comunidad_privada ? 'Privada' : 'Pública'} · ${d.comunidad_miembros} miembro${d.comunidad_miembros === 1 ? '' : 's'}`
            : (d.libro_titulo || 'sin libro')}</span>
        </span>
        <span className="dn-cuando">{haceCuanto(d.created_at)}</span>
      </div>

      <dl className="dn-gente">
        <dt>{esComunidad ? 'Modera' : 'Escribió'}</dt>
        <dd>{autor} {d.reincidencias > 0
          ? <span className="dn-reinc">{d.reincidencias} denuncia{d.reincidencias > 1 ? 's' : ''} antes</span>
          : <span className="dn-primera">primera denuncia</span>}</dd>
        <dt>Denunció</dt>
        <dd>{d.denunciante_nombre || 'Alguien que ya no está en Inmersia'}</dd>
      </dl>

      {d.motivo && <div className="dn-motivo-tag">Motivo: <em>{d.motivo}</em></div>}
      <div className="dn-texto">{d.contenido || '(sin texto)'}</div>
      {d.parrafo_texto && <div className="dn-parrafo"><b>En el párrafo</b>«{d.parrafo_texto.length > 140 ? d.parrafo_texto.slice(0, 140) + '…' : d.parrafo_texto}»</div>}
      <div className={'dn-orig' + (d.original_existe ? '' : ' no')}><i aria-hidden="true" />{estadoOriginal(d)}</div>

      {resuelta ? (
        <div className="dn-resuelta">
          <span className={'dn-sello ' + d.resolucion}>{SELLO[d.resolucion] || 'Revisada'}</span>
          {d.resuelta_at && <span>{haceCuanto(d.resuelta_at)}</span>}
          <button type="button" className="dn-deshacer" disabled={ocupado} onClick={() => aplicar('deshacer')}>Deshacer</button>
        </div>
      ) : (
        <div className="dn-acciones">
          <button type="button" className="com-btn sm" disabled={ocupado} onClick={() => aplicar('descartar')}>Descartar</button>
          {esComunidad ? (
            <>
              <button type="button" className="com-btn sm" disabled={ocupado || !d.original_existe} onClick={() => setConfirmando('renombrar')}>Quitar nombre y descripción</button>
              <button type="button" className="com-btn sm" disabled={ocupado || !puedeSacar || !d.original_existe} onClick={() => setConfirmando('sacar')}>Sacar al moderador</button>
              <button type="button" className="com-btn sm dn-rojo" disabled={ocupado || !d.original_existe} onClick={() => { setNombre(''); setConfirmando('cerrar') }}>Cerrar la comunidad</button>
            </>
          ) : (
            <>
              <button type="button" className="com-btn sm dn-rojo" disabled={ocupado || !d.original_existe}
                title={d.original_existe ? undefined : 'El original ya no existe'} onClick={() => setConfirmando('borrar')}>Borrar el contenido</button>
              {d.comunidad_id && (
                <button type="button" className="com-btn sm" disabled={ocupado || !puedeSacar} onClick={() => setConfirmando('sacar')}>Sacar de la comunidad</button>
              )}
            </>
          )}
          {confirmando && (
            <div className="dn-confirma">
              <span>{textos[confirmando][0]}</span>
              {confirmando === 'cerrar' && (
                <input id={`dn-cerrar-${d.id}`} className="dn-input" value={nombre} autoComplete="off" autoFocus
                  placeholder={d.comunidad_nombre} onChange={(e) => setNombre(e.target.value)} />
              )}
              <button type="button" className="com-btn sm" onClick={() => setConfirmando(null)}>Cancelar</button>
              <button type="button" className="com-btn sm dn-rojo"
                disabled={ocupado || (confirmando === 'cerrar' && nombre.trim() !== (d.comunidad_nombre || '').trim())}
                onClick={() => aplicar(confirmando)}>
                {ocupado ? 'Aplicando…' : textos[confirmando][1]}
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p className="com-error" role="alert">{error}</p>}
    </article>
  )
}

export default function SecDenuncias() {
  const [tab, setTab] = useState('pend')
  const pend = useDenunciasQuery(true, true)
  const res = useDenunciasQuery(false, tab === 'res')
  const { resolver, ocupada } = useResolverDenuncia()
  const q = tab === 'pend' ? pend : res
  const lista = q.data || []

  return (
    <div className="dn-sec">
      <p className="dn-intro">Lo que se denunció en las comunidades. Nadie más ve esta sección. Las resueltas se borran solas a los 6 meses.</p>
      <div className="dn-tabs">
        <button type="button" className="dn-tab" aria-pressed={tab === 'pend'} onClick={() => setTab('pend')}>
          Pendientes <b>{pend.data?.length ?? '…'}</b>
        </button>
        <button type="button" className="dn-tab" aria-pressed={tab === 'res'} onClick={() => setTab('res')}>Resueltas</button>
      </div>
      {q.isLoading ? <p className="com-dd-msg">Cargando…</p>
        : q.isError ? <p className="com-dd-msg">No pudimos cargar las denuncias. ¿Corriste la migración 060?</p>
        : lista.length === 0 ? <div className="dn-vacio">{tab === 'pend' ? 'No hay denuncias pendientes. Todo tranquilo.' : 'Todavía no has resuelto ninguna.'}</div>
        : <div className="dn-lista">{lista.map(d => <Tarjeta key={d.id} d={d} resuelta={tab === 'res'} resolver={resolver} ocupada={ocupada} />)}</div>}
    </div>
  )
}

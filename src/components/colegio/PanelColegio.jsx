// Panel del colegio — ruta /colegio (escritorio y móvil).
// Barra lateral con tres secciones (dibujo de Juan, 3 nov 2026):
//   · Colegio → todo el colegio, con filtro por profesor. Solo administración.
//   · Salón   → un aula, elegida por grado y sección.
//   · Lista   → aulas, códigos y quién está dentro (ListaColegio).
// Los datos de lectura de Colegio y Salón salen de la migración 083. Desde
// una fila de Colegio se salta al Salón de esa aula. En móvil la barra
// pasa a pestañas.
// Quién ve qué lo decide la base (081): aquí solo se esconde lo que no toca.
import { useState, useEffect } from 'react'
import { useMisColegiosQuery } from '../../hooks/useColegio.js'
import ListaColegio from './ListaColegio.jsx'
import SalonColegio from './SalonColegio.jsx'
import ResumenColegio from './ResumenColegio.jsx'
import '../../styles/comunidades.css'
import '../../styles/colegio.css'

const SECCIONES = [
  { id: 'colegio', label: 'Colegio', soloAdmin: true },
  { id: 'salon', label: 'Salón' },
  { id: 'lista', label: 'Lista' },
]

export default function PanelColegio({ user, onGoBack }) {
  const { data: colegios = [], isLoading, isError } = useMisColegiosQuery(user?.id)
  const [colegioId, setColegioId] = useState(null)
  const [sec, setSec] = useState('lista')
  const [aulaId, setAulaId] = useState(null) // la del Salón

  const colegio = colegios.find(c => c.colegio_id === colegioId) || colegios[0] || null
  const esAdmin = colegio?.rol === 'admin'

  // Si deja de ser administrador (se quitó a sí mismo), la sección Colegio
  // ya no le toca.
  useEffect(() => {
    if (colegio && !esAdmin && sec === 'colegio') setSec('lista')
  }, [colegio, esAdmin, sec])

  const secciones = SECCIONES.filter(s => esAdmin || !s.soloAdmin)

  return (
    <div className="col-page">
      <div className="col-topbar">
        <button className="col-back" type="button" onClick={onGoBack}>‹ Biblioteca</button>
      </div>

      {isLoading ? (
        <p className="col-msg">Cargando tu colegio…</p>
      ) : isError ? (
        <p className="col-msg">No pudimos cargar tu colegio. Revisa tu conexión.</p>
      ) : !colegio ? (
        <div className="col-msg">
          <b>No perteneces a ningún colegio</b>
          <p>Si tu colegio te pasó un código, escríbelo en Comunidades → Tengo una invitación.</p>
        </div>
      ) : (
        <div className="col-card">
          <nav className="col-nav" aria-label="Secciones del panel">
            <div className="col-ident">
              {colegios.length > 1 ? (
                <select className="col-select" value={colegio.colegio_id} aria-label="Colegio"
                  onChange={e => { setColegioId(e.target.value); setAulaId(null) }}>
                  {colegios.map(c => <option key={c.colegio_id} value={c.colegio_id}>{c.nombre}</option>)}
                </select>
              ) : (
                <h1 className="col-nombre">{colegio.nombre}</h1>
              )}
              <span className="col-rol">{esAdmin ? 'Administración' : 'Profesor'}</span>
            </div>
            <div className="col-secs" role="tablist">
              {secciones.map(s => (
                <button key={s.id} type="button" role="tab" aria-selected={sec === s.id}
                  className={'col-sec' + (sec === s.id ? ' on' : '')} onClick={() => setSec(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          <section className="col-body">
            {sec === 'lista' && (
              <ListaColegio key={colegio.colegio_id} colegioId={colegio.colegio_id} esAdmin={esAdmin} user={user} />
            )}
            {sec === 'salon' && (
              <SalonColegio colegioId={colegio.colegio_id} aulaId={aulaId} onAula={setAulaId} user={user} />
            )}
            {sec === 'colegio' && esAdmin && (
              <ResumenColegio colegioId={colegio.colegio_id} onVerAula={(id) => { setAulaId(id); setSec('salon') }} />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

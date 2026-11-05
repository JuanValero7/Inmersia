// Sección «Colegio» del panel (solo administración), como «Todo el
// colegio» en la maqueta de octubre (resumen_colegio, migraciones 083–084):
//   · Cifras: alumnos que leyeron esta semana, horas, cursos con lectura
//     asignada y libros terminados.
//   · Horas de lectura del colegio por semana, las últimas 10.
//   · Por curso, en su orden y sin ranking; al tocar una fila se abre su Salón.
// El filtro por profesor solo recorta aulas: los números se suman aquí.
import { useState, useMemo } from 'react'
import { useResumenColegioQuery } from '../../hooks/useColegio.js'
import { Kpi, Barras, fechaCorta } from './graficos.jsx'

const nf = new Intl.NumberFormat('es', { maximumFractionDigits: 1 })

export default function ResumenColegio({ colegioId, onVerAula }) {
  const { data: r, isLoading, isError } = useResumenColegioQuery(colegioId)
  const [profesor, setProfesor] = useState('')

  const profesores = useMemo(() => {
    const m = new Map()
    for (const a of r?.aulas || []) for (const p of a.profesores) m.set(p.user_id, p.nombre)
    return [...m].map(([id, nombre]) => ({ id, nombre })).sort((x, y) => x.nombre.localeCompare(y.nombre))
  }, [r])

  if (isLoading) return <p className="com-dd-msg">Cargando el colegio…</p>
  if (isError || !r) return <p className="com-dd-msg">No pudimos cargar el resumen. Revisa tu conexión.</p>
  if (r.aulas.length === 0) return <p className="com-dd-msg">Todavía no hay aulas. Créalas en «Lista».</p>

  const aulas = profesor ? r.aulas.filter(a => a.profesores.some(p => p.user_id === profesor)) : r.aulas
  const suma = (k) => aulas.reduce((t, a) => t + (a[k] || 0), 0)
  const alumnos = suma('alumnos'), activos = suma('activos_semana')
  const conLibro = aulas.filter(a => a.libro_id)
  const librosDistintos = new Set(conLibro.map(a => a.libro_id)).size
  const horas = r.semanas.map((lunes, i) => aulas.reduce((t, a) => t + a.minutos_por_semana[i], 0) / 60)

  return (
    <div className="col-resumen">
      <div className="col-head">
        <h2>Colegio</h2>
        {profesores.length > 1 && (
          <select className="col-select col-aula-sel" value={profesor} aria-label="Profesor" onChange={e => setProfesor(e.target.value)}>
            <option value="">Todos los profesores</option>
            {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        )}
      </div>

      <div className="col-kpis">
        <Kpi n={alumnos ? `${Math.round(100 * activos / alumnos)} %` : '—'} etiqueta="Alumnos que leyeron esta semana" detalle={`${activos} de ${alumnos}`} />
        <Kpi n={`${nf.format(Math.round(suma('minutos_semana') / 60))} h`} etiqueta="Horas leídas esta semana" detalle="Entre todos los cursos" />
        <Kpi n={conLibro.length} de={aulas.length} etiqueta="Cursos con lectura asignada" detalle={`${librosDistintos} ${librosDistintos === 1 ? 'libro distinto' : 'libros distintos'}`} />
        <Kpi n={suma('terminados')} etiqueta="Libros terminados" detalle="Libros de las aulas, desde que se usa Inmersia" />
      </div>

      <section className="col-tarjeta">
        <h3>Horas de lectura del colegio</h3>
        <p className="col-sub">Por semana, últimas 10 semanas. La última termina hoy.</p>
        <Barras alto={240} aria="Horas de lectura del colegio por semana, últimas 10 semanas"
          fmtY={(v) => `${nf.format(v)} h`}
          datos={horas.map((h, i) => ({
            x: fechaCorta(r.semanas[i]).replace('.', ''), v: h, emph: i === horas.length - 1,
            tip: <><b>Semana del {fechaCorta(r.semanas[i], 'long')}</b><br />{nf.format(h)} h entre todos los cursos</>,
          }))} />
      </section>

      <section className="col-tarjeta">
        <h3>Por curso</h3>
        <p className="col-sub">En el orden de los cursos, sin ranking. Datos de la semana actual. Toca uno para ver su salón.</p>
        <div className="col-tabla-scroll">
          <table className="col-tabla">
            <thead>
              <tr>
                <th>Curso</th><th>Docente</th><th>Lectura asignada</th><th>Alumnos al día</th>
                <th className="num">Minutos por alumno</th><th className="num">Leyeron esta semana</th>
              </tr>
            </thead>
            <tbody>
              {aulas.map(a => {
                const pct = a.con_meta ? Math.round(100 * a.al_dia / a.con_meta) : null
                return (
                  <tr key={a.aula_id} className="col-tr-link" tabIndex={0} title="Ver el salón"
                    onClick={() => onVerAula(a.aula_id)} onKeyDown={e => { if (e.key === 'Enter') onVerAula(a.aula_id) }}>
                    <td className="col-nombre">{a.nombre}</td>
                    <td>{a.profesores.map(p => p.nombre).join(', ') || <span className="col-vacio">Sin profesor</span>}</td>
                    <td>{a.libro ? <span className="col-libro-t">{a.libro}</span> : <span className="col-vacio">Sin libro</span>}</td>
                    <td>{pct == null ? <span className="col-vacio">—</span> : (
                      <span className="col-pct"><span className="col-pct-bar"><i style={{ width: `${pct}%` }} /></span>{pct} %</span>
                    )}</td>
                    <td className="num">{a.alumnos ? `${Math.round(a.minutos_semana / a.alumnos)} min` : '—'}</td>
                    <td className="num">{a.activos_semana} de {a.alumnos}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="col-nota-tabla">«Al día» compara el capítulo de cada alumno con el ritmo que pide la fecha meta del aula. Solo cuenta la lectura de los libros de cada aula.</p>
      </section>
    </div>
  )
}

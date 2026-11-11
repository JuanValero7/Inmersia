// src/components/landing/colegios/Captura.jsx
// ─────────────────────────────────────────────────────────────
// Una captura real de la app, con su pie.
//
// En móvil se muestra la misma vista sacada a tamaño celular (archivo con -m),
// recortada a la parte que cuenta la escena. `deLado`: la tabla «alumno por
// alumno» en el celular pierde columnas, así que ahí queda la de escritorio y
// se desliza de lado. `marcas`: los números 1-2-3 del Día 1, con su posición en
// % sobre cada versión de la imagen.
// ─────────────────────────────────────────────────────────────
import { asset } from './colegiosData.js'

export default function Captura({
  mobile, nombre, movil = false, alt, ancho, alto, titulo, nota, panel = true,
  marcas = [], deLado = false, lazy = true, className = '', id,
}) {
  const usaMovil = mobile && movil
  const img = (
    <img
      src={asset(`${nombre}${usaMovil ? '-m' : ''}.webp`)}
      alt={alt}
      {...(usaMovil ? {} : { width: ancho, height: alto })}
      className={mobile && !panel ? 'lc-m-cel' : undefined}
      loading={lazy ? 'lazy' : undefined}
      decoding="async"
    />
  )
  return (
    <figure className={`lc-real ${panel ? 'lc-panel' : ''} ${className}`.trim()} id={id}>
      {mobile && deLado ? (
        <>
          <div className="lc-m-de-lado">{img}</div>
          <span className="lc-m-pista-lado">Deslice para ver todas las columnas →</span>
        </>
      ) : marcas.length ? (
        <div className="lc-marco">
          {img}
          {marcas.map(({ n, escritorio, movil: enMovil }) => {
            const [left, top] = usaMovil ? enMovil : escritorio
            return <span key={n} className="lc-marca" style={{ left: `${left}%`, top: `${top}%` }}>{n}</span>
          })}
        </div>
      ) : img}
      <figcaption>{titulo} {nota && <small>{nota}</small>}</figcaption>
    </figure>
  )
}

// Bandeja lateral (desktop, pantallas anchas): preview de las barajitas
// desbloqueadas que el usuario todavía no pegó en su casillero. Es puramente
// informativa — el pegado ocurre clickeando el espacio vacío en el álbum.
const SEC_META = {
  personajes:  { label: 'Personajes',  color: 'var(--rojo)' },
  lugares:     { label: 'Lugares',     color: 'var(--verde)' },
  capitulos:   { label: 'Capítulos',   color: 'var(--azul)' },
  infografias: { label: 'Infografías', color: 'var(--oro)' },
}

export default function Bandeja({ entry }) {
  const pendientes = Object.entries(entry.secciones).flatMap(([seccion, data]) =>
    (data.items || [])
      .filter((it) => it.unlocked && !it.pegada)
      .map((it) => ({ ...it, seccion }))
  )

  if (!pendientes.length) return null

  return (
    <aside className="album-bandeja">
      <p className="album-bandeja-title">Barajitas para pegar</p>
      <div className="album-bandeja-list">
        {pendientes.map((it, i) => {
          const meta = SEC_META[it.seccion]
          return (
            <div key={`${it.seccion}-${it.key}-${i}`} className="album-bandeja-item">
              <span className="album-bandeja-thumb" style={{ '--c': meta?.color }}>
                {it.url
                  ? <img src={it.url} alt="" loading="lazy" />
                  : <span className="ph">{(it.name || '?').charAt(0)}</span>}
              </span>
              <span className="album-bandeja-meta">
                <span className="sec" style={{ color: meta?.color }}>{meta?.label}</span>
                {it.name && <span className="name">{it.name}</span>}
              </span>
            </div>
          )
        })}
      </div>
      <p className="album-bandeja-hint">Tocá el espacio vacío que le corresponde en el álbum para pegarla.</p>
    </aside>
  )
}

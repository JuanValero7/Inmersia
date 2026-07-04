// Pager del álbum: una tapa por libro de la biblioteca. Estilo clay.
export default function BookTabs({ items, current, onSelect }) {
  return (
    <div className="album-pager">
      {items.map((entry, i) => {
        const { libro } = entry
        return (
          <button
            key={libro.libro_id}
            onClick={() => onSelect(i)}
            title={libro.title}
            className={`album-tab${i === current ? ' active' : ''}`}
            style={{ background: libro._baseColor || '#cf7b4c' }}
          >
            {libro.cover
              ? <img src={libro.cover} alt={libro.title} />
              : <div className="album-tab-placeholder"><span>{libro.title}</span></div>}
          </button>
        )
      })}
    </div>
  )
}

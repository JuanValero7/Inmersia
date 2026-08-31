// src/probe.jsx — BANCO DE PRUEBAS DE LAYOUT (temporal, no se publica)
// ─────────────────────────────────────────────────────────────
// Monta la fila superior REAL de Biblioteca (mismo padding, mismo
// flex 3/2, mismos componentes) con datos falsos, para poder medir
// desbordes con Playwright sin pasar por el login.
//
// Se sirve solo en dev: http://localhost:5173/probe.html
// No entra en el build (vite solo empaqueta index.html).
// ─────────────────────────────────────────────────────────────
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/biblioteca.css'
import { Swimlane } from './components/biblioteca/clay/HeaderSwimlane.jsx'
import { LateralHome } from './components/biblioteca/clay/LateralHome.jsx'

const T = 'El jardín de los senderos que se bifurcan y otras ficciones'
const D = 'Una novela sobre el tiempo, los laberintos y las decisiones que no tomamos. '.repeat(3)

const libro = (i) => ({
  id: 'l' + i, slug: 'l' + i, titulo: `${T.slice(0, 18 + i * 4)}`, autor: 'Jorge Luis Borges',
  paginas: 200 + i, descripcion: D, color: ['#a56a52', '#6f9457', '#cf9b3f', '#7a5e38'][i % 4],
  portada_url: null, metadata: {},
})
const book = (i) => ({
  id: 'b' + i, libro_id: 'b' + i, title: T.slice(0, 20 + i * 5), author: 'Jorge Luis Borges',
  pages: 300, _baseColor: '#a56a52', cover: null, heroUrl: null,
  progress: 0.42, categoryName: 'Ficción latinoamericana',
})

const noop = () => {}

function Probe() {
  return (
    <div className="bib-body" style={{ fontFamily: "'Baloo 2', cursive", minHeight: '100%', backgroundColor: '#FBF5EC' }}>
      {/* Mismo padding que Biblioteca.jsx */}
      <div style={{ padding: '26px 32px 56px' }}>
        <div id="fila-superior" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div id="col-swimlane" style={{ flex: 3, minWidth: 0 }}>
            <Swimlane
              featured={book(0)}
              onOpen={noop}
              novedades={[libro(1), libro(2), libro(3), libro(4)]}
              recomendaciones={[libro(5), libro(6), libro(7), libro(8)]}
              onOpenLibro={noop}
              onPreviewLibro={noop}
            />
          </div>
          <div id="col-lateral" style={{ flex: 2, minWidth: 0 }}>
            <LateralHome books={[book(1), book(2)]} onOpen={noop} onGoTienda={noop} onGoAlbum={noop} />
          </div>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Probe />)

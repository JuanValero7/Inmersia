import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[Inmersia] Error no controlado:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 20,
          background: '#faf6f0', padding: 32, textAlign: 'center',
        }}>
          <img src="/assets/inmersia-logo.png" alt="Inmersia" style={{ width: 72, opacity: 0.7 }} />
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: '#5a3a1a', margin: 0 }}>
            Algo salió mal
          </h1>
          <p style={{ fontFamily: "'Crimson Text', serif", color: '#8a6a4a', fontSize: '1.05rem', maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
            Un error inesperado interrumpió la biblioteca.<br />Recargar la página suele resolverlo.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '10px 28px', background: '#8b4d2a',
              color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Playfair Display', serif", fontSize: '0.95rem', letterSpacing: '0.04em',
            }}
          >
            Recargar la biblioteca
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

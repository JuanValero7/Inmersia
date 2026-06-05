import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase.js'
import Auth from './components/Auth.jsx'
import ResetPassword from './components/ResetPassword.jsx'

const VistaBiblioteca = lazy(() => import('./components/Biblioteca.jsx'))
const VistaLectura    = lazy(() => import('./components/Lector.jsx'))
const VistaTienda     = lazy(() => import('./components/Tienda.jsx'))
const CartelaView     = lazy(() => import('./components/Cartelera.jsx'))
const VistaPerfil     = lazy(() => import('./components/Perfil.jsx'))
const VistaForo       = lazy(() => import('./components/Foro.jsx'))

const Fallback = (
  <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'var(--bg-warm)'}}>
    <div className="spinner" style={{width:32,height:32,borderWidth:3,borderColor:'rgba(139,77,42,0.2)',borderTopColor:'#8b4d2a'}}/>
    <p style={{fontFamily:"'Playfair Display',serif",color:'#9a6a4a',fontSize:'1rem'}}>Abriendo la biblioteca…</p>
  </div>
)

export default function App() {
  const [view,             setView]             = useState('auth')
  const [user,             setUser]             = useState(undefined)
  const [authReady,        setAuthReady]        = useState(false)
  const [currentBook,      setCurrentBook]      = useState(null)
  const [lastOpenedBookId, setLastOpenedBookId] = useState(null)
  const [foroSource,       setForoSource]       = useState('biblioteca')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setAuthReady(true)
      if (u) {
        setView('biblioteca')
        const saved = localStorage.getItem(`inm_last_book_${u.id}`)
        if (saved) setLastOpenedBookId(saved)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') { setView('reset-password'); return }
      if (!session) { setView('auth'); setLastOpenedBookId(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => { await supabase.auth.signOut(); setUser(null); setView('auth') }

  const handleOpenBook = (book) => {
    if (user) localStorage.setItem(`inm_last_book_${user.id}`, book.id)
    setLastOpenedBookId(book.id)
    setCurrentBook(book)
    setView('lectura')
  }

  if (!authReady) return Fallback
  if (view === 'reset-password') return <ResetPassword onDone={() => setView('biblioteca')} />
  if (!user) return <Auth onAuthSuccess={(u) => { setUser(u); setView('biblioteca') }}/>

  return (
    <Suspense fallback={Fallback}>
      {view === 'biblioteca' && (
        <VistaBiblioteca
          user={user}
          lastOpenedBookId={lastOpenedBookId}
          onSignOut={handleSignOut}
          onOpenBook={handleOpenBook}
          onGoTienda={() => setView('tienda')}
          onGoPerfil={() => setView('perfil')}
          onGoForo={(book) => { setCurrentBook(book); setForoSource('biblioteca'); setView('foro') }}
        />
      )}
      {view === 'perfil' && (
        <VistaPerfil
          user={user}
          onGoBack={() => setView('biblioteca')}
          onSignOut={handleSignOut}
        />
      )}
      {view === 'tienda' && (
        <VistaTienda onGoBack={() => setView('biblioteca')} user={user}/>
      )}
      {view === 'cartelera' && (
        <CartelaView
          onGoBack={() => setView('lectura')}
          book={currentBook}
          user={user}
          onGoForo={() => { setForoSource('cartelera'); setView('foro') }}
        />
      )}
      {view === 'foro' && (
        <VistaForo
          book={currentBook}
          user={user}
          onGoBack={() => setView(foroSource)}
        />
      )}
      {view === 'lectura' && (
        <VistaLectura
          book={currentBook}
          onGoBack={() => setView('biblioteca')}
          onGoCartelera={() => setView('cartelera')}
          onGoForo={() => { setForoSource('lectura'); setView('foro') }}
        />
      )}
    </Suspense>
  )
}

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './lib/supabase.js'
import { ensureProfile } from './lib/ensureProfile.js'
import { MANUAL_LIBRO_ID } from './lib/constants.js'
import { queryKeys } from './lib/queries.js'
import { LIMITE_PENDIENTES } from './hooks/useCompraLibro.js'
import { tomarMuestra } from './lib/progresoInvitado.js'
import useIsMobile from './hooks/useIsMobile.js'
import { useSuperuser } from './hooks/useSuperuser.js'
import { useGatoColor } from './hooks/useGatoColor.js'
import AuthModal from './components/AuthModal.jsx'
import { AuthModalProvider } from './context/authModal.jsx'
import { useOnboardingController, OnboardingProvider } from './context/onboarding.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import { LectorRoute } from './components/LectorRoute.jsx'
import AvisoRed from './components/AvisoRed.jsx'

const VistaBiblioteca       = lazy(() => import('./components/Biblioteca.jsx'))
const VistaLectura          = lazy(() => import('./components/Lector.jsx'))
const VistaTienda           = lazy(() => import('./components/Tienda.jsx'))
const VistaTiendaMobile     = lazy(() => import('./components/mobile/TiendaMobile.jsx'))
const CartelaView           = lazy(() => import('./components/Cartelera.jsx'))
const VistaPerfil           = lazy(() => import('./components/Perfil.jsx'))
const VistaForo             = lazy(() => import('./components/Foro.jsx'))
const VistaForoMobile       = lazy(() => import('./components/mobile/ForoMobile.jsx'))
const VistaPerfilMobile     = lazy(() => import('./components/mobile/PerfilMobile.jsx'))
const VistaBibliotecaMobile = lazy(() => import('./components/mobile/BibliotecaMobile.jsx'))
const CarteleraMobile       = lazy(() => import('./components/mobile/CarteleraMobile.jsx'))
const VistaLecturaMobile    = lazy(() => import('./components/mobile/LectorMobile.jsx'))
const Landing               = lazy(() => import('./components/Landing.jsx'))
const LandingMobile         = lazy(() => import('./components/mobile/LandingMobile.jsx'))
const VistaAlbum            = lazy(() => import('./components/Album.jsx'))
const AlbumMobile           = lazy(() => import('./components/mobile/AlbumMobile.jsx'))

const Fallback = (
  <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'var(--bg-warm)'}}>
    <div className="spinner" style={{width:32,height:32,borderWidth:3,borderColor:'rgba(139,77,42,0.2)',borderTopColor:'#8b4d2a'}}/>
    <p style={{fontFamily:"'Playfair Display',serif",color:'#9a6a4a',fontSize:'1rem'}}>Abriendo la biblioteca…</p>
  </div>
)

// Redirige a /auth si no hay sesión activa
function ProtectedRoute({ user }) {
  if (!user) return <Navigate to="/auth" replace />
  return <Outlet />
}

// La autenticación ahora es un pop-up (ver <AuthModal>), no una página.
// La ruta /auth se conserva solo para enlaces antiguos/marcadores: redirige
// a la raíz y abre el pop-up con la pestaña indicada en el state.
function AuthRedirect({ openAuth }) {
  const location = useLocation()
  useEffect(() => { openAuth(location.state?.tab ?? 'login') }, [openAuth, location.state])
  return <Navigate to="/" replace />
}

// Rescata la lectura de muestra de un invitado que acaba de registrarse: traduce
// los capítulos que alcanzó a leer (anotados en lib/progresoInvitado.js) a
// porcentaje, y ancla el progreso en el primer párrafo del capítulo donde iba
// para que el lector lo devuelva ahí — useLectorData restaura la posición por
// `ultimo_parrafo_id`, no por el porcentaje.
//
// Se llama justo después de dar de alta el libro en la biblioteca, así que la
// fila de progreso todavía no existe: por eso upsert y no update. Los índices de
// capítulo del modo muestra sirven tal cual, porque la lista recortada son los
// primeros capítulos del libro en el mismo orden.
async function rescatarMuestra(userId, libroId) {
  const caps = tomarMuestra(libroId)
  if (!caps) return

  const { data: capitulos } = await supabase.from('capitulos')
    .select('id').eq('libro_id', libroId).order('numero')
  const total = capitulos?.length ?? 0
  if (!total) return

  const { data: parrafo } = await supabase.from('parrafos')
    .select('id').eq('capitulo_id', capitulos[Math.min(caps, total - 1)].id)
    .order('numero').limit(1).maybeSingle()

  const { error } = await supabase.from('progreso_lectura').upsert({
    user_id: userId, libro_id: libroId,
    porcentaje: Math.min(100, Math.round((caps / total) * 100)),
    ultimo_parrafo_id: parrafo?.id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,libro_id' })
  if (error) console.error('No se pudo rescatar la lectura de muestra:', error.message)
}

export default function App() {
  const [user,                setUser]                = useState(undefined)
  const [authReady,           setAuthReady]           = useState(false)
  const [currentBook,         setCurrentBook]         = useState(null)
  const [lastOpenedBookIds,   setLastOpenedBookIds]   = useState([])
  const lastOpenedBookIdsRef = useRef(lastOpenedBookIds)
  lastOpenedBookIdsRef.current = lastOpenedBookIds
  const [foroSource,          setForoSource]          = useState('biblioteca')
  const [carteleraSource,     setCarteleraSource]     = useState('lectura')
  const [lectorStartNotebook, setLectorStartNotebook] = useState(false)
  const [cartelaJumpId,       setCartelaJumpId]       = useState(null)
  const [authTab,             setAuthTab]             = useState(null) // null | 'login' | 'registro'
  const [limiteAviso,         setLimiteAviso]         = useState(false) // aviso "límite de pendientes alcanzado"

  // Abre el pop-up de autenticación en la pestaña indicada.
  const openAuth = useCallback((tab = 'login') => {
    setAuthTab(tab === 'registro' ? 'registro' : 'login')
  }, [])

  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const onboarding  = useOnboardingController(user, navigate)
  const location    = useLocation()
  const isMobile    = useIsMobile()
  const isSuperuser = useSuperuser(user ?? null)
  const { gatoColor, updateGatoColor } = useGatoColor(user)

  // Bloquear el tipo de lector mientras el usuario está leyendo: si isMobile
  // cambia en mitad de la sesión (p. ej. al rotar un teléfono grande que cruza
  // el breakpoint de 820 px), no queremos que React desmonte el lector y lo
  // remonte desde cero, perdiendo la posición de lectura.
  const inLector = location.pathname.startsWith('/libro/')
  const lectorMobileRef = useRef(isMobile)
  if (!inLector) lectorMobileRef.current = isMobile
  const lectorEsMobile = inLector ? lectorMobileRef.current : isMobile

  const Foro        = isMobile ? VistaForoMobile       : VistaForo
  const Perfil      = isMobile ? VistaPerfilMobile     : VistaPerfil
  const Biblioteca  = isMobile ? VistaBibliotecaMobile : VistaBiblioteca
  const Cartelera   = isMobile ? CarteleraMobile       : CartelaView
  const Lectura     = lectorEsMobile ? VistaLecturaMobile : VistaLectura
  const LandingView = isMobile ? LandingMobile         : Landing
  const Tienda      = isMobile ? VistaTiendaMobile     : VistaTienda
  const Album       = isMobile ? AlbumMobile           : VistaAlbum

  const loadLastBooks = useCallback(async (u) => {
    if (!u) return
    const { data } = await supabase
      .from('preferencias_usuario')
      .select('ultimos_libros')
      .eq('user_id', u.id)
      .maybeSingle()
    if (data?.ultimos_libros?.length) {
      setLastOpenedBookIds(data.ultimos_libros)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      setAuthReady(true)
      if (u) loadLastBooks(u)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // ensureProfile va en un setTimeout(0) a propósito: este callback corre
      // DENTRO del lock exclusivo de auth de supabase-js, y cualquier llamada al
      // cliente desde acá vuelve a pedir ese mismo lock → deadlock (la app se
      // queda colgada en "Abriendo la biblioteca…"). Es el patrón que recomienda
      // la propia librería (ver el doc de onAuthStateChange en @supabase/auth-js).
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => ensureProfile(session.user), 0)
      }
      if (event === 'PASSWORD_RECOVERY') { navigate('/reset-password'); return }
      if (event === 'SIGNED_OUT') {
        setLastOpenedBookIds([])
        navigate('/')
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [loadLastBooks, navigate])

  // Precargar el chunk del Lector en un momento ocioso: al abrir un libro el
  // JS ya está en caché y desaparece el spinner de descarga. Aplica también a
  // invitados (pueden leer 2 capítulos desde la landing/tienda).
  useEffect(() => {
    if (!authReady || inLector) return
    const prefetch = () => {
      if (lectorEsMobile) import('./components/mobile/LectorMobile.jsx')
      else import('./components/Lector.jsx')
    }
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(prefetch, 1500)
    return () => clearTimeout(t)
  }, [authReady, lectorEsMobile, inLector])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setLastOpenedBookIds([])
    navigate('/')
  }

  function pushBookId(bookId, currentUser) {
    if (bookId === MANUAL_LIBRO_ID) return // el Manual no entra en "seguir leyendo"
    const next = [bookId, ...lastOpenedBookIdsRef.current.filter(id => id !== bookId)].slice(0, 3)
    lastOpenedBookIdsRef.current = next
    setLastOpenedBookIds(next)
    if (currentUser) {
      supabase
        .from('preferencias_usuario')
        .upsert({ user_id: currentUser.id, ultimos_libros: next, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error('No se pudieron guardar los últimos libros:', error) })
    }
  }

  const handleOpenBook = useCallback((book) => {
    pushBookId(book.id, user)
    setCurrentBook(book)
    navigate(`/libro/${book.slug || book.id}`)
  }, [user, navigate])

  const handleGoNotebook = useCallback((book) => {
    pushBookId(book.id, user)
    setCurrentBook(book)
    setLectorStartNotebook(true)
    navigate(`/libro/${book.slug || book.id}`)
  }, [user, navigate])

  // Tras autenticarse desde el paywall de invitado (estando en /libro/:slug),
  // agrega ese libro a la biblioteca del usuario respetando el límite de
  // lecturas pendientes. Cuenta nueva o usuario bajo el límite → se adquiere y
  // sigue leyendo. Usuario existente que ya llegó al límite → no se adquiere y
  // se lo expulsa a su Biblioteca con un aviso (misma regla que la Tienda).
  // Al adquirirlo se rescata además lo que leyó como invitado (rescatarMuestra).
  const acquireBookAfterAuth = useCallback(async (u) => {
    if (!u?.id || !location.pathname.startsWith('/libro/')) return
    const slug = location.pathname.split('/')[2]
    if (!slug) return

    // Resolver el libro: usar currentBook si coincide con la URL; si no, buscarlo.
    let libroId = (currentBook?.slug === slug || currentBook?.id === slug) ? currentBook?.libro_id : null
    if (!libroId) {
      const { data } = await supabase.from('libros').select('id').eq('slug', slug).maybeSingle()
      libroId = data?.id
    }
    if (!libroId) return

    // Estado de su biblioteca + condición de superusuario, en paralelo.
    const [{ data: filas }, { count: superCount }] = await Promise.all([
      supabase.from('bibliotecas_usuarios').select('libro_id, leido').eq('user_id', u.id),
      supabase.from('superusuarios').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
    ])
    if ((filas || []).some(f => f.libro_id === libroId)) return // ya lo tenía: sigue leyendo

    const esSuper    = (superCount ?? 0) > 0
    const pendientes = (filas || []).filter(f => f.libro_id !== MANUAL_LIBRO_ID && !f.leido).length

    if (!esSuper && pendientes >= LIMITE_PENDIENTES) {
      setLimiteAviso(true)
      navigate('/biblioteca', { replace: true })
      return
    }

    const { error } = await supabase
      .from('bibliotecas_usuarios')
      .insert({ user_id: u.id, libro_id: libroId, leido: false })
    if (error) { console.error('No se pudo agregar el libro tras autenticarse:', error.message); return }
    await rescatarMuestra(u.id, libroId)
    queryClient.invalidateQueries({ queryKey: queryKeys.bibliotecaUsuario(u.id) })
    // Permanece en el lector; el efecto de guestMode oculta el paywall al dejar de ser invitado.
  }, [location.pathname, currentBook, navigate, queryClient])

  // El aviso de "límite alcanzado" se autodescarta a los 7 s.
  useEffect(() => {
    if (!limiteAviso) return
    const t = setTimeout(() => setLimiteAviso(false), 7000)
    return () => clearTimeout(t)
  }, [limiteAviso])

  if (!authReady) return Fallback

  return (
    <AuthModalProvider openAuth={openAuth}>
      <OnboardingProvider value={onboarding}>
      <Suspense fallback={Fallback}>
        <Routes>

          {/* Raíz: landing pública o redirección a biblioteca */}
          <Route path="/" element={
            user
              ? <Navigate to="/biblioteca" replace />
              : <LandingView
                  onAuth={openAuth}
                  onGoTienda={() => navigate('/tienda')}
                />
          } />

          {/* Auth: la ruta se conserva solo para enlaces antiguos → abre el pop-up */}
          <Route path="/auth" element={
            user
              ? <Navigate to="/biblioteca" replace />
              : <AuthRedirect openAuth={openAuth} />
          } />

          {/* Reset de contraseña (Supabase redirige aquí) */}
          <Route path="/reset-password" element={
            <ResetPassword onDone={() => navigate('/biblioteca', { replace: true })} />
          } />

          {/* Tienda — pública para explorar; comprar y leer requiere auth */}
          <Route path="/tienda" element={
            <Tienda
              onGoBack={() => navigate(user ? '/biblioteca' : '/')}
              user={user}
              gatoColor={gatoColor}
              onOpenBook={handleOpenBook}
              isSuperuser={isSuperuser}
            />
          } />

          {/* Lector — público para invitados (máx. 2 caps por RLS) y completo para usuarios */}
          <Route path="/libro/:slug" element={
            <LectorRoute
              LectorCmp={Lectura}
              user={user}
              currentBook={currentBook}
              isSuperuser={isSuperuser}
              gatoColor={gatoColor}
              openAuth={openAuth}
              lectorStartNotebook={lectorStartNotebook}
              setLectorStartNotebook={setLectorStartNotebook}
              setCartelaJumpId={setCartelaJumpId}
              setForoSource={setForoSource}
              setCarteleraSource={setCarteleraSource}
            />
          } />

          {/* Rutas protegidas (requieren sesión) */}
          <Route element={<ProtectedRoute user={user} />}>

            <Route path="/biblioteca" element={
              <Biblioteca
                user={user}
                gatoColor={gatoColor}
                lastOpenedBookIds={lastOpenedBookIds}
                isSuperuser={isSuperuser}
                onSignOut={handleSignOut}
                onOpenBook={handleOpenBook}
                onGoTienda={() => navigate('/tienda')}
                onGoPerfil={() => navigate('/perfil')}
                onGoAlbum={() => navigate('/album')}
                onGoForo={(book) => {
                  setCurrentBook(book)
                  setForoSource('biblioteca')
                  navigate(`/foro/${book.slug || book.id}`)
                }}
                onGoNotebook={handleGoNotebook}
              />
            } />

            <Route path="/album" element={
              <Album
                user={user}
                gatoColor={gatoColor}
                onOpenBook={handleOpenBook}
                onGoBack={() => navigate('/biblioteca')}
                onGoForo={(book) => {
                  setCurrentBook(book)
                  setForoSource('album')
                  navigate(`/foro/${book.slug || book.id}`)
                }}
                onGoInvestigacion={(book) => {
                  setCurrentBook(book)
                  setCarteleraSource('album')
                  navigate(`/investigacion/${book.slug || book.id}`)
                }}
              />
            } />

            <Route path="/perfil" element={
              <Perfil
                user={user}
                gatoColor={gatoColor}
                onChangeGatoColor={updateGatoColor}
                onGoBack={() => navigate('/biblioteca')}
                onSignOut={handleSignOut}
              />
            } />

            {/* Investigación y Foro cargan el libro por slug; currentBook es caché opcional. */}
            <Route path="/investigacion/:slug" element={
              <Cartelera
                onGoBack={() => {
                  if (!currentBook) { navigate('/biblioteca'); return }
                  const dest = carteleraSource === 'foro'
                    ? `/foro/${currentBook.slug || currentBook.id}`
                    : carteleraSource === 'album'
                      ? '/album'
                      : `/libro/${currentBook.slug || currentBook.id}`
                  navigate(dest)
                }}
                onGoLectura={() => {
                  if (!currentBook) { navigate('/biblioteca'); return }
                  navigate(`/libro/${currentBook.slug || currentBook.id}`)
                }}
                book={currentBook}
                user={user}
                gatoColor={gatoColor}
                onGoForo={() => {
                  setForoSource('cartelera')
                  const slug = currentBook?.slug || location.pathname.split('/').at(-1)
                  navigate(`/foro/${slug}`)
                }}
                onGoBiblioteca={() => navigate('/biblioteca')}
                jumpToItemId={cartelaJumpId}
                onJumpConsumed={() => setCartelaJumpId(null)}
                isSuperuser={isSuperuser}
              />
            } />

            <Route path="/foro/:slug" element={
              <Foro
                book={currentBook}
                user={user}
                isSuperuser={isSuperuser}
                onGoBack={() => {
                  const slug = currentBook?.slug || location.pathname.split('/').at(-1)
                  const dest = foroSource === 'cartelera'
                    ? `/investigacion/${slug}`
                    : foroSource === 'lectura'
                      ? `/libro/${slug}`
                      : foroSource === 'album'
                        ? '/album'
                        : '/biblioteca'
                  navigate(dest)
                }}
                onGoLectura={() => {
                  const slug = currentBook?.slug || location.pathname.split('/').at(-1)
                  navigate(`/libro/${slug}`)
                }}
                onGoBiblioteca={() => navigate('/biblioteca')}
                onGoCartelera={() => {
                  setCarteleraSource('foro')
                  const slug = currentBook?.slug || location.pathname.split('/').at(-1)
                  navigate(`/investigacion/${slug}`)
                }}
              />
            } />

          </Route>

          {/* Cualquier ruta desconocida → raíz */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Suspense>

      {/* Pop-up de autenticación: se abre sobre la página actual. Al iniciar
          sesión con éxito solo se cierra — la landing redirige sola a
          /biblioteca y en tienda/lector el usuario permanece donde estaba. */}
      {authTab && !user && (
        <AuthModal
          initialTab={authTab}
          onClose={() => setAuthTab(null)}
          onAuthSuccess={(u) => {
            setUser(u); loadLastBooks(u); setAuthTab(null)
            // También en cuenta nueva. Antes se saltaba, porque el tutorial se
            // lleva al usuario a la Biblioteca de todos modos; el efecto era que
            // el libro de muestra se perdía —sin él en la biblioteca el lector
            // seguía en modo muestra: sin subrayado, sin cuaderno y sin progreso.
            // Ahora queda adquirido, con los capítulos que alcanzó a leer.
            acquireBookAfterAuth(u)
          }}
        />
      )}

      {/* Aviso global de red: cubre Biblioteca, Tienda, Álbum y Perfil de una vez
          (todas comen de las queries compartidas de src/lib/queries.js). */}
      <AvisoRed />

      {/* Aviso: llegó al límite de lecturas pendientes al intentar sumar un libro. */}
      {limiteAviso && (
        <div style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 4000, maxWidth: 460, width: 'calc(100% - 32px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fffdf8', border: '2px solid #4a3622', borderRadius: 14, padding: '14px 16px', boxShadow: '2px 4px 0 rgba(74,54,34,0.22), 0 14px 30px rgba(0,0,0,0.22)', fontFamily: "'Baloo 2', sans-serif" }}>
            <span style={{ fontSize: 20, lineHeight: 1.2 }}>📚</span>
            <p style={{ margin: 0, flex: 1, fontSize: 14, color: '#4a3622', lineHeight: 1.45 }}>
              Alcanzaste tu límite de {LIMITE_PENDIENTES} lecturas pendientes. Termina alguna para sumar este libro a tu biblioteca.
            </p>
            <button type="button" onClick={() => setLimiteAviso(false)} aria-label="Cerrar"
              style={{ background: 'transparent', border: 'none', color: '#9a6a4a', cursor: 'pointer', fontSize: 20, fontWeight: 700, lineHeight: 1, padding: 0 }}>×</button>
          </div>
        </div>
      )}
      </OnboardingProvider>
    </AuthModalProvider>
  )
}

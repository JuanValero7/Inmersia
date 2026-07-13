# Checklist de lanzamiento a producción — 13 jul 2026

Estado verificado en esta revisión: ✅ `vite build` OK (138 KB gzip main) · ✅ scan-secrets limpio · ✅ `.env.local` ignorado · ✅ rewrite SPA en vercel.json · ✅ legales integrados (LegalModal en Auth + Perfil) · ❌ ESLint 9 errores · ❌ `npm test` exit 1 · ❌ sin favicon/meta/robots/sitemap · ⚠️ ~20 archivos sin commitear.

---

## 🚫 Bloqueantes (no deployar sin esto)

1. **Commitear el trabajo pendiente.** Hay ~20 archivos modificados + 2 nuevos sin commitear (`src/lib/queries.js`, migración `030_indexes_prelaunch.sql`). Lo que no está commiteado no se deploya y no tiene respaldo.

2. **Arreglar los 9 errores de ESLint** (rompen `npm run security-check`, y si el deploy corre lint, rompen el deploy). Son triviales:
   - `Ficha.jsx:23` prop `onBackPortada` sin uso · `:110` comillas sin escapar (×2)
   - `Portada.jsx:4` `useEffect` importado sin uso
   - `CarteleraMobileFicha.jsx:13` `clsx` sin uso · `:56` comillas sin escapar (×2)
   - `useSesionLectura.js:37` bloque `catch {}` vacío (poné un comentario dentro)
   - `useWhiteNoise.js:97` `AudioContext` no definido para ESLint (usar `window.AudioContext` o declarar el global en eslint.config.js)

3. **`npm test` falla con exit 1** — al borrar el test del paginador viejo el suite quedó vacío y vitest sale con error ("No test files found"). Cualquier CI que corra `npm test` bloquea el deploy. Opciones: (a) escribir 2-3 tests del paginador DOM vivo (lo correcto), o (b) `vitest run --passWithNoTests` como parche.

4. **`index.html` no está listo para tener visitas:**
   - Título genérico "Biblioteca · Lectura · Cartelera" → `Inmersia — Lee, investiga y colecciona` (o similar)
   - Sin `<meta name="description">`
   - Sin **favicon** de ningún tipo (pestaña con ícono default)
   - Sin Open Graph / Twitter cards (compartir el link en WhatsApp/X muestra nada)
   - Recomendado: `theme-color`, `apple-touch-icon`

5. **Variables de entorno en Vercel** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — el `.env.local` no viaja al deploy. Sin esto la app arranca con `createClient(undefined, undefined)` y muere en blanco.

6. **Supabase → Authentication → URL Configuration:** poner el dominio nuevo como Site URL y en la allowlist de Redirect URLs. `resetPasswordForEmail` usa `window.location.origin`: con el dominio nuevo sin allowlist, **el flujo de recuperar contraseña se rompe** silenciosamente.

7. **`npm audit fix`** (sin `--force`): hay un high en `@babel/core` con fix no-breaking. El de esbuild/vite es solo del dev server, no afecta producción — no forzar el upgrade a vite 8 ahora.

## ⚠️ Antes del primer usuario real (misma semana del lanzamiento)

8. **SMTP propio para los emails de Supabase.** El mailer built-in tiene un límite durísimo (2-4 emails/hora) y es exactamente lo que revienta el día que se registran 5 personas: confirmaciones que no llegan. Configurar Resend/Postmark/SES en Auth → SMTP y de paso traducir las plantillas al español.

9. **Smoke test end-to-end en el dominio final** (no en localhost): registro con un email real → confirmar → verificar que `ensureProfile` creó perfil + Manual → comprar un libro → leer 2 páginas → recargar (¿persiste posición y "últimos abiertos"?) → recuperar contraseña → flujo invitado → paywall → registro. Es la única forma de validar de verdad el arreglo de F1.

10. **`robots.txt` + `sitemap.xml` en `public/`** (lo vas a necesitar para Search Console). El sitemap con las únicas URLs públicas: `/` y `/tienda`. Verificar el dominio en Search Console por DNS y enviar el sitemap.

11. **Perfil: quitar los datos falsos antes de que los vea un usuario pagante** (F2/F3 de la revisión anterior): ocultar "Transacciones" hasta que exista cobro real (o dejarla con estado vacío honesto), cablear "Historial" a datos reales (ya lo tenés todo en `bibliotecas_usuarios.leido`), y ocultar el botón de cámara del avatar mientras no persista.

12. **Backups de la base:** el plan free de Supabase no tiene point-in-time recovery. Mínimo: `pg_dump` programado (o GitHub Action semanal); ideal: plan Pro antes de tener datos de usuarios que duelan perder.

13. **Supabase Advisors (dashboard → Advisors):** correr el linter de seguridad/performance que trae Supabase; detecta policies RLS faltantes y los índices que la migración 030 no cubra.

14. **Activar en Supabase Auth:** protección de contraseñas filtradas (HaveIBeenPwned) y revisar rate limits de signup/login.

## 💡 Sobre tu plan (Sentry, PostHog, Search Console)

15. **PostHog + RGPD (te aplica por Estonia):** usar el cloud EU (`eu.i.posthog.com`) y **no cargarlo hasta tener consentimiento**. Dos caminos: banner de cookies (una tarde de trabajo) o arrancar en modo `cookieless`/`memory` persistence, que no requiere banner y te da métricas agregadas desde el día 1. Recomiendo cookieless al inicio: menos fricción, legal, y ya medís. Eventos mínimos que valen oro: `signup_completado`, `libro_abierto`, `capitulo_terminado`, `libro_comprado`, `paywall_visto`.

16. **Sentry:** conectarlo al `ErrorBoundary` que ya tenés (llamar `Sentry.captureException(error)` en `componentDidCatch` en vez de solo `console.error`), subir sourcemaps con el plugin de Vite, marcar `environment: 'production'` y `release`, y configurar `beforeSend` para no mandar PII (emails). Bonus: con el wrapper de errores de Supabase que quedó pendiente, cada error de query iría solo a Sentry.

17. **Search Console:** con una SPA client-rendered Google indexa bien la landing (es contenido estático renderizado por JS), pero revisá con "Inspección de URL" que la landing renderice sin login. Las rutas privadas van a aparecer como redirecciones — es normal.

18. **Uptime monitor** gratis (UptimeRobot/BetterStack) apuntando al dominio — te enteras antes que los usuarios.

## 📋 Puede esperar (primer mes)

- Headers de seguridad en `vercel.json` (CSP básica, `X-Content-Type-Options`, `Referrer-Policy`).
- `Cache-Control` largo para `public/assets/` (no están hasheados; si reemplazás una imagen, renombrala — regla que ya seguís).
- Los 🟡 pendientes de la revisión del 12-jul (A8, D6-D10, E3-E4, G2-G4 + perf).
- Título de pestaña dinámico por vista (`document.title` con el libro abierto).
- Página 404 propia (hoy redirige a `/`, aceptable).

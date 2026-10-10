# Punto de partida — sesión de correo

Para arrancar, basta con decir:

> Lee `Documentation/correo/punto-de-partida.md` y arrancamos con el correo.

Estado al **10 oct 2026**. Son dos temas distintos que conviene no mezclar:

| | Correo a potenciales clientes | Correos de la app |
|---|---|---|
| Qué es | Escribir uno a uno a escuelas, clubes de lectura, socios… | Confirmar cuenta, recuperar contraseña, avisos |
| Herramienta prevista | Zoho Mail (`juanvalero@inmersia.io`) | Resend, probablemente (como SMTP de Supabase Auth) |
| Lo primero | **Definir a quién se escribe y para qué** | Ver cómo salen hoy y qué límites tienen |

---

## 1. Correo a potenciales clientes

- **Primero, la lista:** quién (escuelas como cliente principal, ver la maqueta del panel
  docente; clubes de lectura; otros), con qué propuesta y qué se les pide (una prueba, una
  llamada…). Sin eso no se escribe nada.
- **Ojo legal (Alemania):** el correo comercial no solicitado está restringido por la
  **UWG §7**. Hacia empresas e instituciones cabe el «consentimiento presunto» si hay un
  interés concreto y verificable, pero conviene confirmarlo antes de una campaña. Mientras
  tanto: mensajes personales, uno a uno, a direcciones públicas de contacto, con una forma
  clara de decir «no». Nada de envíos masivos ni listas compradas.
- Firma con los datos de contacto que pide la ley (enlazar el Impressum de inmersia.io).
- Herramienta: Zoho para el trato uno a uno. Resend **no** es para esto.

## 2. Correos de la app

- **Hoy:** los correos de Supabase Auth salen, salvo que se haya cambiado, por el SMTP
  integrado de Supabase, que tiene un límite muy bajo de envíos por hora y no está pensado
  para producción. **Comprobar** en Supabase → Authentication → Emails (SMTP Settings) y
  en *Rate limits*.
- **Plan:** dominio verificado en Resend (SPF/DKIM en el DNS de inmersia.io), configurarlo
  como SMTP propio de Supabase y revisar las plantillas (confirmación, recuperar
  contraseña, cambio de correo) en tuteo, español de Venezuela.
- Probar en `inmersia-pruebas` primero (tiene *Confirm email* desactivado: activarlo solo
  para la prueba y volver a desactivarlo, que `npm run humo` lo necesita así).

## 3. Reglas que aplican

- Textos en tuteo, español de Venezuela; nunca voseo.
- Datos personales de producción: nunca sin permiso explícito de Juan, caso por caso.
- Cambios en el panel de Supabase de producción los hace Juan.

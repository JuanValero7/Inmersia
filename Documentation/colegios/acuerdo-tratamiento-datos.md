# Acuerdo de tratamiento de datos entre el Colegio e Inmersia

**Versión:** 3 de noviembre de 2026

Entre:

**El Colegio:** ______________________________________ (nombre del colegio), con domicilio en ______________________________________, representado por ______________________________________ (nombre y cargo). En adelante, «el Colegio».

**Inmersia:** Juan Alejandro Valero Zambrano, persona física, Lehrter Straße 24B, 10557 Berlín, Alemania, legal@inmersia.io. En adelante, «Inmersia».

---

## 1. Para qué es este acuerdo

El Colegio usa Inmersia, una plataforma de lectura, con sus alumnos. Este acuerdo fija cómo trata Inmersia los datos de esos alumnos **por encargo del Colegio**, conforme al artículo 28 del Reglamento General de Protección de Datos de la Unión Europea (RGPD) y a la normativa de protección de datos del país del Colegio.

- **El Colegio es el responsable** de los datos de la actividad escolar: qué alumnos forman cada aula, su nombre en la lista del curso y lo que muestra el panel del colegio.
- **Inmersia es el encargado:** trata esos datos solo para prestar el servicio al Colegio y según sus instrucciones.
- De la cuenta personal de cada usuario (su biblioteca, sus notas, su lectura fuera del aula) Inmersia sigue siendo responsable, según su Política de Privacidad.

## 2. Qué datos y de quién

| | |
|---|---|
| **Personas** | Alumnos del Colegio, profesores y personal de administración que el Colegio da de alta |
| **Datos del aula** | Aula a la que pertenece cada alumno, su nombre y apellido como figuran en la lista del curso, el libro asignado y la fecha meta |
| **Datos de lectura que ve el panel** | Avance en el libro del aula, capítulo, si va al día, minutos y días de lectura, días sin abrir el libro, capítulos terminados a más de 600 palabras por minuto, **cantidad** de predicciones y subrayados, párrafos subrayados por 3 alumnos o más (sin decir quién) |
| **Lo que el panel no muestra nunca** | El texto que escribe el alumno (notas, predicciones, comentarios privados, mensajes), su lectura fuera del aula, su correo y su fecha de nacimiento |
| **Finalidad** | Que el Colegio acompañe y evalúe la lectura de sus cursos |

## 3. Qué se compromete a hacer Inmersia

1. Tratar los datos **solo para prestar el servicio** al Colegio. No venderlos, no cederlos y no usarlos para publicidad.
2. Que solo accedan a ellos las personas que lo necesitan para prestar el servicio, con deber de confidencialidad.
3. Aplicar las medidas de seguridad del Anexo 1.
4. Usar solo los proveedores del Anexo 2. Si cambia alguno, avisará al Colegio con al menos 30 días, y el Colegio podrá oponerse y terminar el acuerdo.
5. Ayudar al Colegio a responder las peticiones de alumnos y familias (acceso, rectificación, borrado, etc.). Si una familia escribe a Inmersia por un asunto del aula, Inmersia se lo trasladará al Colegio.
6. Avisar al Colegio **sin demora, y en un máximo de 72 horas**, si sufre una brecha de seguridad que afecte a estos datos, con la información que tenga.
7. Al terminar el acuerdo, borrar las aulas del Colegio y los datos del panel en un máximo de **30 días**, salvo que el Colegio pida antes una copia. Las cuentas personales de los alumnos siguen existiendo; las de 12 y 13 años se borran, salvo que la familia pida conservarlas cuando el alumno cumpla 14.
8. Dar al Colegio la información razonable que necesite para comprobar que cumple este acuerdo.

## 4. Qué se compromete a hacer el Colegio

1. Tener una **base legal** para usar Inmersia con sus alumnos según su normativa (por ejemplo, su función educativa o la autorización de las familias).
2. **Alumnos de 12 y 13 años:** contar con la **autorización de sus padres o tutores** antes de entregarles el código del aula. Puede usar el modelo del Anexo 3. Inmersia solo crea cuentas de esa edad con un código de aula, confiando en esta autorización.
3. **Informar a las familias** de que usa Inmersia y de qué ve el panel (el Anexo 3 sirve también para esto).
4. Mantener **confidenciales los códigos** de administración, de profesor y de aula, y cambiarlos si se filtran.
5. Usar el panel **solo para acompañar la lectura** de sus alumnos, y que cada profesor vea solo sus aulas.
6. Mantener al día quién administra el Colegio en Inmersia, y sacar del aula a los alumnos que dejen el curso.

## 5. Transferencias internacionales

Algunos proveedores (Anexo 2) pueden procesar datos fuera de la Unión Europea, principalmente en Estados Unidos. Esas transferencias se amparan en las Cláusulas Contractuales Tipo de la Comisión Europea y, cuando corresponde, en el Marco de Privacidad de Datos UE-EE. UU.

## 6. Duración

Este acuerdo rige mientras el Colegio use Inmersia. Cualquiera de las partes puede terminarlo avisando por escrito con 30 días. Si el Colegio deja de usar Inmersia, se aplica el punto 3.7.

## 7. Contacto

- **Inmersia:** legal@inmersia.io
- **Colegio:** ______________________________________ (nombre, cargo y correo)

---

**Por el Colegio**

Nombre: ______________________________  Cargo: ______________________________

Firma: ______________________________  Fecha: ______________________________

**Por Inmersia**

Nombre: Juan Alejandro Valero Zambrano

Firma: ______________________________  Fecha: ______________________________

---

## Anexo 1. Medidas de seguridad

- Conexión cifrada (HTTPS/TLS) en todo el servicio.
- Inicio de sesión gestionado por Supabase Auth; las contraseñas se guardan cifradas (hash), nunca en texto.
- Reglas de acceso en la propia base de datos: cada usuario solo puede leer lo suyo, cada profesor solo los datos de sus aulas y la administración solo los de su Colegio. El texto que escriben los alumnos no se envía nunca al panel.
- Los códigos de administración caducan y sirven una sola vez; los de aula y de profesor se pueden cambiar en cualquier momento.
- Copias de seguridad de la base de datos.
- Registro de errores sin datos personales (Sentry, con el envío de datos personales desactivado).

## Anexo 2. Proveedores (subencargados)

| Proveedor | Servicio | Ubicación |
|---|---|---|
| Supabase Inc. | Base de datos, inicio de sesión y archivos | Estados Unidos / UE |
| Vercel Inc. | Alojamiento de la aplicación web | Estados Unidos / global |
| Functional Software, Inc. (Sentry) | Registro de errores técnicos, sin datos personales | Unión Europea (Alemania) |
| Google Ireland Limited | Solo si el usuario elige «Continuar con Google» para entrar | Unión Europea |

## Anexo 3. Modelo de comunicación y autorización para las familias

> **Asunto: Usaremos Inmersia en la lectura de [curso]**
>
> Estimadas familias:
>
> Este año, [nombre del colegio] usará **Inmersia** (inmersia.io), una plataforma de lectura con ilustraciones, sonido y actividades, para el plan lector de [curso].
>
> Para entrar, cada alumno crea una cuenta y usa el código de su aula, que le dará su profesor. Con ese código, su profesor y la dirección del colegio pueden ver **cómo avanza en el libro asignado**: por qué capítulo va, cuánto tiempo lee y si va al día. **No ven nada de lo que su hijo o hija escribe** (notas, comentarios o mensajes), ni lo que lee por su cuenta.
>
> El chat privado entre alumnos no está disponible para menores de 16 años.
>
> **Si su hijo o hija tiene 12 o 13 años**, necesitamos su autorización. Por favor, devuelva firmada la parte de abajo.
>
> Puede consultar la política de privacidad de Inmersia en inmersia.io/privacidad. Para cualquier duda o para pedir que se borren los datos de su hijo o hija, puede escribirnos a [correo del colegio] o a legal@inmersia.io.
>
> Atentamente,
> [nombre y cargo]
>
> - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
>
> Yo, ______________________________, madre / padre / tutor de ______________________________, de [curso], **autorizo** que use Inmersia con el código de su aula, en los términos descritos en esta comunicación.
>
> Firma: ______________________________  Fecha: ______________________________

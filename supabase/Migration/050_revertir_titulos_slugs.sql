-- =============================================================
-- INMERSIA — REVERTIR la normalización de títulos, autores y slugs
-- Formato: Plain Text SQL (.sql)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Este archivo NO se corre salvo que algo haya salido mal. Contiene
-- los valores tal y como estaban antes de normalizar tildes, mayúsculas
-- y slugs (export libros_rows del 2026-09-03). Es la red de seguridad
-- de ese cambio: se guardó aquí en vez de como tabla en Postgres, para
-- no dejar una tabla huérfana en la base de datos.
--
-- Ojo: solo devuelve titulo, autor y slug. Si después de normalizar se
-- editó alguno de esos campos a mano, esto se lo lleva por delante.
-- =============================================================

UPDATE libros l
SET    titulo = v.titulo,
       autor  = v.autor,
       slug   = v.slug
FROM (VALUES
  ('025d5dbc-9021-4ff7-a81a-fd75a1ece9e8'::uuid, 'Del sentimiento tragico de la vida', 'Miguel de Unamuno', 'del-sentimiento-tragico-de-la-vida'),
  ('05a01682-7109-4de7-886b-fcfdc8e835f0'::uuid, 'Capitanes Intrépidos', 'Rudyard Kipling', 'capitanes-intrepidos'),
  ('092ec0dc-e5a7-4138-aca5-72deb471700b'::uuid, 'Una vindicacion de los derechos de la mujer', 'Mary Wollstonecraft', 'una-vindicacion-de-los-derechos-de-las-mujeres'),
  ('0cc2e544-fcca-4fc1-8f5c-04fbf2516353'::uuid, 'El banquete, o del amor', 'Platon', 'amor'),
  ('18f1b6f8-5d2a-4425-8c72-66e1b6e31014'::uuid, 'Del origen del dinero', 'Carl Menger', 'dinero'),
  ('1d1fb28e-4cd3-4440-b172-365d99e3f707'::uuid, 'El Arte de la Guerra', 'Sun Tzu', 'guerra'),
  ('23914e81-7111-44e1-a018-8cd92f39c467'::uuid, 'El Corsario Negro', 'Emilio Salgari', 'el-corsario-negro'),
  ('3a5e683d-c547-4236-875f-ecdfe64dd221'::uuid, 'Noches Blancas', 'Fiodor Dostoyevski', 'noches-blancas'),
  ('663082c9-9349-41df-b626-6f51c7d21ec6'::uuid, 'Santiago Damour', 'Emile Zola', 'santiago-damour'),
  ('6c546b35-9c9d-40b9-9c04-567210f6dbcc'::uuid, 'Discurso del metodo', 'Rene Descartes', 'metodo'),
  ('7aa1398a-8dbf-4a7e-9eee-cebcdf2a86d1'::uuid, 'El Pragmatismo', 'James William', 'william'),
  ('7e64bf17-0066-46e3-8a33-ef1db5ee9cd5'::uuid, 'Ensayos Primera serie', 'Ralph Waldo Emerson', 'ensayos-primera-serie'),
  ('85256945-39d1-4b6e-a867-96d6a98024de'::uuid, 'El libro del te', 'Kakuzo Okakura', 'te'),
  ('85f39d63-e66c-4c7d-840f-d7070d15b396'::uuid, 'La gota de sangre y un destripador de antaño', 'Emilia Pardo Bazan', 'la-gota-de-sangre-y-un-destripador-de-antano'),
  ('90f8102f-c069-49e3-83fe-8f7180a6c650'::uuid, 'La busca', 'Pio Baroja', 'la-busca'),
  ('a9dd19c0-ad42-49d2-86e9-c6acf41e37e5'::uuid, 'Aforismos sobre la sabiduria de la vida', 'Arthur Schopenhauer', 'vida'),
  ('acf467ac-f187-413a-809a-b399afae1411'::uuid, 'La enfermedad mortal', 'Soren Kierkegaard', 'mortal'),
  ('b12df8c1-9550-462c-b9cc-3e3d261ba188'::uuid, 'Tratado sobre la tolerancia', 'Voltaire', 'tolerancia'),
  ('beb0389d-d5a0-42d0-932b-9d72f0a27319'::uuid, 'Primer amor', 'Ivan Turguenev', 'primer-amor'),
  ('d291b3d3-1d94-41bf-9481-51cdbaf4cc14'::uuid, 'El cupon falso', 'Leon Tolstoi', 'el-cupon-falso'),
  ('d5b546c2-f72a-4540-8981-d8e115375251'::uuid, 'Las Aventuras de Alicia en el país de las Maravillas', 'Lewis Carroll', 'las-aventuras-de-alicia-en-el-pais-de-las-maravillas'),
  ('e05c3604-ff46-461e-bdbc-fd8ccf1a897b'::uuid, 'Hacia el reino de los Sciris', 'Cesar Vallejo', 'hacia-el-reino-de-los-sciris'),
  ('f505c6fe-0d7a-4d21-8a7f-aa0fd4099a1e'::uuid, 'El hombre y la gente', 'Jose Ortega Y Gasset', 'gente'),
  ('fbc33746-d169-4dad-b96a-38bbf85f2569'::uuid, 'El Principito', 'Antoine De Saint-Exupery', 'principito'),
  ('fbf581e1-65bf-45ba-8310-36e74bde17cc'::uuid, 'La sala numero seis', 'Anton Chejov', 'la-sala-numero-seis'),
  ('fd7ea40d-561e-4cf2-99c5-7f9009e4002f'::uuid, 'Introduccion a la estetica', 'Georg Wilhelm Friedrich Hegel', 'estetica'),
  ('ff5abec2-53cf-4a5e-9b0a-db340d70ce2a'::uuid, 'Fundamentacion de la metafisica', 'Immanuel Kant', 'metafisica')
) AS v(id, titulo, autor, slug)
WHERE l.id = v.id;

SELECT titulo, autor, slug FROM libros ORDER BY orden NULLS LAST;

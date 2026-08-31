-- =============================================================
-- INMERSIA — Orden curado del catálogo
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Hasta ahora la Tienda mostraba los libros por fecha de alta (created_at DESC).
-- Para el lanzamiento el orden lo decide el autor: los libros que mejor
-- presentan a Inmersia van primero, no los últimos que se cargaron.
--
-- SE NUMERA DE 10 EN 10 a propósito. Con un orden 1,2,3… meter un libro nuevo
-- en el puesto 3 obliga a renumerar los 48 de abajo; con huecos basta con elegir
-- un número entre medio (entre 30 y 40 → 35) y no se toca nada más.
-- Si algún hueco se agota, se reespacia todo de una:
--     WITH r AS (SELECT id, row_number() OVER (ORDER BY orden) * 10 AS n
--                  FROM libros WHERE orden IS NOT NULL)
--     UPDATE libros l SET orden = r.n FROM r WHERE r.id = l.id;
--
-- Un libro nuevo con orden NULL cae al FINAL del catálogo (la query ordena
-- NULLS LAST y desempata por created_at DESC): nunca desaparece ni se cuela sin
-- querer, queda esperando a que se le asigne un puesto.
--
-- El listón "Nuevo" NO depende de este orden: se calcula por created_at (ver
-- useTiendaData.js). Un libro recién cargado se marca como nuevo aunque su
-- puesto curado lo mande al fondo.
--
-- Idempotente: se puede correr las veces que sea.
-- =============================================================

ALTER TABLE libros ADD COLUMN IF NOT EXISTS orden INTEGER;

COMMENT ON COLUMN libros.orden IS
  'Orden curado del catalogo (menor = mas arriba). Numerado de 10 en 10 para poder intercalar sin renumerar. NULL = sin puesto asignado, va al final.';

UPDATE libros l
   SET orden = v.orden
  FROM (VALUES
    (  10, 'principito'                                            ),  -- El Principito
    (  20, 'guerra'                                                ),  -- El Arte de la Guerra
    (  30, 'las-aventuras-de-alicia-en-el-pais-de-las-maravillas'  ),  -- Las Aventuras de Alicia en el país de las Maravillas
    (  40, 'robinson-crusoe'                                       ),  -- Robinson Crusoe
    (  50, 'meditaciones'                                          ),  -- Meditaciones
    (  60, 'el-extrano-caso-del-dr-jekyll-y-mr-hyde'               ),  -- El extraño caso del Dr. Jekyll y Mr. Hyde
    (  70, 'el-fantasma-de-canterville'                            ),  -- El fantasma de Canterville
    (  80, 'bambi-una-vida-en-el-bosque'                           ),  -- Bambi, una vida en el bosque
    (  90, 'amor'                                                  ),  -- El banquete, o del amor
    ( 100, 'metodo'                                                ),  -- Discurso del metodo
    ( 110, 'los-crimenes-de-la-calle-morgue'                       ),  -- Los crímenes de la calle Morgue
    ( 120, 'el-signo-de-los-cuatro'                                ),  -- El signo de los cuatro
    ( 130, 'noches-blancas'                                        ),  -- Noches Blancas
    ( 140, 'de-profundis'                                          ),  -- De profundis
    ( 150, 'la-muerte-en-venecia'                                  ),  -- La muerte en Venecia
    ( 160, 'novela-de-ajedrez'                                     ),  -- Novela de ajedrez
    ( 170, 'en-las-montanas-de-la-locura'                          ),  -- En las montañas de la locura
    ( 180, 'una-vindicacion-de-los-derechos-de-las-mujeres'        ),  -- Una vindicacion de los derechos de la mujer
    ( 190, 'vida'                                                  ),  -- Aforismos sobre la sabiduria de la vida
    ( 200, 'el-ocaso-de-los-idolos'                                ),  -- El ocaso de los ídolos
    ( 210, 'metafisica'                                            ),  -- Fundamentacion de la metafisica
    ( 220, 'tolerancia'                                            ),  -- Tratado sobre la tolerancia
    ( 230, 'capitanes-intrepidos'                                  ),  -- Capitanes Intrépidos
    ( 240, 'una-princesa-de-marte'                                 ),  -- Una princesa de Marte
    ( 250, 'horizontes-perdidos'                                   ),  -- Horizontes perdidos
    ( 260, 'el-corsario-negro'                                     ),  -- El Corsario Negro
    ( 270, 'primer-amor'                                           ),  -- Primer amor
    ( 280, 'la-sala-numero-seis'                                   ),  -- La sala numero seis
    ( 290, 'del-sentimiento-tragico-de-la-vida'                    ),  -- Del sentimiento tragico de la vida
    ( 300, 'te'                                                    ),  -- El libro del te
    ( 310, 'el-rojo-emblema-del-valor'                             ),  -- El rojo emblema del valor
    ( 320, 'la-busca'                                              ),  -- La busca
    ( 330, 'una-vida-sin-principios'                               ),  -- Una vida sin principios
    ( 340, 'mortal'                                                ),  -- La enfermedad mortal
    ( 350, 'tres-cuentos'                                          ),  -- Tres cuentos
    ( 360, 'gente'                                                 ),  -- El hombre y la gente
    ( 370, 'estetica'                                              ),  -- Introduccion a la estetica
    ( 380, 'william'                                               ),  -- El Pragmatismo
    ( 390, 'ensayos-primera-serie'                                 ),  -- Ensayos Primera serie
    ( 400, 'el-cupon-falso'                                        ),  -- El cupon falso
    ( 410, 'lo-personal-y-lo-sagrado'                              ),  -- Lo personal y lo sagrado
    ( 420, 'el-entierro-de-las-ratas'                              ),  -- El entierro de las ratas
    ( 430, 'la-gota-de-sangre-y-un-destripador-de-antano'          ),  -- La gota de sangre y un destripador de antaño
    ( 440, 'cuando-la-tierra-era-nina'                             ),  -- Cuando la tierra era niña
    ( 450, 'largo-viaje-hacia-la-noche'                            ),  -- Largo viaje hacia la noche
    ( 460, 'el-donador-de-almas-y-el-diablo-desinteresado'         ),  -- El donador de almas y el diablo desinteresado
    ( 470, 'dinero'                                                ),  -- Del origen del dinero
    ( 480, 'santiago-damour'                                       ),  -- Santiago Damour
    ( 490, 'hacia-el-reino-de-los-sciris'                          ),  -- Hacia el reino de los Sciris
    ( 500, 'la-bolsa-de-huesos'                                    )   -- La bolsa de huesos
  ) AS v(orden, slug)
 WHERE l.slug = v.slug;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN — 50 filas numeradas 10..500; el Manual (oculto) queda en NULL
-- ─────────────────────────────────────────────────────────────
SELECT orden, titulo, visible
FROM libros
ORDER BY orden NULLS LAST, created_at DESC;

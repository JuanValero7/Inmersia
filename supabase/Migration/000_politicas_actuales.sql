-- =============================================================
-- INMERSIA — RETRATO de las políticas RLS de producción
-- Exportado el 2026-08-31 con supabase/exportar-politicas.sql (BLOQUE 1).
--
-- ESTE ARCHIVO NO SE EJECUTA. Es documentación: el estado real de prod
-- en el momento del volcado, para poder auditarlo y reconstruirlo.
-- Varias de estas políticas nunca estuvieron en una migración (se
-- aplicaron a mano en el dashboard) — en particular
-- capitulos_guest_preview y parrafos_guest_preview, que son las que
-- implementan la muestra de 2 capítulos para invitados.
--
-- Los cambios POSTERIORES a este volcado viven en sus migraciones
-- numeradas (037 en adelante). Si volvés a exportar, reemplazá este
-- archivo entero y actualizá la fecha de arriba.
-- =============================================================

CREATE POLICY album_pegadas_insert
  ON public.album_barajitas_pegadas FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY album_pegadas_select
  ON public.album_barajitas_pegadas FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY anotaciones_delete
  ON public.anotaciones_usuario FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY anotaciones_insert
  ON public.anotaciones_usuario FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY anotaciones_select
  ON public.anotaciones_usuario FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY anotaciones_update
  ON public.anotaciones_usuario FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY biblioteca_media_select
  ON public.biblioteca_media FOR SELECT TO authenticated
  USING (true);

CREATE POLICY superusuario_media_update
  ON public.biblioteca_media FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM superusuarios WHERE (superusuarios.user_id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM superusuarios WHERE (superusuarios.user_id = auth.uid()))));

CREATE POLICY "Usuarios añaden a su biblioteca"
  ON public.bibliotecas_usuarios FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Usuarios ven su propia biblioteca"
  ON public.bibliotecas_usuarios FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Usuarios actualizan su propia biblioteca"
  ON public.bibliotecas_usuarios FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY capitulos_guest_preview
  ON public.capitulos FOR SELECT TO anon
  USING ((numero <= 2));

CREATE POLICY capitulos_select
  ON public.capitulos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY cartelera_select
  ON public.cartelera_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY cartelera_principal_select
  ON public.cartelera_principal FOR SELECT TO authenticated
  USING (true);

CREATE POLICY categorias_delete
  ON public.categorias_usuario FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY categorias_insert
  ON public.categorias_usuario FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY categorias_select
  ON public.categorias_usuario FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY categorias_update
  ON public.categorias_usuario FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY chat_historial_insert
  ON public.chat_historial FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY chat_historial_select
  ON public.chat_historial FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY chat_mensajes_insert
  ON public.chat_mensajes FOR INSERT TO authenticated
  WITH CHECK (((autor_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM chat_sesiones s
    WHERE ((s.id = chat_mensajes.sesion_id) AND ((s.usuario_a = auth.uid()) OR (s.usuario_b = auth.uid())))))));

CREATE POLICY chat_mensajes_select
  ON public.chat_mensajes FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM chat_sesiones s
    WHERE ((s.id = chat_mensajes.sesion_id) AND ((s.usuario_a = auth.uid()) OR (s.usuario_b = auth.uid()))))));

CREATE POLICY chat_sesiones_delete
  ON public.chat_sesiones FOR DELETE TO authenticated
  USING (((usuario_a = auth.uid()) OR (usuario_b = auth.uid())));

CREATE POLICY chat_sesiones_insert
  ON public.chat_sesiones FOR INSERT TO authenticated
  WITH CHECK ((usuario_a = auth.uid()));

CREATE POLICY chat_sesiones_select
  ON public.chat_sesiones FOR SELECT TO authenticated
  USING (((usuario_a = auth.uid()) OR (usuario_b = auth.uid())));

CREATE POLICY superusuario_ei_delete
  ON public.elementos_interactivos FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM superusuarios WHERE (superusuarios.user_id = auth.uid()))));

CREATE POLICY superusuario_ei_insert
  ON public.elementos_interactivos FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM superusuarios WHERE (superusuarios.user_id = auth.uid()))));

CREATE POLICY interactivos_select
  ON public.elementos_interactivos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY foros_select
  ON public.foros FOR SELECT TO authenticated
  USING (true);

CREATE POLICY foros_comentarios_delete
  ON public.foros_comentarios FOR DELETE TO authenticated
  USING ((autor_id = auth.uid()));

CREATE POLICY foros_comentarios_insert
  ON public.foros_comentarios FOR INSERT TO authenticated
  WITH CHECK ((autor_id = auth.uid()));

CREATE POLICY foros_comentarios_select
  ON public.foros_comentarios FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Solo admin puede modificar reels"
  ON public.libro_reels FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "Reels visibles para todos"
  ON public.libro_reels FOR SELECT TO public
  USING (true);

CREATE POLICY libros_public_read
  ON public.libros FOR SELECT TO anon
  USING (true);

CREATE POLICY libros_select
  ON public.libros FOR SELECT TO authenticated
  USING (true);

CREATE POLICY superusuario_parrafos_delete
  ON public.parrafos FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM superusuarios WHERE (superusuarios.user_id = auth.uid()))));

CREATE POLICY parrafos_guest_preview
  ON public.parrafos FOR SELECT TO anon
  USING ((capitulo_id IN ( SELECT capitulos.id FROM capitulos WHERE (capitulos.numero <= 2))));

CREATE POLICY parrafos_select
  ON public.parrafos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Perfil propio"
  ON public.perfiles FOR ALL TO public
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Perfiles visibles por dueño"
  ON public.perfiles FOR SELECT TO authenticated
  USING ((auth.uid() = id));

CREATE POLICY perfiles_update_propio
  ON public.perfiles FOR UPDATE TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY predicciones_delete
  ON public.predicciones_usuario FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY predicciones_insert
  ON public.predicciones_usuario FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY predicciones_select
  ON public.predicciones_usuario FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY predicciones_update
  ON public.predicciones_usuario FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY prefs_insert
  ON public.preferencias_usuario FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY prefs_select
  ON public.preferencias_usuario FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY prefs_update
  ON public.preferencias_usuario FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY progreso_insert
  ON public.progreso_lectura FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY progreso_select
  ON public.progreso_lectura FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY progreso_update
  ON public.progreso_lectura FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY resenas_delete
  ON public.resenas_libros FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY resenas_insert
  ON public.resenas_libros FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY resenas_select
  ON public.resenas_libros FOR SELECT TO authenticated
  USING (true);

CREATE POLICY resenas_update
  ON public.resenas_libros FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY sesiones_insert
  ON public.sesiones_lectura FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY sesiones_select
  ON public.sesiones_lectura FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY sesiones_update
  ON public.sesiones_lectura FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY subrayados_delete
  ON public.subrayados_usuario FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY subrayados_insert
  ON public.subrayados_usuario FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY subrayados_select
  ON public.subrayados_usuario FOR SELECT TO authenticated
  USING (true);

CREATE POLICY subrayados_update
  ON public.subrayados_usuario FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY superusuarios_select_own
  ON public.superusuarios FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

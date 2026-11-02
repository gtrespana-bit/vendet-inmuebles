-- =============================================================================
-- Migración 022: Etapa B — Índice de visitas del comprador y política RLS
-- para autocancelación controlada por el solicitante autenticado
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_solicitudes_visita_solicitante
  ON public.solicitudes_visita (solicitante_user_id, creado_en DESC)
  WHERE solicitante_user_id IS NOT NULL;

DROP POLICY IF EXISTS "solicitudes_visita_cancel_own_requester" ON public.solicitudes_visita;
CREATE POLICY "solicitudes_visita_cancel_own_requester"
  ON public.solicitudes_visita FOR UPDATE
  TO authenticated
  USING (
    solicitante_user_id IS NOT NULL
    AND auth.uid() = solicitante_user_id
    AND estado IN ('pendiente', 'confirmada')
  )
  WITH CHECK (
    solicitante_user_id IS NOT NULL
    AND auth.uid() = solicitante_user_id
    AND estado = 'cancelada'
  );

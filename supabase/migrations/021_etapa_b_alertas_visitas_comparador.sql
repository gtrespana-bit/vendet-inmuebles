-- =============================================================================
-- Migración 021: Etapa B — Búsquedas guardadas con alertas y Agenda de visitas
-- =============================================================================

-- 1. Tabla de búsquedas guardadas y alertas por correo
CREATE TABLE IF NOT EXISTS public.busquedas_guardadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 140),
  huella_filtros text NOT NULL CHECK (char_length(btrim(huella_filtros)) BETWEEN 4 AND 128),
  query_string text NOT NULL DEFAULT '' CHECK (char_length(query_string) <= 800),
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  alerta_email boolean NOT NULL DEFAULT true,
  frecuencia text NOT NULL DEFAULT 'diaria' CHECK (frecuencia IN ('inmediata', 'diaria', 'pausada')),
  ultimo_envio_en timestamptz,
  ultimos_inmuebles_enviados uuid[] NOT NULL DEFAULT '{}'::uuid[],
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT busquedas_guardadas_user_huella_uk UNIQUE (user_id, huella_filtros)
);

CREATE INDEX IF NOT EXISTS idx_busquedas_guardadas_user
  ON public.busquedas_guardadas (user_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_busquedas_guardadas_alertas_activas
  ON public.busquedas_guardadas (ultimo_envio_en NULLS FIRST)
  WHERE alerta_email = true AND frecuencia <> 'pausada';

ALTER TABLE public.busquedas_guardadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "busquedas_guardadas_select_own" ON public.busquedas_guardadas;
CREATE POLICY "busquedas_guardadas_select_own"
  ON public.busquedas_guardadas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "busquedas_guardadas_insert_own" ON public.busquedas_guardadas;
CREATE POLICY "busquedas_guardadas_insert_own"
  ON public.busquedas_guardadas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "busquedas_guardadas_update_own" ON public.busquedas_guardadas;
CREATE POLICY "busquedas_guardadas_update_own"
  ON public.busquedas_guardadas FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "busquedas_guardadas_delete_own" ON public.busquedas_guardadas;
CREATE POLICY "busquedas_guardadas_delete_own"
  ON public.busquedas_guardadas FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.busquedas_guardadas TO authenticated;
GRANT ALL ON public.busquedas_guardadas TO service_role;

-- 2. Tabla de solicitudes de visita / consulta rápida sobre inmuebles
CREATE TABLE IF NOT EXISTS public.solicitudes_visita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inmueble_id uuid NOT NULL REFERENCES public.inmuebles(id) ON DELETE CASCADE,
  propietario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  agencia_id uuid REFERENCES public.agencias(id) ON DELETE SET NULL,
  agente_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  solicitante_user_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  nombre_contacto text NOT NULL CHECK (char_length(btrim(nombre_contacto)) BETWEEN 2 AND 100),
  telefono_contacto text NOT NULL CHECK (char_length(btrim(telefono_contacto)) BETWEEN 7 AND 30),
  email_contacto text CHECK (email_contacto IS NULL OR char_length(btrim(email_contacto)) <= 160),
  modalidad text NOT NULL DEFAULT 'presencial' CHECK (modalidad IN ('presencial', 'videollamada', 'llamada')),
  fecha_preferida date,
  franja_horaria text NOT NULL DEFAULT 'flexible' CHECK (franja_horaria IN ('manana', 'tarde', 'fin_de_semana', 'flexible')),
  mensaje text CHECK (mensaje IS NULL OR char_length(mensaje) <= 800),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'atendida', 'cancelada')),
  nota_vendedor text CHECK (nota_vendedor IS NULL OR char_length(nota_vendedor) <= 500),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_visita_propietario
  ON public.solicitudes_visita (propietario_id, estado, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_solicitudes_visita_agente
  ON public.solicitudes_visita (agente_id, estado, creado_en DESC)
  WHERE agente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_visita_agencia
  ON public.solicitudes_visita (agencia_id, estado, creado_en DESC)
  WHERE agencia_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_visita_inmueble
  ON public.solicitudes_visita (inmueble_id, creado_en DESC);

ALTER TABLE public.solicitudes_visita ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitudes_visita_select_involved" ON public.solicitudes_visita;
CREATE POLICY "solicitudes_visita_select_involved"
  ON public.solicitudes_visita FOR SELECT
  TO authenticated
  USING (
    auth.uid() = propietario_id
    OR auth.uid() = agente_id
    OR auth.uid() = solicitante_user_id
    OR (
      agencia_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.agencias a
          WHERE a.id = solicitudes_visita.agencia_id
            AND a.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.agencia_miembros am
          WHERE am.agencia_id = solicitudes_visita.agencia_id
            AND am.user_id = auth.uid()
            AND am.estado = 'activo'
            AND am.rol IN ('owner', 'admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "solicitudes_visita_update_recipient" ON public.solicitudes_visita;
CREATE POLICY "solicitudes_visita_update_recipient"
  ON public.solicitudes_visita FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = propietario_id
    OR auth.uid() = agente_id
    OR (
      agencia_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.agencias a
          WHERE a.id = solicitudes_visita.agencia_id
            AND a.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.agencia_miembros am
          WHERE am.agencia_id = solicitudes_visita.agencia_id
            AND am.user_id = auth.uid()
            AND am.estado = 'activo'
            AND am.rol IN ('owner', 'admin')
        )
      )
    )
  )
  WITH CHECK (
    auth.uid() = propietario_id
    OR auth.uid() = agente_id
    OR (
      agencia_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.agencias a
          WHERE a.id = solicitudes_visita.agencia_id
            AND a.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.agencia_miembros am
          WHERE am.agencia_id = solicitudes_visita.agencia_id
            AND am.user_id = auth.uid()
            AND am.estado = 'activo'
            AND am.rol IN ('owner', 'admin')
        )
      )
    )
  );

-- Las inserciones pasan exclusivamente por POST /api/visitas (service_role + rate limit + honeypot)
REVOKE INSERT, DELETE ON public.solicitudes_visita FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.solicitudes_visita TO authenticated;
GRANT ALL ON public.solicitudes_visita TO service_role;

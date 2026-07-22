-- ============================================
-- FASE 1: Infraestructura para monetización
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar tipo_cuenta a perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT DEFAULT 'personal' CHECK (tipo_cuenta IN ('personal', 'agente', 'inmobiliaria'));
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS empresa_nombre TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS licencia_corredor TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS descripcion_agente TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Tabla de suscripciones
CREATE TABLE IF NOT EXISTS suscripciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('personal', 'agente', 'inmobiliaria', 'premium')),
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada', 'vencida', 'trial')),
  inicio TIMESTAMPTZ DEFAULT now() NOT NULL,
  fin TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Tabla de pagos
CREATE TABLE IF NOT EXISTS pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  suscripcion_id UUID REFERENCES suscripciones(id) ON DELETE SET NULL,
  monto_usd DECIMAL(10,2) NOT NULL,
  concepto TEXT NOT NULL, -- 'suscripcion', 'destacar', 'verificacion', 'servicio_premium'
  metodo_pago TEXT, -- 'pago_movil', 'zelle', 'transferencia', 'tarjeta'
  referencia TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'reembolsado')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  aprobado_en TIMESTAMPTZ
);

-- 4. Tabla de destacados (para tracking individual)
CREATE TABLE IF NOT EXISTS destacados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  inicio TIMESTAMPTZ DEFAULT now() NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  pagado BOOLEAN DEFAULT false,
  pago_id UUID REFERENCES pagos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_suscripciones_user ON suscripciones(user_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_estado ON suscripciones(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_user ON pagos(user_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_destacados_producto ON destacados(producto_id);
CREATE INDEX IF NOT EXISTS idx_destacados_user ON destacados(user_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_tipo_cuenta ON perfiles(tipo_cuenta);

-- 6. RLS
ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE destacados ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver sus propias suscripciones
CREATE POLICY "Users can view own subscriptions" ON suscripciones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON suscripciones FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden ver sus propios pagos
CREATE POLICY "Users can view own payments" ON pagos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON pagos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden ver sus destacados
CREATE POLICY "Users can view own highlights" ON destacados FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own highlights" ON destacados FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin policies (service_role bypasses RLS automatically)

-- 7. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_suscripciones_updated_at BEFORE UPDATE ON suscripciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

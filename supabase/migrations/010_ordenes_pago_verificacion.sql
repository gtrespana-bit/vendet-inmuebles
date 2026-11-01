-- Provisional payments: service-role only writes; row locks serialize every benefit.
CREATE TABLE public.ordenes_pago (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.perfiles(id),
 concepto text NOT NULL CHECK (concepto IN ('creditos','profesional','agencia')),
 creditos integer NOT NULL DEFAULT 0 CHECK (creditos >= 0),
 precio_usd numeric(10,2) NOT NULL CHECK (precio_usd > 0),
 monto numeric(14,2) NOT NULL CHECK (monto > 0), moneda text NOT NULL CHECK(moneda IN ('VES','USDT')),
 metodo text NOT NULL CHECK(metodo IN ('pagomovil','binance')), destinatario jsonb NOT NULL,
 estado text NOT NULL DEFAULT 'creada' CHECK(estado IN ('creada','revision','bloqueada','provisional','confirmada','rechazada')),
 motivos jsonb NOT NULL DEFAULT '[]', creada_en timestamptz NOT NULL DEFAULT now(),
 vence_en timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 otorgada_en timestamptz, revisada_en timestamptz, revisada_por uuid REFERENCES public.perfiles(id),
 nota_revision text, suscripcion_id uuid REFERENCES public.suscripciones(id), previas uuid[] NOT NULL DEFAULT '{}',
 creditos_otorgados integer NOT NULL DEFAULT 0, creditos_no_recuperados integer NOT NULL DEFAULT 0
);
CREATE TABLE public.intentos_pago (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), orden_id uuid NOT NULL REFERENCES public.ordenes_pago(id),
 creada_en timestamptz NOT NULL DEFAULT now(), ruta text NOT NULL, hash text NOT NULL,
 referencia text, texto text NOT NULL, confianza numeric NOT NULL, motivos jsonb NOT NULL
);
-- Reservations are never released: rejected proofs cannot be recycled on another account.
CREATE TABLE public.evidencias_pago (
 clave text PRIMARY KEY, orden_id uuid NOT NULL REFERENCES public.ordenes_pago(id)
);
CREATE INDEX ON public.ordenes_pago(user_id,creada_en DESC);
CREATE INDEX ON public.intentos_pago(orden_id,creada_en DESC);
ALTER TABLE public.ordenes_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidencias_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY ordenes_propietario ON public.ordenes_pago FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.ordenes_pago,public.intentos_pago,public.evidencias_pago FROM anon,authenticated;
GRANT SELECT ON public.ordenes_pago TO authenticated;
GRANT ALL ON public.ordenes_pago,public.intentos_pago,public.evidencias_pago TO service_role;

CREATE OR REPLACE FUNCTION public.otorgar_orden_pago(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.ordenes_pago%ROWTYPE; sid uuid; n integer; current_sub public.suscripciones%ROWTYPE; starts timestamptz:=now();
BEGIN
 SELECT * INTO STRICT o FROM ordenes_pago WHERE id=p_id FOR UPDATE;
 PERFORM 1 FROM perfiles WHERE id=o.user_id FOR UPDATE;
 IF o.otorgada_en IS NOT NULL THEN RETURN; END IF;
 IF o.concepto='creditos' THEN
   UPDATE perfiles SET credito_balance=credito_balance+o.creditos WHERE id=o.user_id;
   INSERT INTO transacciones_creditos(user_id,tipo,monto,precio_usd,metodo_pago,estado,motivo_registro)
   VALUES(o.user_id,'compra',o.creditos,o.precio_usd,o.metodo,'aprobado','Orden provisional '||o.id);
   UPDATE ordenes_pago SET creditos_otorgados=o.creditos WHERE id=o.id;
 ELSE
   SELECT * INTO current_sub FROM suscripciones WHERE user_id=o.user_id AND estado IN ('activa','trial') AND inicio<=now() AND (fin IS NULL OR fin>now()) ORDER BY created_at DESC LIMIT 1;
   IF (current_sub.plan='agencia' AND o.concepto='profesional') OR current_sub.plan=o.concepto THEN
     IF current_sub.fin IS NULL THEN RAISE EXCEPTION 'El plan actual no tiene fecha de fin: requiere revisión administrativa'; END IF;
     starts:=current_sub.fin;
   END IF;
   IF EXISTS(SELECT 1 FROM suscripciones WHERE user_id=o.user_id AND estado IN ('activa','trial') AND inicio>now()) THEN
     RAISE EXCEPTION 'Ya tienes un cambio de plan pagado programado';
   END IF;
   IF starts>now() THEN UPDATE suscripciones SET cambio_gratuita=false WHERE id=current_sub.id; END IF;
   IF starts=now() THEN
   SELECT coalesce(array_agg(id),'{}') INTO o.previas FROM suscripciones WHERE user_id=o.user_id AND estado IN ('activa','trial');
   UPDATE suscripciones SET estado='cancelada' WHERE id=ANY(o.previas);
   END IF;
   n:=CASE WHEN o.concepto='agencia' THEN 20 ELSE 5 END;
   INSERT INTO suscripciones(user_id,plan,estado,inicio,fin,creditos_incluidos,creditos_usados_mes,proxima_renovacion_creditos)
   VALUES(o.user_id,o.concepto,'activa',starts,starts+interval '30 days',n,0,starts+interval '30 days') RETURNING id INTO sid;
   IF starts=now() THEN UPDATE perfiles SET tipo_cuenta=o.concepto WHERE id=o.user_id; END IF;
   UPDATE ordenes_pago SET suscripcion_id=sid,previas=o.previas WHERE id=o.id;
 END IF;
 UPDATE ordenes_pago SET otorgada_en=now() WHERE id=o.id;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_intento_pago(p_id uuid,p_ruta text,p_hash text,p_referencia text,p_texto text,p_confianza numeric,p_motivos jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.ordenes_pago%ROWTYPE; reasons jsonb:=p_motivos; key text; owner uuid; blocked boolean:=false;
BEGIN
 SELECT * INTO STRICT o FROM ordenes_pago WHERE id=p_id FOR UPDATE;
 PERFORM 1 FROM perfiles WHERE id=o.user_id FOR UPDATE;
 IF o.estado IN ('provisional','confirmada') THEN RETURN o.estado; END IF;
 IF o.estado='rechazada' THEN RAISE EXCEPTION 'Orden rechazada definitivamente; crea otra orden'; END IF;
 IF (SELECT count(*) FROM intentos_pago WHERE orden_id=o.id)>=10 THEN RAISE EXCEPTION 'Máximo de intentos alcanzado; contacta con soporte'; END IF;
 -- Locks unique evidence keys in deterministic order, preventing cross-account races.
 FOR key IN SELECT unnest(ARRAY['hash:'||p_hash,CASE WHEN p_referencia IS NOT NULL THEN 'ref:'||o.metodo||':'||p_referencia END]) ORDER BY 1 LOOP
   IF key IS NULL THEN CONTINUE; END IF;
   INSERT INTO evidencias_pago(clave,orden_id) VALUES(key,o.id) ON CONFLICT DO NOTHING;
   SELECT orden_id INTO owner FROM evidencias_pago WHERE clave=key;
   IF owner<>o.id THEN blocked:=true; END IF;
 END LOOP;
 IF blocked THEN reasons:=reasons||jsonb_build_array('Referencia o imagen ya utilizada en otra orden. Puedes subir el justificante correcto.'); END IF;
 IF o.vence_en<now() THEN reasons:=reasons||jsonb_build_array('Orden vencida: requiere revisión.'); END IF;
 IF EXISTS(SELECT 1 FROM ordenes_pago WHERE user_id=o.user_id AND estado='rechazada') THEN
   reasons:=reasons||jsonb_build_array('La cuenta tiene un pago rechazado y requiere revisión.');
 END IF;
 IF p_referencia IS NOT NULL AND EXISTS(SELECT 1 FROM transacciones_creditos WHERE regexp_replace(lower(referencia),'[^a-z0-9]','','g')=p_referencia AND estado<>'rechazado') THEN
   blocked:=true; reasons:=reasons||jsonb_build_array('Referencia ya registrada en una compra anterior.');
 END IF;
 IF o.precio_usd>40 OR EXISTS(SELECT 1 FROM ordenes_pago WHERE user_id=o.user_id AND id<>o.id AND estado='provisional') THEN
   reasons:=reasons||jsonb_build_array('Requiere revisión: límite de activación provisional.');
 END IF;
 INSERT INTO intentos_pago(orden_id,ruta,hash,referencia,texto,confianza,motivos)
 VALUES(o.id,p_ruta,p_hash,p_referencia,p_texto,p_confianza,reasons);
 IF jsonb_array_length(reasons)=0 AND p_referencia IS NOT NULL THEN
   BEGIN
     PERFORM otorgar_orden_pago(o.id);
     UPDATE ordenes_pago SET estado='provisional',motivos=reasons WHERE id=o.id;
     RETURN 'provisional';
   EXCEPTION WHEN OTHERS THEN
     reasons:=reasons||jsonb_build_array('No se pudo activar automáticamente: requiere revisión del plan actual.');
   END;
 END IF;
 UPDATE ordenes_pago SET estado=CASE WHEN blocked THEN 'bloqueada' ELSE 'revision' END,motivos=reasons WHERE id=o.id;
 RETURN CASE WHEN blocked THEN 'bloqueada' ELSE 'revision' END;
END $$;

CREATE OR REPLACE FUNCTION public.revisar_orden_pago(p_id uuid,p_admin uuid,p_confirmar boolean,p_nota text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.ordenes_pago%ROWTYPE; recovered integer; tipo text;
BEGIN
 SELECT * INTO STRICT o FROM ordenes_pago WHERE id=p_id FOR UPDATE;
 PERFORM 1 FROM perfiles WHERE id=o.user_id FOR UPDATE;
 IF o.estado IN ('confirmada','rechazada') THEN RETURN o.estado; END IF;
 IF NOT EXISTS(SELECT 1 FROM intentos_pago WHERE orden_id=o.id) THEN RAISE EXCEPTION 'No hay justificante'; END IF;
 IF p_confirmar THEN
   IF o.estado='bloqueada' THEN RAISE EXCEPTION 'Referencia duplicada: solicita un nuevo justificante'; END IF;
   PERFORM otorgar_orden_pago(o.id);
 ELSE
   IF length(trim(coalesce(p_nota,'')))<5 THEN RAISE EXCEPTION 'Indica el motivo del rechazo'; END IF;
   IF o.otorgada_en IS NOT NULL THEN
     IF o.concepto='creditos' THEN
       SELECT least(credito_balance,o.creditos_otorgados)::integer INTO recovered FROM perfiles WHERE id=o.user_id;
       UPDATE perfiles SET credito_balance=credito_balance-recovered WHERE id=o.user_id;
       UPDATE ordenes_pago SET creditos_no_recuperados=o.creditos_otorgados-recovered WHERE id=o.id;
       UPDATE transacciones_creditos SET estado='reembolsado',motivo_registro='Revocada orden '||o.id||': '||p_nota
         WHERE motivo_registro='Orden provisional '||o.id;
       -- Already-consumed services cannot be undone: outstanding amount is explicit for admin action.
     ELSE
       UPDATE suscripciones SET estado='cancelada' WHERE id=o.suscripcion_id;
       IF NOT EXISTS(SELECT 1 FROM suscripciones WHERE user_id=o.user_id AND estado IN ('activa','trial') AND id<>o.suscripcion_id AND (fin IS NULL OR fin>now())) THEN
         UPDATE suscripciones SET estado=CASE WHEN trial_ends_at>now() THEN 'trial' ELSE 'activa' END
           WHERE id=ANY(o.previas) AND fin>now();
         SELECT plan INTO tipo FROM suscripciones WHERE user_id=o.user_id AND estado IN ('activa','trial') AND (fin IS NULL OR fin>now()) ORDER BY created_at DESC LIMIT 1;
         UPDATE perfiles SET tipo_cuenta=CASE WHEN tipo IN ('profesional','agencia') THEN tipo ELSE 'particular' END WHERE id=o.user_id;
       END IF;
     END IF;
   END IF;
 END IF;
 UPDATE ordenes_pago SET estado=CASE WHEN p_confirmar THEN 'confirmada' ELSE 'rechazada' END,
 revisada_en=now(),revisada_por=p_admin,nota_revision=left(p_nota,1000) WHERE id=o.id;
 RETURN CASE WHEN p_confirmar THEN 'confirmada' ELSE 'rechazada' END;
END $$;
REVOKE ALL ON FUNCTION public.otorgar_orden_pago(uuid),public.registrar_intento_pago(uuid,text,text,text,text,numeric,jsonb),public.revisar_orden_pago(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.otorgar_orden_pago(uuid),public.registrar_intento_pago(uuid,text,text,text,text,numeric,jsonb),public.revisar_orden_pago(uuid,uuid,boolean,text) TO service_role;

-- Private evidence: uploads only through authenticated API, immutable paths per attempt.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('justificantes-pagos','justificantes-pagos',false,5242880,ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;

-- Free downgrades are self-service, effective only when the current paid/trial period ends.
ALTER TABLE public.suscripciones ADD COLUMN IF NOT EXISTS cambio_gratuita boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.programar_plan_gratuito(p_user uuid,p_cancelar boolean DEFAULT false)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.suscripciones%ROWTYPE;
BEGIN
 PERFORM 1 FROM perfiles WHERE id=p_user FOR UPDATE;
 SELECT * INTO s FROM suscripciones WHERE user_id=p_user AND estado IN ('activa','trial') AND inicio<=now() AND (fin IS NULL OR fin>now()) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF s.id IS NULL THEN RETURN now(); END IF;
 IF s.fin IS NULL THEN RAISE EXCEPTION 'El plan actual no tiene fecha de fin. Contacta con soporte para corregirla.'; END IF;
 IF EXISTS(SELECT 1 FROM suscripciones WHERE user_id=p_user AND estado IN ('activa','trial') AND inicio>now()) THEN RAISE EXCEPTION 'Ya tienes un cambio pagado programado. Contacta con soporte.'; END IF;
 UPDATE suscripciones SET cambio_gratuita=NOT p_cancelar WHERE id=s.id;
 RETURN s.fin;
END $$;
REVOKE ALL ON FUNCTION public.programar_plan_gratuito(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.programar_plan_gratuito(uuid,boolean) TO service_role;

-- Expensive OCR must fail closed and reserve budget before doing CPU work.
-- The existing generic rate limiter is fail-open, so payments use this atomic RPC.
CREATE OR REPLACE FUNCTION public.reservar_analisis_pago(p_user uuid,p_ip text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('payment-ocr:'||coalesce(p_ip,'unknown'),0));
 PERFORM 1 FROM perfiles WHERE id=p_user FOR UPDATE;
 IF (SELECT count(*) FROM rate_limit WHERE key='pagos:ocr' AND identifier=p_user::text AND created_at>now()-interval '1 hour')>=6
 OR (p_ip IS NOT NULL AND (SELECT count(*) FROM rate_limit WHERE key='pagos:ocr' AND ip=p_ip AND created_at>now()-interval '1 hour')>=12)
 THEN RETURN false; END IF;
 INSERT INTO rate_limit(key,identifier,ip) VALUES('pagos:ocr',p_user::text,p_ip);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reservar_analisis_pago(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_analisis_pago(uuid,text) TO service_role;

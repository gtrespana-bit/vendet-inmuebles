-- Account trial: freely switch plans without payment or extending the original deadline.
CREATE OR REPLACE FUNCTION public.cambiar_plan_prueba(p_user uuid,p_plan text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.suscripciones%ROWTYPE;
BEGIN
 IF p_plan NOT IN ('gratuita','profesional','agencia') OR p_plan IS NULL THEN RAISE EXCEPTION 'Plan inválido'; END IF;
 PERFORM 1 FROM perfiles WHERE id=p_user FOR UPDATE;
 SELECT * INTO s FROM suscripciones WHERE user_id=p_user AND estado IN ('activa','trial')
   AND inicio<=now() AND (fin IS NULL OR fin>now()) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF s.id IS NULL OR s.estado<>'trial' OR s.trial_ends_at IS NULL OR s.trial_ends_at<=now() THEN
   RAISE EXCEPTION 'La prueba gratuita ya no está activa. Actualiza la página para ver las opciones disponibles.';
 END IF;
 IF EXISTS(SELECT 1 FROM suscripciones WHERE user_id=p_user AND estado IN ('activa','trial') AND inicio>now()) THEN
   RAISE EXCEPTION 'Ya hay un cambio pagado programado. Revisa tus pagos antes de cambiar la prueba.';
 END IF;
 UPDATE suscripciones SET plan=p_plan,cambio_gratuita=false,
   creditos_incluidos=CASE p_plan WHEN 'agencia' THEN 20 WHEN 'profesional' THEN 5 ELSE 0 END
   WHERE id=s.id;
 -- No credit balance increments, no new trial, no changes to inicio/fin/trial_ends_at.
 UPDATE perfiles SET tipo_cuenta=CASE p_plan WHEN 'gratuita' THEN 'particular' ELSE p_plan END WHERE id=p_user;
 RETURN s.trial_ends_at;
END $$;
REVOKE ALL ON FUNCTION public.cambiar_plan_prueba(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_plan_prueba(uuid,text) TO service_role;

-- Also protect old payment orders and manual approval while a trial is active.
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
   IF EXISTS(SELECT 1 FROM suscripciones WHERE user_id=o.user_id AND estado='trial' AND inicio<=now() AND trial_ends_at>now() AND (fin IS NULL OR fin>now())) THEN
     RAISE EXCEPTION 'Tu prueba sigue activa: cambia de plan gratis desde Planes, sin realizar un pago.';
   END IF;
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

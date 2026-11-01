import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// Real PostgreSQL engine in WASM; transaction, unique-key and PL/pgSQL tests, no live data.
const db = new PGlite()
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE rate_limit(key text,identifier text,ip text,created_at timestamptz DEFAULT now());
CREATE TABLE perfiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), credito_balance numeric NOT NULL DEFAULT 0 CHECK(credito_balance>=0), tipo_cuenta text DEFAULT 'particular');
CREATE TABLE suscripciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES perfiles,plan text,estado text,inicio timestamptz DEFAULT now(),fin timestamptz,trial_ends_at timestamptz,created_at timestamptz DEFAULT now(),creditos_incluidos integer,creditos_usados_mes integer,proxima_renovacion_creditos timestamptz);
CREATE TABLE transacciones_creditos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,tipo text,monto integer,precio_usd numeric,metodo_pago text,estado text,motivo_registro text,referencia text);
`)
await db.exec(readFileSync(new URL('../supabase/migrations/010_ordenes_pago_verificacion.sql',import.meta.url),'utf8'))
const one = async (sql,params=[]) => (await db.query(sql,params)).rows[0]
const user = async () => (await one('INSERT INTO perfiles DEFAULT VALUES RETURNING id')).id
async function order(uid,concepto='creditos') {
 return (await one(`INSERT INTO ordenes_pago(user_id,concepto,creditos,precio_usd,monto,moneda,metodo,destinatario) VALUES($1,$2,15,5,5,'USDT','binance','{}') RETURNING id`,[uid,concepto])).id
}
const attempt = async (id,ref,hash=ref,reasons=[]) => (await one(`SELECT registrar_intento_pago($1,'path',$2,$3,'text',95,$4::jsonb) AS state`,[id,hash,ref,JSON.stringify(reasons)])).state
const review = async (id,confirmar,nota='Revisión realizada') => (await one('SELECT revisar_orden_pago($1,NULL,$2,$3) AS state',[id,confirmar,nota])).state

test('credit grant and confirmation are idempotent',async()=>{
 const uid=await user(); const id=await order(uid)
 assert.equal(await attempt(id,'unique0001'),'provisional')
 assert.equal(await attempt(id,'unique0001'),'provisional')
 assert.equal(await review(id,true),'confirmada'); assert.equal(await review(id,true),'confirmada')
 assert.equal(Number((await one('SELECT credito_balance FROM perfiles WHERE id=$1',[uid])).credito_balance),15)
})
test('reference or image reused across accounts cannot activate; corrected upload can',async()=>{
 const uid=await user();const id=await order(uid)
 assert.equal(await attempt(id,'unique0001','otherimage'),'bloqueada')
 await assert.rejects(()=>review(id,true),/duplicada/)
 assert.equal(await attempt(id,'unique0002','unique0002'),'provisional')
 assert.equal((await one('SELECT count(*) FROM intentos_pago WHERE orden_id=$1',[id])).count,2)
 const uid2=await user();const id2=await order(uid2)
 assert.equal(await attempt(id2,'unique0003','unique0002'),'bloqueada')
})
test('uncertain receipt can be resubmitted and manual approval grants once',async()=>{
 const uid=await user(); const id=await order(uid)
 assert.equal(await attempt(id,null,'uncertain',['No legible']),'revision')
 assert.equal(await attempt(id,'unique0004','corrected',['Revisión necesaria']),'revision')
 assert.equal(await review(id,true),'confirmada')
 assert.equal(Number((await one('SELECT credito_balance FROM perfiles WHERE id=$1',[uid])).credito_balance),15)
})
test('one provisional grant per account, rejected credit revocation records consumed debt',async()=>{
 const uid=await user();const id=await order(uid);const id2=await order(uid)
 assert.equal(await attempt(id,'unique0005'),'provisional')
 assert.equal(await attempt(id2,'unique0006'),'revision')
 await db.query('UPDATE perfiles SET credito_balance=4 WHERE id=$1',[uid])
 assert.equal(await review(id,false),'rechazada');assert.equal(await review(id,false),'rechazada')
 assert.equal(Number((await one('SELECT credito_balance FROM perfiles WHERE id=$1',[uid])).credito_balance),0)
 assert.equal((await one('SELECT creditos_no_recuperados FROM ordenes_pago WHERE id=$1',[id])).creditos_no_recuperados,11)
 assert.equal(await attempt(id2,'unique0006'),'revision')
})
test('upgrade activates immediately, rejected payment restores still-valid subscription',async()=>{
 const uid=await user()
 const old=(await one("INSERT INTO suscripciones(user_id,plan,estado,fin) VALUES($1,'profesional','activa',now()+interval '15 days') RETURNING id",[uid])).id
 const id=await order(uid,'agencia');assert.equal(await attempt(id,'unique0007'),'provisional')
 assert.equal((await one('SELECT estado FROM suscripciones WHERE id=$1',[old])).estado,'cancelada')
 assert.equal((await one('SELECT tipo_cuenta FROM perfiles WHERE id=$1',[uid])).tipo_cuenta,'agencia')
 assert.equal(await review(id,false),'rechazada')
 assert.equal((await one('SELECT estado FROM suscripciones WHERE id=$1',[old])).estado,'activa')
 assert.equal((await one('SELECT tipo_cuenta FROM perfiles WHERE id=$1',[uid])).tipo_cuenta,'profesional')
})
test('paid downgrade starts only at current end; free downgrade can be cancelled',async()=>{
 const uid=await user()
 const old=await one("INSERT INTO suscripciones(user_id,plan,estado,fin) VALUES($1,'agencia','activa',now()+interval '15 days') RETURNING id,fin",[uid])
 await db.query('SELECT programar_plan_gratuito($1,false)',[uid])
 assert.equal((await one('SELECT cambio_gratuita FROM suscripciones WHERE id=$1',[old.id])).cambio_gratuita,true)
 await db.query('SELECT programar_plan_gratuito($1,true)',[uid])
 const id=await order(uid,'profesional');assert.equal(await attempt(id,'unique0008'),'provisional')
 const scheduled=await one('SELECT s.inicio,s.fin,s.estado FROM suscripciones s JOIN ordenes_pago o ON s.id=o.suscripcion_id WHERE o.id=$1',[id])
 assert.equal(scheduled.inicio.toISOString(),old.fin.toISOString())
 assert.equal((await one('SELECT estado FROM suscripciones WHERE id=$1',[old.id])).estado,'activa')
})
test('browser roles cannot invoke grant/review RPCs or write payment tables',async()=>{
 assert.equal((await one("SELECT has_function_privilege('authenticated','otorgar_orden_pago(uuid)','EXECUTE') AS allowed")).allowed,false)
 assert.equal((await one("SELECT has_table_privilege('authenticated','ordenes_pago','INSERT') AS allowed")).allowed,false)
})
test('OCR budget reserved atomically before work, with user and IP limits',async()=>{
 const uid=await user()
 for(let n=0;n<6;n++) assert.equal((await one("SELECT reservar_analisis_pago($1,'192.0.2.1') AS allowed",[uid])).allowed,true)
 assert.equal((await one("SELECT reservar_analisis_pago($1,'192.0.2.2') AS allowed",[uid])).allowed,false)
 const uid2=await user()
 for(let n=0;n<6;n++) assert.equal((await one("SELECT reservar_analisis_pago($1,'192.0.2.1') AS allowed",[uid2])).allowed,true)
 assert.equal((await one("SELECT reservar_analisis_pago($1,'192.0.2.1') AS allowed",[await user()])).allowed,false)
})
test.after(async()=>{await db.close()})

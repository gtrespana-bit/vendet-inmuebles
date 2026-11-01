import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const db=new PGlite()
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE TABLE perfiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE suscripciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES perfiles,plan text,estado text,inicio timestamptz DEFAULT now(),fin timestamptz,trial_ends_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE inmuebles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario_id uuid REFERENCES perfiles,activo boolean DEFAULT true,vendido boolean DEFAULT false,titulo text);
CREATE TABLE inmueble_imagenes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),inmueble_id uuid REFERENCES inmuebles,orden integer DEFAULT 0);
GRANT SELECT,INSERT,UPDATE ON inmuebles,inmueble_imagenes TO authenticated;
`)
await db.exec(readFileSync(new URL('../supabase/migrations/012_limites_publicacion_en_bd.sql',import.meta.url),'utf8'))
const one=async(sql,params=[]) => (await db.query(sql,params)).rows[0]
const user=async(plan='gratuita',state='activa',offset='1 day')=>{
 const {id}=await one('INSERT INTO perfiles DEFAULT VALUES RETURNING id')
 if(plan!=='gratuita') await db.query(`INSERT INTO suscripciones(user_id,plan,estado,fin,trial_ends_at) VALUES($1,$2,$3,now()+$4::interval,now()+$4::interval)`,[id,plan,state,offset])
 return id
}
const listing=async(uid,active=true)=>(await one('INSERT INTO inmuebles(usuario_id,activo) VALUES($1,$2) RETURNING id',[uid,active])).id
const photo=async(id)=>db.query('INSERT INTO inmueble_imagenes(inmueble_id) VALUES($1)',[id])
test('direct writes obey 3/10 limits and agency supports more than ten',async()=>{
 for(const [plan,max] of [['gratuita',3],['profesional',10],['agencia',12]]) {
  const uid=await user(plan);for(let i=0;i<max;i++) await listing(uid)
  if(plan!=='agencia') await assert.rejects(()=>listing(uid),/Límite de publicaciones/)
  else await listing(uid)
 }
})
test('reactivation cannot bypass quota; pausing frees a slot',async()=>{
 const uid=await user();const first=await listing(uid);await listing(uid);await listing(uid)
 const paused=await listing(uid,false)
 await assert.rejects(()=>db.query('UPDATE inmuebles SET activo=true WHERE id=$1',[paused]),/Límite/)
 await db.query('UPDATE inmuebles SET activo=false WHERE id=$1',[first])
 await db.query('UPDATE inmuebles SET activo=true WHERE id=$1',[paused])
})
test('photo quotas apply at 8/20/30 and moving images cannot bypass quota',async()=>{
 for(const [plan,max] of [['gratuita',8],['profesional',20],['agencia',30]]) {
  const uid=await user(plan),id=await listing(uid)
  for(let i=0;i<max;i++) await photo(id)
  await assert.rejects(()=>photo(id),/Límite de fotos/)
  await db.query('UPDATE inmueble_imagenes SET orden=2 WHERE inmueble_id=$1',[id])
  const other=await listing(uid);await photo(other)
  await assert.rejects(()=>db.query('UPDATE inmueble_imagenes SET inmueble_id=$1 WHERE inmueble_id=$2',[id,other]),/Límite de fotos/)
 }
})
test('expired trials/subscriptions and future subscriptions do not grant paid limits',async()=>{
 for(const state of ['activa','trial']) {
  const uid=await user('agencia',state,'-1 day')
  for(let i=0;i<3;i++) await listing(uid)
  await assert.rejects(()=>listing(uid),/Límite/)
 }
 const uid=await user('agencia');await db.query("UPDATE suscripciones SET inicio=now()+interval '1 hour' WHERE user_id=$1",[uid])
 for(let i=0;i<3;i++) await listing(uid)
 await assert.rejects(()=>listing(uid),/Límite/)
})
test('existing excess after downgrade is preserved/editable, not newly extendable',async()=>{
 const uid=await user('agencia'), ids=[]
 for(let i=0;i<4;i++) ids.push(await listing(uid))
 for(let i=0;i<9;i++) await photo(ids[0])
 await db.query("UPDATE suscripciones SET estado='cancelada' WHERE user_id=$1",[uid])
 await db.query("UPDATE inmuebles SET activo=true,titulo='Updated' WHERE usuario_id=$1",[uid])
 assert.equal((await one('SELECT count(*) FROM inmuebles WHERE usuario_id=$1',[uid])).count,4)
 await assert.rejects(()=>listing(uid),/Límite/)
 await assert.rejects(()=>photo(ids[0]),/Límite/)
 await db.query('UPDATE inmueble_imagenes SET orden=1 WHERE inmueble_id=$1',[ids[0]])
})
test('authenticated role cannot bypass triggers and cannot execute quota internals',async()=>{
 const uid=await user();for(let i=0;i<3;i++) await listing(uid)
 await db.exec('SET ROLE authenticated')
 try { await assert.rejects(()=>listing(uid),/Límite/)
 await assert.rejects(()=>db.query('SELECT plan_efectivo_publicacion($1)',[uid]),/permission denied/) }
 finally { await db.exec('RESET ROLE') }
})
test('multi-row insertion rolls back all rows when the quota would be exceeded',async()=>{
 const uid=await user()
 await assert.rejects(()=>db.query('INSERT INTO inmuebles(usuario_id) SELECT $1::uuid FROM generate_series(1,4)',[uid]),/Límite/)
 assert.equal((await one('SELECT count(*) FROM inmuebles WHERE usuario_id=$1',[uid])).count,0)
})
test('migration can be reapplied without deleting existing inventory',async()=>{
 const before=(await one('SELECT count(*) FROM inmuebles')).count
 await db.exec(readFileSync(new URL('../supabase/migrations/012_limites_publicacion_en_bd.sql',import.meta.url),'utf8'))
 assert.equal((await one('SELECT count(*) FROM inmuebles')).count,before)
})
test.after(()=>db.close())

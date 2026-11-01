import test from 'node:test'
import assert from 'node:assert/strict'
import { observeAuth } from '../src/lib/auth-observer.ts'
import { verifySession } from '../src/lib/verify-session.ts'
const tick = () => new Promise(resolve => setImmediate(resolve))
const session = id => ({ user: { id }, access_token: id })
function source() {
  let resolve, listener, active = 0
  return {
    getSession: () => new Promise(r => { resolve = r }),
    onAuthStateChange: cb => { listener = cb; active++; return { data: { subscription: { unsubscribe: () => { active-- } } } } },
    event: s => listener('CHANGE',s),
    finish: s => resolve({ data: { session: s }, error: null }),
    active: () => active,
  }
}
test('session updates stay subscribed through login, refresh, logout and another account', async () => {
 const auth = source(), seen = []
 const stop = observeAuth(auth, s => seen.push(s?.user.id ?? null))
 auth.finish(null); await tick()
 for(const s of [session('a'), session('a-refresh'), null, session('b')]) auth.event(s)
 assert.deepEqual(seen,[null,'a','a-refresh',null,'b'])
 assert.equal(auth.active(),1); stop(); assert.equal(auth.active(),0)
})
test('slow initial read cannot restore a signed-out account', async () => {
 const auth = source(), seen=[]; const stop=observeAuth(auth,s=>seen.push(s))
 auth.event(null); auth.finish(session('old')); await tick()
 assert.deepEqual(seen,[null]); stop()
})
test('Strict Mode cleanup/remount creates a fresh subscription; late results are ignored', async () => {
 const auth=source(), seen=[]
 const stop=observeAuth(auth,s=>seen.push(s)); stop(); auth.finish(session('stale')); await tick()
 assert.deepEqual(seen,[])
 const stop2=observeAuth(auth,s=>seen.push(s));auth.finish(session('new'));await tick()
 assert.equal(seen[0].user.id,'new');assert.equal(auth.active(),1);stop2()
})
test('only verified server identity is accepted, not the cookie payload', async () => {
 const trusted={id:'verified',email:'trusted@example.com'}
 assert.equal(await verifySession('forged.admin.jwt',async()=>({data:{user:trusted},error:null})),trusted)
 for(const verify of [async()=>({data:{user:trusted},error:{status:401}}),async()=>{throw Error('offline')}]) {
   assert.equal(await verifySession('forged.admin.jwt',verify),null)
 }
 let called=false
 assert.equal(await verifySession(undefined,async()=>{called=true}),null);assert.equal(called,false)
})
test('timeout denies access and aborts the verification request', async () => {
 let signal
 assert.equal(await verifySession('forged.admin.jwt',async(_token,s)=>{signal=s;return new Promise(()=>{})},5),null)
 assert.equal(signal.aborted,true)
})

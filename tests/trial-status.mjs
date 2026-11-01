import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {trialDaysRemaining} from '../src/lib/trial-status.ts'
const now=Date.parse('2026-10-31T12:00:00Z')
test('remaining trial days are rounded up, not reset on plan changes',()=>{
 assert.equal(trialDaysRemaining('trial','2026-11-30T12:00:00Z',now),30)
 assert.equal(trialDaysRemaining('trial','2026-11-01T00:00:00Z',now),1)
 assert.equal(trialDaysRemaining('trial','2026-11-02T13:00:00Z',now),3)
})
test('expired, missing, invalid and paid periods are not free trials',()=>{
 for(const date of [null,'invalid','2026-10-31T12:00:00Z','2026-10-30T12:00:00Z']) assert.equal(trialDaysRemaining('trial',date,now),0)
 assert.equal(trialDaysRemaining('activa','2026-11-30T12:00:00Z',now),0)
})
test('production middleware allows every public single-segment page including payments',()=>{
 const middleware=readFileSync('src/middleware.ts','utf8')
 const entries=middleware.match(/const STATIC_SEGMENTS = new Set\(\[([\s\S]*?)\]\)/)[1]
 const allowed=new Set(Array.from(entries.matchAll(/'([^']+)'/g),m=>m[1]))
 const root='src/app/[locale]'
 function scan(dir) {
  for(const entry of readdirSync(dir,{withFileTypes:true})) {
   if(!entry.isDirectory())continue
   if(entry.name.startsWith('(')){scan(join(dir,entry.name));continue}
   if(entry.name.startsWith('[')||entry.name.startsWith('test-')||entry.name==='diagnostico')continue
   if(existsSync(join(dir,entry.name,'page.tsx'))) assert.ok(allowed.has(entry.name),`${entry.name} would return a production-only 404`)
  }
 }
 scan(root);assert.ok(allowed.has('pagos'))
})
test('trial checkout is protected server-side, not just by changing button text',()=>{
 const api=readFileSync('src/app/api/pagos/route.ts','utf8')
 assert.match(api,/TRIAL_ACTIVE/)
 const change=readFileSync('src/app/api/user/plan/cambio/route.ts','utf8')
 assert.match(change,/cambiar_plan_prueba/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPlanAction } from '../src/lib/plan-action.ts'

test('registration is shown only after determining there is no session', () => {
  for (const card of ['gratuita', 'profesional', 'agencia']) {
    assert.equal(getPlanAction(true, null, null, null, false, card), 'loading')
    assert.equal(getPlanAction(false, null, null, null, false, card), 'register')
    assert.equal(getPlanAction(false, 'user', null, null, false, card), 'loading')
    assert.equal(getPlanAction(false, 'user', 'previous-user', 'agencia', false, card), 'loading')
    assert.equal(getPlanAction(false, 'user', 'user', null, true, card), 'error')
  }
})
test('signed-in users see their current plan and request changes without registering', () => {
  for (const current of ['gratuita', 'profesional', 'agencia']) {
    for (const card of ['gratuita', 'profesional', 'agencia']) {
      assert.equal(getPlanAction(false, 'user', 'user', current, false, card), current === card ? 'current' : 'contact')
    }
  }
})

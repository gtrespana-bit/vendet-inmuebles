import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeChatMessages } from '../src/lib/chat-messages.ts'

test('keeps live messages that arrived during history fetch without duplicates or cross-chat leakage', () => {
  const message = (id, conversacion_id, creado_en) => ({ id, conversacion_id, creado_en })
  const a = message('a', 'one', '2026-01-01T00:00:01Z')
  const b = message('b', 'one', '2026-01-01T00:00:02Z')
  const other = message('c', 'two', '2026-01-01T00:00:03Z')
  assert.deepEqual(mergeChatMessages([a], [b, a, other], 'one'), [a, b])
})

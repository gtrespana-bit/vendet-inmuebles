const assert = require('node:assert/strict')
const fs = require('node:fs')

const source = fs.readFileSync('src/app/[locale]/inmueble/editar/[id]/page.tsx', 'utf8')
const typeKeys = [...source.matchAll(/(?:casa|apartamento|townhouse|terreno|'local-comercial'|oficina|galpon|habitacion|finca|edificio): '(type\w+)'/g)].map((m) => m[1])
assert.equal(typeKeys.length, 10, 'All seeded property types should have a translation mapping')

for (const locale of ['es', 'en']) {
  const messages = JSON.parse(fs.readFileSync(`src/i18n/dictionaries/${locale}.json`, 'utf8'))
  for (const [fn, namespace] of [['tp', 'publishProperty'], ['t', 'editListing']]) {
    const keys = [...source.matchAll(new RegExp(`\\b${fn}\\('([^']+)'\\)`, 'g'))].map((m) => m[1])
    for (const key of keys) {
      assert.equal(typeof messages[namespace][key], 'string', `${locale}: missing ${namespace}.${key}`)
      assert(!/{\w+}/.test(messages[namespace][key]), `${locale}: ${namespace}.${key} requires interpolation`)
    }
  }
  for (const key of [...typeKeys, 'conditionNew', 'conditionGood', 'conditionRenovate']) {
    assert.equal(typeof messages.publishProperty[key], 'string', `${locale}: missing publishProperty.${key}`)
  }
}
console.log('Edit listing translations: OK')

import test from 'node:test'
import assert from 'node:assert/strict'
import { criteriaList, httpUrl, projectPatch, textField } from '../src/validate.js'

test('textField trims and enforces required fields', () => {
  assert.equal(textField('  Alex Rivera ', 'Client name'), 'Alex Rivera')
  assert.throws(() => textField('   ', 'Project name'), /Project name is required/)
  assert.throws(() => textField(undefined, 'Project name'), /Project name is required/)
  assert.equal(textField(undefined, 'Client name', { required: false }), undefined)
  assert.equal(textField('  ', 'Client name', { required: false }), '')
})

test('textField rejects non-text and over-long values', () => {
  assert.throws(() => textField(42, 'Project name'), /must be text/)
  assert.throws(() => textField('x'.repeat(121), 'Project name', { max: 120 }), /120 characters or fewer/)
})

test('httpUrl accepts http(s) and rejects anything else', () => {
  assert.equal(httpUrl('https://example.com'), 'https://example.com')
  assert.equal(httpUrl(' http://localhost:3001/demo/ '), 'http://localhost:3001/demo/')
  assert.throws(() => httpUrl('example.com'), /full URL/)
  assert.throws(() => httpUrl('javascript:alert(1)'), /http:\/\/ or https:\/\//)
  assert.throws(() => httpUrl('ftp://example.com'), /http:\/\/ or https:\/\//)
})

test('criteriaList drops blanks and keeps order', () => {
  assert.deepEqual(criteriaList(['  Add an item to the cart ', '', '  ']), [
    'Add an item to the cart',
  ])
})

test('criteriaList rejects empty, oversized and non-array input', () => {
  assert.throws(() => criteriaList([]), /at least one/)
  assert.throws(() => criteriaList('add to cart'), /array/)
  assert.throws(() => criteriaList(['x'.repeat(501)]), /500 characters or fewer/)
  assert.throws(() => criteriaList(Array.from({ length: 9 }, (_, i) => `check ${i}`)), /at most 8/)
})

test('projectPatch only includes provided fields', () => {
  assert.deepEqual(projectPatch({ name: ' New name ' }), { name: 'New name' })
  assert.deepEqual(projectPatch({ clientName: '' }), { clientName: '' })
  assert.throws(() => projectPatch({}), /Nothing to update/)
})

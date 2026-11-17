import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyOutcome, parseNdjsonLine } from '../src/kane.js'

const base = { timeoutSec: 180, command: 'node' }

test('parseNdjsonLine ignores blank and non-JSON lines', () => {
  assert.equal(parseNdjsonLine(''), null)
  assert.equal(parseNdjsonLine('   '), null)
  assert.equal(parseNdjsonLine('Kane CLI 0.10.5'), null)
  assert.equal(parseNdjsonLine('[1,2,3]'), null)
  assert.equal(parseNdjsonLine('null'), null)
})

test('parseNdjsonLine keeps step events that have no type field', () => {
  const event = parseNdjsonLine('{"step":2,"status":"running","remark":"Clicked add to cart"}')
  assert.deepEqual(event, { step: 2, status: 'running', remark: 'Clicked add to cart' })
  assert.equal(event.type, undefined)
})

test('parseNdjsonLine reads run_end events', () => {
  const event = parseNdjsonLine('{"type":"run_end","status":"passed","summary":"ok"}')
  assert.equal(event.type, 'run_end')
  assert.equal(event.status, 'passed')
})

test('a passed run_end wins even if the exit code is odd', () => {
  const outcome = classifyOutcome({
    ...base,
    runEnd: { status: 'passed' },
    code: 0,
  })
  assert.equal(outcome.status, 'passed')
  assert.equal(outcome.errorMessage, null)
})

test('a failed run_end is a real failure, not an environment error', () => {
  const outcome = classifyOutcome({
    ...base,
    runEnd: { status: 'failed', reason: 'The button did nothing' },
    code: 1,
  })
  assert.equal(outcome.status, 'failed')
  assert.equal(outcome.errorMessage, null)
})

test('exit code 2 without run_end is reported as could-not-start', () => {
  const outcome = classifyOutcome({
    ...base,
    code: 2,
    hint: 'Chrome not found',
  })
  assert.equal(outcome.status, 'error')
  assert.match(outcome.errorMessage, /could not start/i)
  assert.match(outcome.errorMessage, /Chrome not found/)
})

test('exit code 2 falls back to actionable advice with no hint', () => {
  const outcome = classifyOutcome({ ...base, code: 2 })
  assert.equal(outcome.status, 'error')
  assert.match(outcome.errorMessage, /Google Chrome/)
  assert.match(outcome.errorMessage, /kane-cli login/)
})

test('exit code 3 is a timeout, not a failed assertion', () => {
  const outcome = classifyOutcome({ ...base, code: 3 })
  assert.equal(outcome.status, 'timeout')
  assert.match(outcome.errorMessage, /180s/)
})

test('a killed process is a timeout even when the exit code is null', () => {
  const outcome = classifyOutcome({ ...base, code: -1, hardKilled: true })
  assert.equal(outcome.status, 'timeout')
})

test('exit code 0 without run_end has no verdict to report', () => {
  const outcome = classifyOutcome({ ...base, code: 0 })
  assert.equal(outcome.status, 'error')
  assert.match(outcome.errorMessage, /no run_end/)
})

test('a spawn failure explains how to install the CLI', () => {
  const outcome = classifyOutcome({
    ...base,
    code: -1,
    spawnError: new Error('ENOENT'),
  })
  assert.equal(outcome.status, 'error')
  assert.match(outcome.errorMessage, /could not start \(node\)/)
  assert.match(outcome.errorMessage, /npm install -g @testmuai\/kane-cli/)
})

test('an unknown exit code surfaces the typed error message', () => {
  const outcome = classifyOutcome({
    ...base,
    code: 7,
    typedError: { message: 'Session expired' },
  })
  assert.equal(outcome.status, 'error')
  assert.match(outcome.errorMessage, /Session expired/)
})

test('an unknown exit code with no detail still reports the code', () => {
  const outcome = classifyOutcome({ ...base, code: 7 })
  assert.equal(outcome.status, 'error')
  assert.match(outcome.errorMessage, /code 7/)
})

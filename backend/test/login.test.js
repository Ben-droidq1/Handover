import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureKaneLogin } from '../src/login.js'

const fakeKane = { command: 'node', prefix: ['kane-cli.cjs'], mode: 'node' }

function fakeRunner(answers) {
  const calls = []
  const run = async (_kane, args) => {
    calls.push(args)
    const answer = args[0] === 'whoami' ? answers.whoami : answers.login
    return answer
  }
  return { run, calls }
}

test('does nothing when no credentials are configured', async () => {
  const { run, calls } = fakeRunner({})
  const result = await ensureKaneLogin({ username: '', accessKey: '', run, resolve: async () => fakeKane })

  assert.equal(result.attempted, false)
  assert.match(result.reason, /KANE_USERNAME/)
  assert.equal(calls.length, 0)
})

test('keeps an existing login instead of logging in again', async () => {
  const { run, calls } = fakeRunner({
    whoami: { code: 0, out: '✓ Authenticated\nUser benjaminmazi1738\n', err: '' },
  })
  const result = await ensureKaneLogin({
    username: 'someone@example.com',
    accessKey: 'secret-key',
    run,
    resolve: async () => fakeKane,
  })

  assert.equal(result.alreadyLoggedIn, true)
  assert.equal(result.ok, true)
  assert.deepEqual(calls, [['whoami']])
})

test('logs in with the non-interactive credentials when not authenticated', async () => {
  const { run, calls } = fakeRunner({
    whoami: { code: 0, out: '⚠ Not logged in\nToken missing\n', err: '' },
    login: { code: 0, out: 'Logged in as default [prod]\n', err: 'Skill update available: none\n' },
  })
  const result = await ensureKaneLogin({
    username: 'someone@example.com',
    accessKey: 'secret-key',
    run,
    resolve: async () => fakeKane,
  })

  assert.equal(result.attempted, true)
  assert.equal(result.ok, true)
  assert.deepEqual(calls[1], [
    'login',
    '--username',
    'someone@example.com',
    '--access-key',
    'secret-key',
  ])
})

test('a failed login returns Kane\'s message without the key', async () => {
  const { run } = fakeRunner({
    whoami: { code: 0, out: 'Not logged in', err: '' },
    login: {
      code: 1,
      out: '',
      err: 'Skill update available: not installed\nInvalid access key for someone@example.com\n',
    },
  })
  const result = await ensureKaneLogin({
    username: 'someone@example.com',
    accessKey: 'secret-key',
    run,
    resolve: async () => fakeKane,
  })

  assert.equal(result.ok, false)
  assert.match(result.reason, /Invalid access key/)
  assert.doesNotMatch(result.reason, /Skill update|secret-key/)
})

test('a broken Kane install is reported, not thrown', async () => {
  const result = await ensureKaneLogin({
    username: 'someone@example.com',
    accessKey: 'secret-key',
    run: async () => ({ code: null, out: '', err: '' }),
    resolve: async () => {
      throw new Error('kane-cli not found')
    },
  })

  assert.equal(result.ok, false)
  assert.match(result.reason, /kane-cli not found/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { collectEvidence, readZipEntries, readZipEntry } from '../src/evidence.js'
import { FAKE_PNG, buildZip } from './zip-fixture.js'

const STEP = 'tests/test-abc/steps'

function samplePack(overrides = {}) {
  return buildZip([
    { name: 'run.yaml', data: 'status: passed\n' },
    { name: 'manifest.json', data: '{"steps":3}' },
    { name: `${STEP}/1-open/screenshot.png`, data: FAKE_PNG },
    { name: `${STEP}/1-open/dom.html`, data: '<html></html>' },
    { name: `${STEP}/10-verify/screenshot.png`, data: Buffer.from('last-step') },
    { name: `${STEP}/2-click/screenshot.png`, data: Buffer.from('middle-step') },
    { name: 'notes.txt', data: 'plain text', store: true },
    ...(overrides.extra ?? []),
  ])
}

async function tempDirs() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'handover-zip-'))
  return {
    root,
    evidenceDir: path.join(root, 'evidence'),
    shotsDir: path.join(root, 'shots'),
  }
}

test('readZipEntries lists every entry name', () => {
  const entries = readZipEntries(samplePack())
  assert.deepEqual(
    entries.map((entry) => entry.name),
    [
      'run.yaml',
      'manifest.json',
      `${STEP}/1-open/screenshot.png`,
      `${STEP}/1-open/dom.html`,
      `${STEP}/10-verify/screenshot.png`,
      `${STEP}/2-click/screenshot.png`,
      'notes.txt',
    ],
  )
})

test('readZipEntry reads deflated entries', () => {
  const buffer = samplePack()
  const entry = readZipEntries(buffer).find((item) => item.name === 'run.yaml')
  assert.equal(entry.method, 8)
  assert.equal(readZipEntry(buffer, entry).toString('utf8'), 'status: passed\n')
})

test('readZipEntry reads stored (uncompressed) entries', () => {
  const buffer = samplePack()
  const entry = readZipEntries(buffer).find((item) => item.name === 'notes.txt')
  assert.equal(entry.method, 0)
  assert.equal(readZipEntry(buffer, entry).toString('utf8'), 'plain text')
})

test('readZipEntries rejects buffers that are not zips', () => {
  assert.throws(() => readZipEntries(Buffer.from('this is not a zip file at all')), /Not a zip/)
})

test('collectEvidence keeps the pack and extracts the last step screenshot', async () => {
  const dirs = await tempDirs()
  const packPath = path.join(dirs.root, 'session.evidence')
  await fs.writeFile(packPath, samplePack())

  const result = await collectEvidence({
    evidenceFile: packPath,
    resultId: 'res_test',
    evidenceDir: dirs.evidenceDir,
    shotsDir: dirs.shotsDir,
  })

  assert.equal(result.stepsFound, 3)
  assert.equal(result.screenshotPath, 'res_test.png')

  const shot = await fs.readFile(path.join(dirs.shotsDir, 'res_test.png'))
  assert.equal(shot.toString('utf8'), 'last-step', 'step 10 sorts after step 2 numerically')

  const kept = await fs.readFile(path.join(dirs.evidenceDir, 'res_test.evidence'))
  assert.ok(kept.length > 0, 'the sealed pack is copied into our data dir')

  await fs.rm(dirs.root, { recursive: true, force: true })
})

test('collectEvidence extracts the last jpg screenshot used by kane-cli 0.10.6', async () => {
  const dirs = await tempDirs()
  const packPath = path.join(dirs.root, 'session.evidence')
  await fs.writeFile(
    packPath,
    buildZip([
      { name: 'run.yaml', data: 'status: failed\n' },
      { name: 'tests/open-billing/steps/1-0-1/screenshot.jpg', data: Buffer.from('first-jpg') },
      { name: 'tests/open-billing/steps/2-0-2/screenshot.jpg', data: Buffer.from('last-jpg') },
      { name: 'tests/open-billing/steps/2-0-2/annotated.png', data: Buffer.from('annotation') },
    ]),
  )

  const result = await collectEvidence({
    evidenceFile: packPath,
    resultId: 'res_jpg',
    evidenceDir: dirs.evidenceDir,
    shotsDir: dirs.shotsDir,
  })

  assert.equal(result.stepsFound, 2)
  assert.equal(result.screenshotPath, 'res_jpg.jpg')
  const shot = await fs.readFile(path.join(dirs.shotsDir, 'res_jpg.jpg'))
  assert.equal(shot.toString('utf8'), 'last-jpg')

  await fs.rm(dirs.root, { recursive: true, force: true })
})

test('collectEvidence handles a pack with no step screenshots', async () => {
  const dirs = await tempDirs()
  const packPath = path.join(dirs.root, 'empty.evidence')
  await fs.writeFile(packPath, buildZip([{ name: 'run.yaml', data: 'status: passed\n' }]))

  const result = await collectEvidence({
    evidenceFile: packPath,
    resultId: 'res_empty',
    evidenceDir: dirs.evidenceDir,
    shotsDir: dirs.shotsDir,
  })

  assert.equal(result.stepsFound, 0)
  assert.equal(result.screenshotPath, null)
  assert.ok(result.evidencePath, 'the pack is still archived as evidence')

  await fs.rm(dirs.root, { recursive: true, force: true })
})

test('collectEvidence survives a corrupt pack', async () => {
  const dirs = await tempDirs()
  const packPath = path.join(dirs.root, 'broken.evidence')
  await fs.writeFile(packPath, Buffer.from('definitely not a zip'))

  const result = await collectEvidence({
    evidenceFile: packPath,
    resultId: 'res_broken',
    evidenceDir: dirs.evidenceDir,
    shotsDir: dirs.shotsDir,
  })

  assert.equal(result.screenshotPath, null)
  assert.match(result.error, /Not a zip/)

  await fs.rm(dirs.root, { recursive: true, force: true })
})

test('collectEvidence is a no-op without an evidence file', async () => {
  const dirs = await tempDirs()
  const result = await collectEvidence({
    evidenceFile: null,
    resultId: 'res_none',
    evidenceDir: dirs.evidenceDir,
    shotsDir: dirs.shotsDir,
  })
  assert.deepEqual(result, { evidencePath: null, screenshotPath: null, stepsFound: 0 })
  await fs.rm(dirs.root, { recursive: true, force: true })
})

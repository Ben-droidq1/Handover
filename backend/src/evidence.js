import fs from 'node:fs/promises'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'

/**
 * Minimal, dependency-free reader for the `.evidence` pack.
 *
 * A pack is a plain zip whose entries are flat (`run.yaml` at the root, no
 * wrapping folder). Screenshots live at
 *   tests/<test-id>/steps/<ordinal>-<step-id>/screenshot.png
 * We only need the last step's screenshot for the report, so the reader pulls
 * specific entries instead of extracting everything.
 */

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

function findEndOfCentralDirectory(buffer) {
  const earliest = Math.max(0, buffer.length - 66_000)
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD) return offset
  }
  return -1
}

export function readZipEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer)
  if (eocd === -1) throw new Error('Not a zip file: end of central directory not found')

  const count = buffer.readUInt16LE(eocd + 10)
  const directoryOffset = buffer.readUInt32LE(eocd + 16)
  if (directoryOffset === 0xffffffff) throw new Error('ZIP64 packs are not supported')

  const entries = []
  let pointer = directoryOffset

  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(pointer) !== CENTRAL) throw new Error('Corrupt zip: bad central directory entry')

    const flags = buffer.readUInt16LE(pointer + 8)
    const method = buffer.readUInt16LE(pointer + 10)
    const compressedSize = buffer.readUInt32LE(pointer + 20)
    const uncompressedSize = buffer.readUInt32LE(pointer + 24)
    const nameLength = buffer.readUInt16LE(pointer + 28)
    const extraLength = buffer.readUInt16LE(pointer + 30)
    const commentLength = buffer.readUInt16LE(pointer + 32)
    const localOffset = buffer.readUInt32LE(pointer + 42)

    const name = buffer
      .subarray(pointer + 46, pointer + 46 + nameLength)
      .toString(flags & 0x800 ? 'utf8' : 'latin1')

    entries.push({ name, method, compressedSize, uncompressedSize, localOffset })
    pointer += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

export function readZipEntry(buffer, entry) {
  const local = entry.localOffset
  if (buffer.readUInt32LE(local) !== LOCAL) throw new Error('Corrupt zip: bad local header')

  const nameLength = buffer.readUInt16LE(local + 26)
  const extraLength = buffer.readUInt16LE(local + 28)
  const start = local + 30 + nameLength + extraLength
  const data = buffer.subarray(start, start + entry.compressedSize)

  if (entry.method === 0) return Buffer.from(data)
  if (entry.method === 8) return inflateRawSync(data)
  throw new Error(`Unsupported zip compression method ${entry.method}`)
}

function stepOrdinal(name) {
  const match = name.match(/\/steps\/(\d+)-/)
  return match ? Number(match[1]) : 0
}

/**
 * Copies the sealed pack next to our own data (Kane prunes session folders),
 * then extracts the last step's screenshot.
 *
 * @returns {{evidencePath: string|null, screenshotPath: string|null, stepsFound: number}}
 */
export async function collectEvidence({ evidenceFile, resultId, evidenceDir, shotsDir }) {
  if (!evidenceFile) return { evidencePath: null, screenshotPath: null, stepsFound: 0 }

  let buffer
  try {
    buffer = await fs.readFile(evidenceFile)
  } catch {
    return { evidencePath: null, screenshotPath: null, stepsFound: 0 }
  }

  await fs.mkdir(evidenceDir, { recursive: true })
  const keptPath = path.join(evidenceDir, `${resultId}.evidence`)

  let screenshotPath = null
  let stepsFound = 0
  try {
    const entries = readZipEntries(buffer)
    const shots = entries
      .filter((entry) => /^tests\/[^/]+\/steps\/[^/]+\/screenshot\.png$/.test(entry.name))
      .sort((a, b) => stepOrdinal(a.name) - stepOrdinal(b.name))

    stepsFound = shots.length

    if (shots.length) {
      const last = shots[shots.length - 1]
      const png = readZipEntry(buffer, last)
      await fs.mkdir(shotsDir, { recursive: true })
      const fileName = `${resultId}.png`
      await fs.writeFile(path.join(shotsDir, fileName), png)
      screenshotPath = fileName
    }

    await fs.writeFile(keptPath, buffer)

    return { evidencePath: keptPath, screenshotPath, stepsFound }
  } catch (error) {
    // The pack is still worth keeping even if we cannot parse it.
    try {
      await fs.writeFile(keptPath, buffer)
    } catch {
      /* ignore */
    }
    return {
      evidencePath: keptPath,
      screenshotPath: null,
      stepsFound,
      error: error.message,
    }
  }
}

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const backendRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

const dataDir = path.resolve(backendRoot, process.env.DATA_DIR || 'data')

export const config = {
  port: Number(process.env.PORT || 3001),
  ownerPassword: process.env.OWNER_PASSWORD || '',
  maxConcurrency: Math.max(1, Number(process.env.MAX_CONCURRENCY || 3)),
  maxCriteria: Math.max(1, Number(process.env.MAX_CRITERIA || 8)),
  kaneTimeoutSec: Math.max(30, Number(process.env.KANE_TIMEOUT_SEC || 180)),
  kaneMaxSteps: Math.max(5, Number(process.env.KANE_MAX_STEPS || 20)),
  kaneBin: process.env.KANE_BIN || '',
  frontendDist: path.resolve(backendRoot, '../frontend/dist'),
  demoDir: path.resolve(backendRoot, 'demo-site'),
}

export const paths = {
  data: dataDir,
  db: path.join(dataDir, 'handover.db'),
  evidence: path.join(dataDir, 'evidence'),
  shots: path.join(dataDir, 'shots'),
  logs: path.join(dataDir, 'logs'),
  work: path.join(dataDir, 'kane-work'),
}

export function ensureDataDirs() {
  for (const dir of [paths.data, paths.evidence, paths.shots, paths.logs, paths.work]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

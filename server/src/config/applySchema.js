import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'

export async function applyBaseSchema() {
  const sqlPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    'schema.sql',
  )
  const raw = fs.readFileSync(sqlPath, 'utf8')
  const statements = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(
      (statement) =>
        statement &&
        !/^CREATE DATABASE/i.test(statement) &&
        !/^USE\s/i.test(statement),
    )

  const pool = getPool()
  for (const statement of statements) {
    await pool.query(statement)
  }
}

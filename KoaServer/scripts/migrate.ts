import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { RowDataPacket } from 'mysql2/promise'
import db from '../src/db'
import { projectRoot } from '../src/utils/paths'

type MigrationRow = RowDataPacket & { filename: string; checksum: string }

function statements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map(value => value.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean)
}

async function main(): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS vueshop_schema_migration (
    filename VARCHAR(255) NOT NULL PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  const directory = path.join(projectRoot, 'sql')
  const files = (await readdir(directory)).filter(name => /^\d{3}_.+\.sql$/.test(name)).sort()
  const [applied] = await db.execute<MigrationRow[]>('SELECT filename, checksum FROM vueshop_schema_migration')
  const checksums = new Map(applied.map(item => [item.filename, item.checksum]))
  const baselineArg = process.argv.find(value => value.startsWith('--baseline='))
  const baseline = baselineArg ? Number(baselineArg.slice('--baseline='.length)) : null
  if (baseline !== null && (!Number.isInteger(baseline) || baseline < 0)) {
    throw new Error('--baseline 必须是迁移编号，例如 --baseline=015')
  }

  for (const filename of files) {
    const sql = await readFile(path.join(directory, filename), 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    const previous = checksums.get(filename)
    if (previous) {
      if (previous !== checksum) throw new Error(`已执行的迁移被修改：${filename}`)
      console.log(`跳过 ${filename}`)
      continue
    }
    const migrationNumber = Number(filename.slice(0, 3))
    if (baseline !== null && migrationNumber <= baseline) {
      await db.execute(
        'INSERT INTO vueshop_schema_migration (filename, checksum) VALUES (?, ?)',
        [filename, checksum]
      )
      console.log(`基线标记 ${filename}`)
      continue
    }
    console.log(`执行 ${filename}`)
    for (const statement of statements(sql)) await db.query(statement)
    await db.execute(
      'INSERT INTO vueshop_schema_migration (filename, checksum) VALUES (?, ?)',
      [filename, checksum]
    )
  }
}

main().catch(error => {
  console.error('数据库迁移失败：', error instanceof Error ? error.message : error)
  process.exitCode = 1
}).finally(() => db.end())

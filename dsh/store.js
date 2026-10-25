/**
 * 数据层入口（小肢宝 M5 · slice 1）：开库、迁移、更正链、关库。
 * 零运行时依赖，只用内置 node:sqlite。
 *
 * 三条边界（家族一致）：
 * 1. 路径由调用方给：不猜资料目录在哪，也不替用户建目录；
 * 2. 迁移只增不改：按文件名顺序执行 schema/00*.sql，执行过就跳过（幂等）；
 *    schema/0001_initial.sql 已冻结（schema/freeze-contract.md），结构变更只能新增 000N；
 * 3. 错误要能诊断：开库/迁移/关库各自抛带 code 的异常，调用方翻译成人话。
 *
 * 更正链（ACM 特有）：metric_point 等事实表带 in_use / revision 两列。
 * 更正一条记录 = 旧行 in_use 置 0 + 插入 revision+1 的新行，不原地 UPDATE 数值——
 * 这样任何一次"改数字"都能从库里回放出来（谁在什么时候把什么改成了什么）。
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SCHEMA_DIR = fileURLToPath(new URL('../schema/', import.meta.url))

const MIGRATION_RE = /^(\d{4})_[a-z0-9_]+\.sql$/

/* ---------------- 异常 ---------------- */

/** 数据层的可诊断异常：code 给调用方分支用，message 是可直接显示的人话。 */
export class StoreError extends Error {
  constructor(code, message, options = {}) {
    super(message)
    this.name = new.target.name
    this.code = code
    if (options.cause) this.cause = options.cause
  }
}

export class OpenDatabaseError extends StoreError {}
export class MigrationError extends StoreError {}
export class CloseDatabaseError extends StoreError {}
export class CorrectionError extends StoreError {}

/* ---------------- 迁移文件 ---------------- */

/** 按编号排序的迁移文件列表。文件名不符合 NNNN_name.sql 的不猜，直接报错。 */
export function migrationFiles(dir = SCHEMA_DIR) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch (error) {
    throw new MigrationError('SCHEMA_DIR_MISSING', `读不到迁移目录：${dir}`, { cause: error })
  }
  const files = entries.filter((f) => f.endsWith('.sql'))
  const unknown = files.filter((f) => !MIGRATION_RE.test(f))
  if (unknown.length) {
    throw new MigrationError('SCHEMA_NAME_INVALID', `schema/ 里有不符合 NNNN_name.sql 的文件：${unknown.join(', ')}`)
  }
  return files.sort((a, b) => Number(a.slice(0, 4)) - Number(b.slice(0, 4)))
}

/* ---------------- 开 / 关 ---------------- */

/** 打开本机库。`:memory:` 用于测试；真实文件由调用方传入用户选定的资料目录下的路径。 */
export function openDatabase(path = ':memory:') {
  if (typeof path !== 'string' || !path.trim()) {
    throw new OpenDatabaseError('EMPTY_DB_PATH', '缺少数据库路径：资料目录必须来自你的选择，不在这里猜')
  }
  let db
  try {
    db = new DatabaseSync(path)
  } catch (error) {
    throw new OpenDatabaseError('OPEN_FAILED', `打不开数据库：${path}`, { cause: error })
  }
  try {
    db.exec('PRAGMA foreign_keys = ON')
  } catch (error) {
    throw new OpenDatabaseError('PRAGMA_FAILED', '打开数据库后没能开启外键约束，库不会被使用', { cause: error })
  }
  return db
}

/** 关库。失败也要抛：静默吞掉等于让人以为数据已经落盘。 */
export function close(db) {
  if (!db) return
  try {
    db.close()
  } catch (error) {
    throw new CloseDatabaseError('CLOSE_FAILED', '关闭数据库时出错，请检查是否还有未完成的写入', { cause: error })
  }
}

/* ---------------- 迁移 ---------------- */

/**
 * 执行未应用的迁移。已在 schema_migrations 里的版本跳过（幂等）。
 * 每个文件在一个事务里跑完：跑一半失败会整体回滚，不会留下"半套表"。
 */
export function migrate(db, { dir = SCHEMA_DIR, now = () => new Date().toISOString() } = {}) {
  if (!db || typeof db.exec !== 'function') {
    throw new MigrationError('NO_DATABASE', '迁移需要一个已打开的数据库')
  }

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT
    )`)
  } catch (error) {
    throw new MigrationError('LEDGER_FAILED', '建不了迁移台账 schema_migrations，后续迁移无法记录', { cause: error })
  }

  let applied
  try {
    applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version))
  } catch (error) {
    throw new MigrationError('LEDGER_READ_FAILED', '读不到已执行的迁移记录', { cause: error })
  }

  const executed = []
  for (const file of migrationFiles(dir)) {
    const version = file.slice(0, 4)
    if (applied.has(version)) continue

    let sql
    try {
      sql = readFileSync(join(dir, file), 'utf8')
    } catch (error) {
      throw new MigrationError('SCHEMA_READ_FAILED', `读不到迁移文件：schema/${file}`, { cause: error })
    }

    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now())
      db.exec('COMMIT')
    } catch (error) {
      try {
        db.exec('ROLLBACK')
      } catch (rollbackError) {
        throw new MigrationError('ROLLBACK_FAILED', `schema/${file} 执行失败且回滚也失败：${error.message}`, { cause: rollbackError })
      }
      throw new MigrationError('MIGRATE_FAILED', `schema/${file} 执行失败：${error.message}`, { cause: error })
    }
    executed.push(file)
  }

  return {
    executed,
    applied: db.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all(),
  }
}

/* ---------------- 更正链（revision） ---------------- */

/**
 * 更正一条 metric_point：旧行 in_use=0，插入 revision+1 的新行。
 * patch 里只允许改数值类字段（value_num/value_text/unit/ref_range_text/source_note/specimen_kind），
 * 不许改 profile_id/code/measured_at（那不是更正，是另一条记录）。
 *
 * 返回新行 id。旧行保留：读模型按 in_use=1 过滤，历史能回放。
 */
export function correctMetricPoint(db, id, patch = {}, { now = null } = {}) {
  if (!db || typeof db.prepare !== 'function') throw new CorrectionError('NO_DATABASE', '更正需要一个已打开的数据库')
  const old = db.prepare('SELECT * FROM metric_point WHERE id = ?').get(id)
  if (!old) throw new CorrectionError('NOT_FOUND', `没有这条指标记录：id=${id}`)
  if (!old.in_use) throw new CorrectionError('SUPERSEDED', `id=${id} 已被更正过（revision ${old.revision} 已失效），只能更正现行记录`)

  const allowed = ['value_num', 'value_text', 'unit', 'ref_range_text', 'source_note', 'specimen_kind', 'author_role']
  const dirty = Object.keys(patch).filter((k) => patch[k] !== undefined)
  const illegal = dirty.filter((k) => !allowed.includes(k))
  if (illegal.length) throw new CorrectionError('IMMUTABLE_FIELD', `这些字段不能更正（要改就另记一条）：${illegal.join(', ')}`)

  const next = { ...old, ...Object.fromEntries(dirty.map((k) => [k, patch[k]])) }
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE metric_point SET in_use = 0 WHERE id = ?').run(id)
    const r = db.prepare(`INSERT INTO metric_point
      (profile_id, code, measured_at, value_num, value_text, unit, ref_range_text, specimen_kind, source_note, author_role, in_use, revision)
      VALUES (?,?,?,?,?,?,?,?,?, ?, 1, ?)`)
      .run(next.profile_id, next.code, next.measured_at, next.value_num ?? null, next.value_text ?? null,
        next.unit ?? null, next.ref_range_text ?? null, next.specimen_kind ?? null, next.source_note ?? null,
        next.author_role ?? null, old.revision + 1)
    db.exec('COMMIT')
    return { id: Number(r.lastInsertRowid), revision: old.revision + 1, supersededId: id }
  } catch (error) {
    try { db.exec('ROLLBACK') } catch { /* 原始错误优先 */ }
    throw new CorrectionError('CORRECT_FAILED', `更正失败（已回滚）：${error.message}`, { cause: error })
  }
}

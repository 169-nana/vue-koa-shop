import db from '../src/db'

const tables = [
  'vueshop_agent_conversation',
  'vueshop_agent_action',
  'vueshop_order',
  'vueshop_order_item',
  'vueshop_order_refund'
] as const

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  for (const table of tables) {
    const backup = `${table}_backup_${stamp}`
    await db.query(`CREATE TABLE \`${backup}\` LIKE \`${table}\``)
    await db.query(`INSERT INTO \`${backup}\` SELECT * FROM \`${table}\``)
    console.log(`${table} -> ${backup}`)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}).finally(() => db.end())

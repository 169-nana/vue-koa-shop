import type { RowDataPacket } from 'mysql2/promise'
import db from '../src/db'

type NameRow = RowDataPacket & { table_name: string }
type ColumnRow = RowDataPacket & { table_name: string; column_name: string }

async function main(): Promise<void> {
  const [tables] = await db.execute<NameRow[]>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name LIKE 'vueshop_%' ORDER BY table_name`)
  const [columns] = await db.execute<ColumnRow[]>(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = DATABASE() AND (
      (table_name = 'vueshop_admin' AND column_name IN ('role', 'status')) OR
      (table_name = 'vueshop_cart' AND column_name IN ('selected_spec', 'address_id')) OR
      (table_name = 'vueshop_goods' AND column_name IN ('merchant_id', 'compliance_status', 'governance_version')) OR
      (table_name = 'vueshop_order' AND column_name = 'payment_expires_at') OR
      (table_name = 'vueshop_order_refund' AND column_name IN ('application_key', 'request_type')) OR
      (table_name = 'vueshop_agent_chat_message' AND column_name = 'conversation_id') OR
      (table_name = 'vueshop_agent_conversation' AND column_name = 'revision') OR
      (table_name = 'vueshop_agent_action' AND column_name IN ('conversation_id', 'request_id', 'title', 'description'))
    ) ORDER BY table_name, column_name`)
  console.log(JSON.stringify({ tables, columns }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}).finally(() => db.end())

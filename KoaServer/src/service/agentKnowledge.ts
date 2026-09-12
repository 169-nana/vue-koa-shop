import type { RowDataPacket } from 'mysql2/promise'

import db from '../db'

export interface AgentKnowledgeItem {
  title: string
  category: string
  content: string
}

type AgentKnowledgeRow = RowDataPacket & AgentKnowledgeItem

const FALLBACK_KNOWLEDGE: AgentKnowledgeItem[] = [
  {
    category: 'delivery',
    title: '配送与运费',
    content: '具体配送范围、运费和预计送达时间以订单结算页显示为准。下单后可在订单详情查看物流信息。'
  },
  {
    category: 'after_sale',
    title: '七天无理由退货',
    content: '是否支持七天无理由退货以商品详情和实际售后规则为准。定制、易耗或影响二次销售的商品可能不适用。'
  },
  {
    category: 'refund',
    title: '退款到账',
    content: '退款审核通过后将原路退回，实际到账时间由支付渠道决定。顾客可在售后页面查看最新进度。'
  },
  {
    category: 'coupon',
    title: '优惠券使用',
    content: '优惠券的适用商品、最低消费、有效期和叠加规则以优惠券页面及结算页显示为准。'
  }
]

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, '')
}

export function searchFallbackKnowledge(query: string): AgentKnowledgeItem[] {
  const normalized = normalize(query)
  const aliases: Record<string, string[]> = {
    delivery: ['配送', '物流', '运费', '送达', '发货'],
    after_sale: ['退货', '换货', '七天', '售后'],
    refund: ['退款', '到账', '退钱'],
    coupon: ['优惠券', '优惠', '折扣', '满减']
  }

  const matched = FALLBACK_KNOWLEDGE.filter(item =>
    normalize(`${item.title}${item.content}`).includes(normalized) ||
    aliases[item.category]?.some(keyword => normalized.includes(keyword))
  )

  return (matched.length > 0 ? matched : FALLBACK_KNOWLEDGE).slice(0, 3)
}

export async function searchAgentKnowledge(
  query: string
): Promise<AgentKnowledgeItem[]> {
  const keyword = `%${query}%`

  try {
    const [rows] = await db.execute<AgentKnowledgeRow[]>(
      `
        SELECT title, category, content
        FROM vueshop_agent_knowledge
        WHERE enabled = 1
          AND (valid_from IS NULL OR valid_from <= NOW())
          AND (valid_until IS NULL OR valid_until > NOW())
          AND (title LIKE ? OR keywords LIKE ? OR content LIKE ?)
        ORDER BY sort_order ASC, id ASC
        LIMIT 5
      `,
      [keyword, keyword, keyword]
    )

    return rows.length > 0 ? rows : searchFallbackKnowledge(query)
  } catch (error: unknown) {
    console.warn(
      'Agent knowledge table unavailable, using fallback:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return searchFallbackKnowledge(query)
  }
}

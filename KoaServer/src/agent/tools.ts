import type {
  ChatCompletionTool
} from 'openai/resources/chat/completions'

//定义模型能够看到的工具说明
export const SHOP_AGENT_TOOLS:
  ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'search_products',
        description:
          '根据关键词、分类和价格范围查询当前可售商品。进行商品推荐或比较前应调用此工具。',
        parameters: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description:
                '商品关键词，例如耳机、手机或连衣裙'
            },
            category_id: {
              type: 'integer',
              description:
                '商城分类ID，不确定时省略'
            },
            min_price: {
              type: 'number',
              minimum: 0,
              description: '最低价格'
            },
            max_price: {
              type: 'number',
              minimum: 0,
              description: '最高价格'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 8,
              description:
                '最多返回多少件商品，默认5件'
            }
          },
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_personalized_recommendations',
        description: '根据当前登录用户的购物车和历史订单品类推荐可售商品。用户要求“适合我”或个性化推荐时调用。',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 8, description: '推荐数量，默认5件' }
          },
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'compare_products',
        description: '查询2到4件可售商品的准确价格、库存、规格和描述，用于逐项比较。',
        parameters: {
          type: 'object',
          properties: {
            product_ids: {
              type: 'array',
              items: { type: 'integer' },
              minItems: 2,
              maxItems: 4,
              description: '需要比较的商品ID列表'
            }
          },
          required: ['product_ids'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_my_cart',
        description: '查询当前登录用户的购物车内容。未登录时会要求用户登录。',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'prepare_add_to_cart',
        description: '仅当用户明确要求加购时，准备一份待用户点击确认的加购操作。本工具不会直接修改购物车。',
        parameters: {
          type: 'object',
          properties: {
            product_id: { type: 'integer', description: '商品ID' },
            quantity: { type: 'integer', minimum: 1, maximum: 99, description: '加购数量' },
            selected_spec: { type: 'string', description: '用户明确选择的商品规格；只有一个规格时可省略' }
          },
          required: ['product_id', 'quantity'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_shop_knowledge',
        description: '查询商城配送、退换货、退款、优惠券、支付和售后规则。回答商城政策问题前应调用此工具。',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '顾客要了解的规则，例如运费、七天无理由或退款到账时间'
            }
          },
          required: ['query'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_product_detail',
        description: '根据商品ID查询当前可售商品的准确详情。',
        parameters: {
          type: 'object',
          properties: { product_id: { type: 'integer', description: '商品ID' } },
          required: ['product_id'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_my_orders',
        description: '查询当前登录用户自己的订单，可按订单状态筛选。',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'paid', 'cancelled', 'shipped', 'completed'],
              description: '订单状态，可省略'
            }
          },
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_my_order_detail',
        description: '根据订单ID查询当前登录用户自己的订单详情。',
        parameters: {
          type: 'object',
          properties: { order_id: { type: 'integer', description: '订单ID' } },
          required: ['order_id'],
          additionalProperties: false
        }
      }
    }
  ]

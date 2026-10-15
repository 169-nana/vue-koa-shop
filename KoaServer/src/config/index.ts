import { projectRoot } from '../utils/paths'
import type { SignOptions } from 'jsonwebtoken'
import path from 'path'
import dotenv from 'dotenv'

//无论从哪个目录执行 node，都能找到 KoaServer/.env
dotenv.config({
  // 无论从哪个目录执行 node，都能找到 KoaServer/.env
  path: path.join(projectRoot, '.env')
})

//
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('请在 KoaServer/.env 中配置 JWT_SECRET')
const isProduction = process.env.NODE_ENV === 'production'
if (isProduction && !process.env.PAYMENT_CALLBACK_SECRET) {
  throw new Error('生产环境必须配置 PAYMENT_CALLBACK_SECRET')
}
const paymentCallbackSecret = process.env.PAYMENT_CALLBACK_SECRET || jwtSecret
export default {
  // 端口号配置
  port: Number(process.env.PORT) || 8360,

  jwtSecret,
  paymentCallbackSecret,
  isProduction,
  // 环境变量的时长格式仍由 jsonwebtoken 校验，保持既有解析规则。
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '2h') as NonNullable<SignOptions['expiresIn']>,

  //agent配置
  deepseek: {
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL:
    process.env.DEEPSEEK_BASE_URL ||
    'https://api.deepseek.com',
  model:
    process.env.DEEPSEEK_MODEL ||
    'deepseek-v4-flash'
  },
  // 数据库配置
  database: {
    host: process.env.DB_HOST,
    //环境变量本质上都是字符串，所以端口需要转换
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }
}

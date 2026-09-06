import { projectRoot } from '../utils/paths'
import type { SignOptions } from 'jsonwebtoken'
import path from 'path'
import dotenv from 'dotenv'

//无论从哪个目录执行 node，都能找到 KoaServer/.env
dotenv.config({
  // 无论从哪个目录执行 node，都能找到 KoaServer/.env
  path: path.join(projectRoot, '.env')
})

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('请在 KoaServer/.env 中配置 JWT_SECRET')
export default {
  // 端口号配置
  port: Number(process.env.PORT) || 8360,

  jwtSecret,
  // 环境变量的时长格式仍由 jsonwebtoken 校验，保持既有解析规则。
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '2h') as NonNullable<SignOptions['expiresIn']>,

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

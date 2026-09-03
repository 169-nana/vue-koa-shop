const path = require('path')
const dotenv = require('dotenv')

//无论从哪个目录执行 node，都能找到 KoaServer/.env
require('dotenv').config({
  // 无论从哪个目录执行 node，都能找到 KoaServer/.env
  path: path.resolve(__dirname, '../../.env')
})

module.exports = {
  // 端口号配置
  port: Number(process.env.PORT) || 8360,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',

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
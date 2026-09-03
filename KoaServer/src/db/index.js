const mysql = require('mysql2/promise')
const config = require('../config/index.js')

//创建数据库连接池
const pool = mysql.createPool({
  ...config.database,

  // 等待可用连接，而不是立刻报错
  waitForConnections: true,

  // 最多同时保留10个连接
  connectionLimit: 10,

  // 等待队列不限制长度
  queueLimit: 0,

  // 保证中文和 emoji 正常存储
  charset: 'utf8mb4'
})

module.exports = pool
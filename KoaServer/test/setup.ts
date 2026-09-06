// 必须在加载应用配置之前执行；测试不会使用真实的登录密钥。
export const TEST_SECRET = 'typescript-migration-test-secret'
process.env.JWT_SECRET = TEST_SECRET
process.env.JWT_EXPIRES_IN = '2h'

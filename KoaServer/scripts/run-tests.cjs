const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const project = path.resolve(__dirname, '..')
const output = path.join(project, '.test-dist')
if (path.dirname(output) !== project) throw new Error('测试输出目录异常')
fs.rmSync(output, { recursive: true, force: true })

const tsc = require.resolve('typescript/bin/tsc')
const compile = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.test.json', '--noEmit', 'false', '--outDir', output], {
  cwd: project,
  stdio: 'inherit'
})
if (compile.status !== 0) {
  process.exitCode = compile.status ?? 1
} else {
  const pattern = path.join(output, 'KoaServer', 'test', '*.test.js').replaceAll('\\', '/')
  const tests = spawnSync(process.execPath, ['--test', pattern], { cwd: project, stdio: 'inherit' })
  process.exitCode = tests.status ?? 1
}

fs.rmSync(output, { recursive: true, force: true })

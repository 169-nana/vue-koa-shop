const path = require('node:path')
const { spawn } = require('node:child_process')

const preload = path.join(__dirname, 'node-user-info-workaround.cjs')
const existingOptions = process.env.NODE_OPTIONS || ''
const nodeOptions = `${existingOptions} --require ${JSON.stringify(preload)}`.trim()
const child = spawn(
  process.execPath,
  [require.resolve('tsx/cli'), ...process.argv.slice(2)],
  { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: nodeOptions } }
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})

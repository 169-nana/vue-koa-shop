import path from 'node:path'
import fs from 'node:fs'
// 同时支持 src 开发运行和 dist/KoaServer 编译产物，资源始终位于项目根目录。
function findProjectRoot(): string {
  let directory = __dirname
  while (true) {
    const manifest = path.join(directory, 'package.json')
    if (fs.existsSync(manifest)) {
      const metadata: unknown = JSON.parse(fs.readFileSync(manifest, 'utf8'))
      if (typeof metadata === 'object' && metadata !== null && 'name' in metadata && metadata.name === 'KoaServer') return directory
    }
    const parent = path.dirname(directory)
    if (parent === directory) throw new Error('找不到 KoaServer 项目目录')
    directory = parent
  }
}
export const projectRoot = findProjectRoot()

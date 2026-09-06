/** 上传组件的文件对象只在已获得服务器路径后才能提交。 */
export interface UploadedImage {
  serverPath?: string
  url?: string
  response?: unknown
}

export function getAlbumPaths(files: readonly UploadedImage[]): string[] {
  return files.flatMap(file => {
    if (file.serverPath) return [file.serverPath]
    const response = file.response
    if (typeof response === 'object' && response !== null &&
      'errno' in response && response.errno === 0 && 'data' in response) {
      const data = response.data
      if (typeof data === 'object' && data !== null && 'savepath' in data &&
        typeof data.savepath === 'string' && data.savepath) return [data.savepath]
    }
    // 新选择的文件可能只有临时 URL，不能将它保存进数据库。
    if (!file.url || /^(blob:|data:)/i.test(file.url)) return []
    return [file.url.replace(/^https?:\/\/[^/]+\//i, '').replace(/^\//, '')]
  })
}

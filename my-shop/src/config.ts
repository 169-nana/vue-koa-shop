const baseURL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8360'
).replace(/\/$/, '')

export const toAssetURL = (path: string | null | undefined) => {
  if (!path) {
    return ''
  }

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  return `${baseURL}/${path.replace(
    /^\//,
    ''
  )}`
}

export default {
  baseURL
}
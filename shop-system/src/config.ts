const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8360').replace(/\/$/, '')
const assetBaseURL = (import.meta.env.VITE_ASSET_BASE_URL || baseURL).replace(/\/$/, '')

export const toAssetURL = (path: string | null | undefined) => {
  if (!path || /^https?:\/\//i.test(path)) return path || ''
  return `${assetBaseURL}/${path.replace(/^\//, '')}`
}

export default { baseURL, assetBaseURL }

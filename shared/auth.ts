/** 登录完成后只接受站内绝对路径，避免返回登录页造成循环。 */
export function getAuthRedirect(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f]/.test(value)) return fallback
  let path: string
  try { path = decodeURIComponent(value.split(/[?#]/)[0] || '') } catch { return fallback }
  if (path.startsWith('//') || /[\\\s\u0000-\u001f]/.test(path) || /^\/(login|register)\/*$/i.test(path)) return fallback
  return value
}

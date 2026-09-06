// 网络输入始终是不可信的 unknown，校验之后才能进入业务层。
export function getBody(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
export class AppError extends Error {
  constructor(message: string, public readonly code: string) { super(message) }
}

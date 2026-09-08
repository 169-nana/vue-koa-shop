import DOMPurify from 'dompurify'

/** 在交给 v-html 之前移除脚本、事件处理器等危险内容。 */
export function sanitizeRichText(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      'img',
      'picture',
      'source',
      'svg',
      'form',
      'input',
      'button',
      'iframe',
      'object',
      'embed'
    ]
  })
}

/** 将现有商品规格文字拆成可供用户选择的选项。 */
export function parseGoodsSpecs(value: string): string[] {
  const specs = value
    .split(/[,，、|\n]+/)
    .map(item => item.trim())
    .filter(Boolean)

  return specs.length > 0 ? [...new Set(specs)] : ['默认规格']
}

/**
 * 前台导航与对应页面的临时开关（单一配置源）。
 * 为 true 时：顶栏不展示入口，直接访问路径会重定向首页；后端 API 仍保留。
 * 文档对齐：docs/TEMPORARILY-HIDDEN-FEATURES.md
 */
export const SITE_NAV_HIDDEN = {
  /** /ip-risk */
  ipRisk: true,
  /** /ai-toolbox 及智能选品 */
  aiToolboxSupplier: true,
  /** /amazon-aplus；亚马逊生成 Listing 的 Step 4（A+）同步关闭 */
  amazonAplus: true,
}

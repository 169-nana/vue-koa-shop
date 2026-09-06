/// <reference types="vite/client" />
/// <reference types="element-plus/global" />

import type { RouterLink, RouterView } from 'vue-router'
import type { ElLoadingDirective } from 'element-plus'
declare module 'vue' {
  interface GlobalComponents {
    RouterLink: typeof RouterLink
    RouterView: typeof RouterView
  }
  interface GlobalDirectives {
    vLoading: typeof ElLoadingDirective
  }
}

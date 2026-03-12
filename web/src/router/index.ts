import axios from 'axios'
import NProgress from 'nprogress'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { pinia } from '@/stores'
import { menuRoutes } from './menu'
import 'nprogress/nprogress.css'

NProgress.configure({ showSpinner: false })

// 冲突合并：保留你的防重复请求变量 + 移除原作者的useStorage（改用pinia）
let validatingPromise: Promise<boolean> | null = null

async function ensureTokenValid() {
  // 冲突合并：保留你的pinia逻辑 + 原作者的token获取逻辑
  const authStore = useAuthStore(pinia)
  const token = String(authStore.token || '').trim()
  
  // 无token时直接返回false（你的逻辑）
  if (!token)
    return false

  // 冲突合并：保留你的防重复请求逻辑 + 恢复原作者的密码禁用判断
  if (validatingPromise)
    return validatingPromise

  validatingPromise = axios.get('/api/auth/validate', {
    headers: { 'x-admin-token': token },
    timeout: 6000,
  }).then((res) => {
    if (res.data && res.data.ok) {
      const { valid, passwordDisabled, user } = res.data.data
      
      // 原作者的核心逻辑：密码禁用时直接认为有效
      if (passwordDisabled) {
        authStore.setAuth(token, user || authStore.user || null)
        return true
      }

      // 你的逻辑：token有效时更新状态
      if (valid) {
        authStore.setAuth(token, user || authStore.user || null)
        return true
      }
    }
    return false
  }).catch(() => false).finally(() => {
    validatingPromise = null
  })

  return validatingPromise
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/DefaultLayout.vue'),
      children: menuRoutes.map(route => ({
        path: route.path,
        name: route.name,
        component: route.component,
      })),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
    },
  ],
})

router.beforeEach(async (to, _from) => {
  NProgress.start()

  // 冲突合并：整合你的pinia逻辑 + 原作者的密码禁用场景处理
  const authStore = useAuthStore(pinia)

  if (to.name === 'login') {
    // 你的逻辑：无token时清空状态，显示登录页
    if (!authStore.token) {
      authStore.clearAuth()
      return true
    }
    
    // 合并逻辑：校验token（包含密码禁用场景）
    const valid = await ensureTokenValid()
    if (valid)
      return { name: 'dashboard' }
      
    // 校验失败时清空状态
    authStore.clearAuth()
    return true
  }

  // 非登录页：无token直接跳登录
  if (!authStore.token) {
    authStore.clearAuth()
    return { name: 'login' }
  }

  // 合并逻辑：校验token（包含密码禁用场景）
  const valid = await ensureTokenValid()
  if (!valid) {
    authStore.clearAuth()
    return { name: 'login' }
  }

  return true
})

router.afterEach(() => {
  NProgress.done()
})

export default router

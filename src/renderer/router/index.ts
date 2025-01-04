import { createRouter, createWebHashHistory } from 'vue-router'
import CodeView from '../views/CodeView.vue'
import SettingsView from '../views/SettingsView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: CodeView,
    },
    {
      path: '/code/:id?',
      name: 'code',
      component: CodeView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
  ],
})

export default router

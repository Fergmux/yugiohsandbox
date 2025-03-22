import { useUserStore } from '@/stores/user'
import LoginPage from '@/views/LoginPage.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginPage,
    },
    {
      path: '/deck',
      name: 'deck',
      component: () => import('@/views/DeckBuilder.vue'),
    },
    {
      path: '/play/:gameCode?',
      name: 'play',
      component: () => import('@/views/PlaySpace.vue'),
    },
    // {
    //   path: '/about',
    //   name: 'about',
    //   // route level code-splitting
    //   // this generates a separate chunk (About.[hash].js) for this route
    //   // which is lazy-loaded when the route is visited.
    //   component: () => import('../views/AboutView.vue'),
    // },
  ],
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  if (!userStore.user) {
    await userStore.loginExisting()
  }
  if (!userStore.user && to.name !== 'login') {
    next('/')
  } else {
    next()
  }
})

export default router

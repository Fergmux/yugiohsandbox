import { createRouter, createWebHistory } from 'vue-router'
import { getCurrentUser } from 'vuefire'

import { useUserStore } from '@/stores/user'
import LoginPage from '@/views/LoginPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:gameCode?',
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
    {
      path: '/playground',
      name: 'playground',
      component: () => import('@/views/PlayGround.vue'),
    },
    {
      path: '/user',
      name: 'user',
      component: () => import('@/views/UserProfile.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminPanel.vue'),
    },
    {
      path: '/endScreen',
      name: 'endScreen',
      component: () => import('@/views/EndScreen.vue'),
    },
    {
      path: '/crawler',
      name: 'crawler',
      component: () => import('@/views/YugiCrawler.vue'),
      children: [
        {
          path: '/crawler/:gameCode?',
          name: 'newGame',
          component: () => import('@/components/crawler/pages/NewGame.vue'),
        },
        {
          path: '/deckSelection',
          name: 'deckSelection',
          component: () => import('@/components/crawler/pages/DeckSelection.vue'),
        },
        {
          path: '/playSpace',
          name: 'playSpace',
          component: () => import('@/components/crawler/pages/PlaySpace.vue'),
        },
        {
          path: '/rewards',
          name: 'rewards',
          component: () => import('@/components/crawler/pages/GameRewards.vue'),
        },
      ],
    },
    {
      path: '/crawlv2/:gameCode?',
      name: 'crawlv2',
      component: () => import('@/views/CrawlV2.vue'),
    },
    {
      path: '/crawlv3/:gameCode?',
      name: 'crawlv3',
      component: () => import('@/views/CrawlV3.vue'),
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

  // Wait for Firebase Auth to resolve persisted session
  const firebaseUser = await getCurrentUser()

  // If Firebase user exists but store isn't loaded, initialize
  if (firebaseUser && !userStore.user) {
    await userStore.initAuth()
  }

  if (!userStore.user && to.name !== 'login') {
    next({
      name: 'login',
      params:
        to.name === 'play' || to.name === 'crawlv2' || to.name === 'crawlv3' ? { gameCode: to.params.gameCode } : {},
    })
  } else if (userStore.user && to.name === 'login') {
    next({ name: 'deck' })
  } else {
    next()
  }
})

export default router

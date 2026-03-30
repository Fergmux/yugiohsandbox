import './assets/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { VueFire, VueFireAuth } from 'vuefire'

import App from './App.vue'
import { firebaseApp } from './firebase/client'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(VueFire, { firebaseApp, modules: [VueFireAuth()] })
app.use(router)

app.mount('#app')

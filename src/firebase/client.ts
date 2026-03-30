import { getAnalytics } from 'firebase/analytics'
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'yugioh-sandbox.firebaseapp.com',
  projectId: 'yugioh-sandbox',
  storageBucket: 'yugioh-sandbox.firebasestorage.app',
  messagingSenderId: '225393770173',
  appId: '1:225393770173:web:1cc33be1417fe2e62881d4',
  measurementId: 'G-2ERKR6WL8P',
}

const firebaseApp = initializeApp(firebaseConfig)
const analytics = getAnalytics(firebaseApp)
const auth = getAuth(firebaseApp)
const db = getFirestore(firebaseApp)

export { auth, db, firebaseApp }

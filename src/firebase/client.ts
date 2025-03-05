// Import the functions you need from the SDKs you need
import { getAnalytics } from 'firebase/analytics'
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyAJOlHbVEA8ZsH5y7m2qLzDMCbfNjr1Ke8',
  authDomain: 'yugioh-sandbox.firebaseapp.com',
  projectId: 'yugioh-sandbox',
  storageBucket: 'yugioh-sandbox.firebasestorage.app',
  messagingSenderId: '225393770173',
  appId: '1:225393770173:web:1cc33be1417fe2e62881d4',
  measurementId: 'G-2ERKR6WL8P',
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const analytics = getAnalytics(app)

const db = getFirestore(app)

export { db }

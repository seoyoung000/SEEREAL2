import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyALWH-xZDS6fA1kAF4jDIHdG-vgWPLwR7k",
  authDomain: "seereal-e455a.firebaseapp.com",
  projectId: "seereal-e455a",
  storageBucket: "seereal-e455a.firebasestorage.app",
  messagingSenderId: "558244159292",
  appId: "1:558244159292:web:836eb27bf1d2c36cd60839",
  measurementId: "G-25D5V7ZWNK"
};


const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC6T-cOuEoc28czhNKE4FGyxYjHCMfjyqg",
  authDomain: "applute-codelab.firebaseapp.com",
  projectId: "applute-codelab",
  storageBucket: "applute-codelab.appspot.com",
  messagingSenderId: "605215329383",
  appId: "1:605215329383:web:57a3a5feab1250bfa6d8c2",
  measurementId: "G-DF05341WDJ",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

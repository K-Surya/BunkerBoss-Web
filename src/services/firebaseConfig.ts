import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";


const firebaseConfig = {
  apiKey: "AIzaSyBHUq3xsYvKlcNe6vfYpN5ZkuG5lTC3_eM",
  authDomain: "bunkerboss-1f604.firebaseapp.com",
  projectId: "bunkerboss-1f604",
  storageBucket: "bunkerboss-1f604.firebasestorage.app",
  messagingSenderId: "763461848013",
  appId: "1:763461848013:web:5428c955fdd62240cf1284",
  measurementId: "G-CCMYJ7HCDP",
};

const app = initializeApp(firebaseConfig);

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('BunkerBoss2026'),
  isTokenAutoRefreshEnabled: true
});

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;

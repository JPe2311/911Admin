// Firebase config - completa con tus datos de Firebase Console
// Ir a: Firebase Console > Configuración del proyecto > Tus apps > Web app
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

console.log("✓ Firebase config loaded:", window.FIREBASE_CONFIG?.projectId || "missing");
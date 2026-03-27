const { initializeApp } = require("firebase/app");
const { getFirestore, doc, updateDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyCL7i8XybBWeCXkATh4aiw9IgIeN0yFaFM",
  authDomain: "studio-2511212328-1383b.firebaseapp.com",
  projectId: "studio-2511212328-1383b",
  storageBucket: "studio-2511212328-1383b.firebasestorage.app",
  messagingSenderId: "342387466922",
  appId: "1:342387466922:web:bf7822eb0655ddbeb1e6d3",
  measurementId: "G-RN6F1NHJ6P"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fix() {
  try {
    const docRef = doc(db, 'concesionarios', 'test-concesionario');
    await updateDoc(docRef, {
      owner_uid: 'ACEHwdgzIRTGgVsCfyERoTjYgsJ2',
      plan_activo: true
    });
    console.log("Updated test-concesionario");
  } catch (err) {
    console.error(err);
  }
}
fix();

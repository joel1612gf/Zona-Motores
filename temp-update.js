const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  projectId: 'studio-2511212328-1383b'
});

const db = getFirestore();

async function run() {
  const docRef = db.collection('concesionarios').doc('test-concesionario');
  await docRef.update({
    owner_uid: 'ACEHwdgzIRTGgVsCfyERoTjYgsJ2'
  });
  console.log('Update success');
}

run().catch(console.error);

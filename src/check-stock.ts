import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkStock() {
    try {
        console.log('--- Scanning All Concesionarios ---');
        const qC = query(collection(db, 'concesionarios'));
        const snapC = await getDocs(qC);
        
        for (const docC of snapC.docs) {
            console.log(`\n--- Business ID: ${docC.id} ---`);
            const dataC = docC.data();
            console.log(`Slug: ${dataC.slug}, Name: ${dataC.nombre_empresa}`);
            
            // Try to find subcollections (listCollections is only admin, so we must try common names)
            const commonSubcollections = ['stock', 'inventario', 'staff', 'ventas', 'caja'];
            for (const sub of commonSubcollections) {
                const qSub = query(collection(db, 'concesionarios', docC.id, sub));
                const snapSub = await getDocs(qSub);
                if (snapSub.size > 0) {
                    console.log(`  > [${sub}] has ${snapSub.size} docs`);
                    if (sub === 'stock' || sub === 'inventario') {
                        snapSub.forEach(v => console.log(`    - Vehicle: ${v.data().make} ${v.data().model} (Status: ${v.data().estado_stock})`));
                    }
                } else {
                    console.log(`  > [${sub}] is empty`);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

checkStock();

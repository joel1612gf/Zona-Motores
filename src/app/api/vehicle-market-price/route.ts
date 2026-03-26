import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
function getAdminFirestore() {
  if (getApps().length === 0) {
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

export async function POST(request: NextRequest) {
  try {
    const { make, model, year } = await request.json();

    if (!make || !model) {
      return NextResponse.json(
        { error: 'Se requieren make y model' },
        { status: 400 }
      );
    }

    let db;
    try {
      db = getAdminFirestore();
    } catch (error) {
      console.error('[vehicle-market-price] Firebase Admin init error:', error);
      return NextResponse.json({
        found: false,
        message: `No se pudieron consultar precios del mercado`,
        count: 0,
      });
    }

    // Query all vehicleListings across all users
    const listingsRef = db.collectionGroup('vehicleListings');
    const snapshot = await listingsRef
      .where('make', '==', make)
      .where('model', '==', model)
      .where('status', '==', 'active')
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        found: false,
        message: `No hay publicaciones activas de ${make} ${model} en la web`,
        count: 0,
      });
    }

    // Filter by year if provided, and collect prices
    const prices: number[] = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (year && data.year !== year) return;
      if (data.priceUSD && data.priceUSD > 0) {
        prices.push(data.priceUSD);
      }
    });

    if (prices.length === 0) {
      // Try without year filter
      const allPrices: number[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.priceUSD && data.priceUSD > 0) {
          allPrices.push(data.priceUSD);
        }
      });

      if (allPrices.length === 0) {
        return NextResponse.json({
          found: false,
          message: `No hay datos de precios para ${make} ${model}`,
          count: 0,
        });
      }

      allPrices.sort((a, b) => a - b);
      return NextResponse.json({
        found: true,
        exactYear: false,
        make,
        model,
        min: allPrices[0],
        max: allPrices[allPrices.length - 1],
        avg: Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length),
        count: allPrices.length,
        message: `Los ${make} ${model} están entre $${allPrices[0].toLocaleString()} y $${allPrices[allPrices.length - 1].toLocaleString()} en la web (${allPrices.length} publicaciones, varios años)`,
      });
    }

    prices.sort((a, b) => a - b);

    return NextResponse.json({
      found: true,
      exactYear: true,
      make,
      model,
      year,
      min: prices[0],
      max: prices[prices.length - 1],
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      count: prices.length,
      message: `Los ${make} ${model} ${year} están entre $${prices[0].toLocaleString()} y $${prices[prices.length - 1].toLocaleString()} en la web (${prices.length} publicaciones)`,
    });
  } catch (error) {
    console.error('[vehicle-market-price] Error:', error);
    // Return graceful failure instead of 500
    return NextResponse.json({
      found: false,
      message: 'No se pudieron consultar precios del mercado',
      count: 0,
    });
  }
}

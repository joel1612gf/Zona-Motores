import { NextResponse } from 'next/server';

let cache: { tasa: number; fuente: string; fecha: string } | null = null;
let cacheExpiry = 0;
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  try {
    const now = Date.now();
    const caracasTime = new Date().toLocaleString("en-US", { timeZone: "America/Caracas" });
    const nowLocal = new Date(caracasTime);

    // Freeze logic: between 2:00 PM (14) and 11:59 PM (23), we block new updates 
    // to strictly prevent "tomorrow's rate" from activating before midnight.
    const isFrozenHours = nowLocal.getHours() >= 14 && nowLocal.getHours() <= 23;

    if (cache && (isFrozenHours || now < cacheExpiry)) {
      return NextResponse.json({ ...cache, frozen: isFrozenHours });
    }

    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      throw new Error(`API responded with status ${res.status}`);
    }

    const data = await res.json();

    const bcvRate = data?.promedio as number | undefined;

    if (!bcvRate || bcvRate <= 0) {
      throw new Error('Invalid rate from API');
    }

    cache = {
      tasa: Number(Number(bcvRate).toFixed(2)),
      fuente: 'BCV vía dolarapi.com',
      fecha: data?.fechaActualizacion || new Date().toISOString(),
    };
    cacheExpiry = now + CACHE_DURATION_MS;

    return NextResponse.json(cache);
  } catch (error) {
    console.error('[exchange-rate] Error fetching rate:', error);
    // Return last cached value if available, otherwise 503
    if (cache) {
      return NextResponse.json({ ...cache, fromCache: true });
    }
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa de cambio.' },
      { status: 503 }
    );
  }
}

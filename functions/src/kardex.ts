// Pure kardex math — mirror of weightedAverageCost from src/lib/accounting-helpers.ts.
// Kept decoupled so functions/tsconfig does not pull Next sources.

export function weightedAverageCost(
  qtyCurrent: number,
  costCurrent: number,
  qtyIn: number,
  costIn: number,
): number {
  const denom = qtyCurrent + qtyIn;
  if (denom <= 0) return costIn;
  return ((qtyCurrent * costCurrent) + (qtyIn * costIn)) / denom;
}

export type CompraItemLite = {
  producto_id: string;
  cantidad: number;
  costo_unitario_usd: number;
};

export type VentaItemLite = {
  producto_id: string;
  cantidad: number;
};

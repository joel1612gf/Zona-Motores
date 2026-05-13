// Pure match logic — mirror of src/lib/match-engine.ts.
// Kept decoupled so functions/tsconfig does not need to include Next sources.

export type VehiculoRequerido = {
  id: string;
  make: string;
  model: string;
  year_min?: number;
  year_max?: number;
  budget?: number;
  status: 'pendiente' | 'completado' | 'cancelado';
};

export type ClienteLite = {
  id: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  vehiculos_requeridos?: VehiculoRequerido[];
};

export type MatchVehicleInput = {
  make: string;
  model: string;
  year?: number;
  precio_usd: number;
};

export type MatchCandidate = {
  cliente: ClienteLite;
  requerido: VehiculoRequerido;
  within_tolerance: boolean;
};

const BUDGET_TOLERANCE = 1.1;

const norm = (s: string): string => s.trim().toLowerCase();

const makeMatches = (r: string, v: string): boolean => norm(r) === norm(v);

const modelMatches = (r: string, v: string): boolean => {
  const a = norm(r);
  const b = norm(v);
  return a === b || b.includes(a) || a.includes(b);
};

const yearInRange = (year: number | undefined, req: VehiculoRequerido): boolean => {
  if (year === undefined) return true;
  if (req.year_min !== undefined && year < req.year_min) return false;
  if (req.year_max !== undefined && year > req.year_max) return false;
  return true;
};

const budgetOk = (
  precio_usd: number,
  budget: number | undefined,
): { ok: boolean; within_tolerance: boolean } => {
  if (budget === undefined || budget <= 0) {
    return { ok: true, within_tolerance: false };
  }
  return { ok: precio_usd <= budget * BUDGET_TOLERANCE, within_tolerance: true };
};

export function findMatches(vehicle: MatchVehicleInput, clientes: ClienteLite[]): MatchCandidate[] {
  const results: MatchCandidate[] = [];
  for (const cliente of clientes) {
    const reqs = cliente.vehiculos_requeridos;
    if (!reqs || reqs.length === 0) continue;
    for (const req of reqs) {
      if (req.status !== 'pendiente') continue;
      if (!makeMatches(req.make, vehicle.make)) continue;
      if (!modelMatches(req.model, vehicle.model)) continue;
      if (!yearInRange(vehicle.year, req)) continue;
      const b = budgetOk(vehicle.precio_usd, req.budget);
      if (!b.ok) continue;
      results.push({ cliente, requerido: req, within_tolerance: b.within_tolerance });
    }
  }
  return results;
}

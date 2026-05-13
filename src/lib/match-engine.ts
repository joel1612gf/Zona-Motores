import type { Cliente, VehiculoRequerido } from './business-types';

const BUDGET_TOLERANCE = 1.1;

export type MatchVehicleInput = {
  make: string;
  model: string;
  year?: number;
  precio_usd: number;
};

export type MatchCandidate = {
  cliente: Cliente;
  requerido: VehiculoRequerido;
  within_tolerance: boolean;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function makeMatches(reqMake: string, vehMake: string): boolean {
  return norm(reqMake) === norm(vehMake);
}

function modelMatches(reqModel: string, vehModel: string): boolean {
  const r = norm(reqModel);
  const v = norm(vehModel);
  return v === r || v.includes(r) || r.includes(v);
}

function yearInRange(year: number | undefined, req: VehiculoRequerido): boolean {
  if (year === undefined) return true;
  if (req.year_min !== undefined && year < req.year_min) return false;
  if (req.year_max !== undefined && year > req.year_max) return false;
  return true;
}

function budgetOk(precio_usd: number, budget: number | undefined): { ok: boolean; within_tolerance: boolean } {
  if (budget === undefined || budget <= 0) {
    return { ok: true, within_tolerance: false };
  }
  return { ok: precio_usd <= budget * BUDGET_TOLERANCE, within_tolerance: true };
}

export function findMatches(vehicle: MatchVehicleInput, clientes: Cliente[]): MatchCandidate[] {
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

import { differenceInDays } from "date-fns";
import { Venta, StockVehicle, StaffMember, RegistroCaja } from "./business-types";

export interface OperatingExpense {
  id: string;
  category: string;
  amount: number;
  date: any;
  description?: string;
}

export interface FinancialObligations {
  basePayroll: number;
  commissions: number;
  operatingExpenses: OperatingExpense[];
}

/**
 * Calculates the net balance and coverage ratio.
 * Future-proofed for additional expense categories.
 */
export const calculateNetBalance = (
  totalIncome: number,
  obligations: FinancialObligations
) => {
  const totalExpenses = 
    obligations.basePayroll + 
    obligations.commissions + 
    obligations.operatingExpenses.reduce((acc, exp) => acc + exp.amount, 0);

  const netBalance = totalIncome - totalExpenses;
  const coverageRatio = totalExpenses > 0 ? (totalIncome / totalExpenses) * 100 : 100;

  return {
    netBalance,
    totalExpenses,
    coverageRatio: Math.min(coverageRatio, 100),
    status: netBalance >= 0 ? 'HEALTHY' : 'CRITICAL' as 'HEALTHY' | 'CRITICAL'
  };
};

/**
 * Segments inventory by days in stock.
 */
export const getInventoryAging = (vehicles: StockVehicle[]) => {
  const now = new Date();
  const aging = {
    new: 0,      // 0-30 days
    medium: 0,   // 31-60 days
    old: 0,      // 61-90 days
    critical: 0  // +90 days
  };

  vehicles.forEach(v => {
    // StockVehicle uses created_at (Timestamp)
    const entryDate = v.created_at?.toDate() || now;
    const days = differenceInDays(now, entryDate);
    
    if (days <= 30) aging.new++;
    else if (days <= 60) aging.medium++;
    else if (days <= 90) aging.old++;
    else aging.critical++;
  });

  return aging;
};

/**
 * Aggregates financial data for the reports dashboard.
 */
export const aggregateFinancialStats = (
  sales: Venta[],
  vehicles: StockVehicle[],
  staff: StaffMember[],
  cashFlow: RegistroCaja[]
) => {
  const totalIncome = sales.reduce((acc, s) => acc + (s.precio_venta || 0), 0);
  const totalCommissions = sales.reduce((acc, s) => acc + (s.comision_vendedor || 0), 0);
  const basePayroll = staff.reduce((acc, e) => acc + (e.base_salary_usd || 0), 0);

  const inventoryValue = vehicles.reduce((acc, v) => {
    const totalCosts = (v.costo_compra || 0) + 
      (v.gastos_adecuacion?.reduce((sum, g) => sum + g.monto, 0) || 0);
    return acc + totalCosts;
  }, 0);

  const balance = calculateNetBalance(totalIncome, {
    basePayroll,
    commissions: totalCommissions,
    operatingExpenses: [] // Phase 2: Add other expenses here
  });

  return {
    totalIncome,
    totalCommissions,
    basePayroll,
    inventoryValue,
    balance,
    aging: getInventoryAging(vehicles)
  };
};

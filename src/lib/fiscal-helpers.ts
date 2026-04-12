/**
 * Fiscal calculation helpers for Venezuela 2026.
 */

export const IVA_RATE = 0.16;
export const IGTF_RATE = 0.03;

/**
 * Applies IGTF (3%) only if the payment method involves USD Cash, Zelle, or Crypto
 * according to Venezuelan fiscal mandate 2026.
 */
export const calculateFiscalBreakdown = (basePrice: number, paymentMethod: string, isExempt: boolean = false) => {
  const iva = isExempt ? 0 : basePrice * IVA_RATE;
  let igtf = 0;
  
  // Apply IGTF for foreign currency cash or non-bank transfers (e.g., Zelle)
  const methodsSubjectToIGTF = ['Zelle', 'Efectivo USD', 'Dólares', 'Zelle / Dólares', 'Crypto'];
  
  // Check if payment method is in the list (case insensitive or partial match)
  const isIGTFApplicable = methodsSubjectToIGTF.some(method => 
    paymentMethod.toLowerCase().includes(method.toLowerCase())
  );

  if (isIGTFApplicable) {
    // IGTF is calculated on the total (Base + IVA)
    igtf = (basePrice + iva) * IGTF_RATE;
  }
  
  return {
    baseAmount: basePrice,
    taxIVA: iva,
    taxIGTF: igtf,
    totalAmount: basePrice + iva + igtf
  };
};

/**
 * Formats a number as a Venezuelan fiscal currency string.
 */
export const formatVes = (amount: number, rate: number) => {
  const amountVes = amount * rate;
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
  }).format(amountVes);
};

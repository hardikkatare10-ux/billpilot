export interface CashSaleReturnRecord {
  id: string;
  saleId: string;
  productId: number;
  productName: string;
  quantity: number;
  refundAmount: number;
  reason: string;
  condition: "resalable" | "damaged";
  refundMethod: "cash" | "store_credit" | "external";
  createdAt: string;
}

export interface ReturnableSaleItem {
  productId: number;
  name: string;
  qty: number;
  price: number;
  gstRate: number;
}

export interface ReturnableSale {
  id: string;
  items?: ReturnableSaleItem[];
  subtotal?: number;
  discountAmount?: number;
  totalGst?: number;
}

export function getSoldProductQuantity(sale: ReturnableSale, productId: number): number {
  return (sale.items || [])
    .filter((item) => item.productId === productId)
    .reduce((total, item) => total + item.qty, 0);
}

export function getReturnedProductQuantity(
  saleId: string,
  productId: number,
  returns: CashSaleReturnRecord[]
): number {
  return returns
    .filter((record) => record.saleId === saleId && record.productId === productId)
    .reduce((total, record) => total + record.quantity, 0);
}

export function getRemainingReturnQuantity(
  sale: ReturnableSale,
  productId: number,
  returns: CashSaleReturnRecord[]
): number {
  return Math.max(0, getSoldProductQuantity(sale, productId) - getReturnedProductQuantity(sale.id, productId, returns));
}

export function calculateReturnRefundAmount(
  sale: ReturnableSale,
  productId: number,
  quantity: number
): number {
  const items = (sale.items || []).filter((item) => item.productId === productId);
  const productQuantity = items.reduce((total, item) => total + item.qty, 0);
  const grossSubtotal = (sale.items || []).reduce((total, item) => total + item.qty * item.price, 0);
  if (!productQuantity || !grossSubtotal || !Number.isInteger(quantity) || quantity <= 0) return 0;

  const discountRate = Math.min(1, Math.max(0, (sale.discountAmount || 0) / grossSubtotal));
  const refundBeforeRounding = items.reduce((total, item) => {
    const itemSubtotal = item.qty * item.price * (1 - discountRate);
    const itemTax = sale.totalGst ? itemSubtotal * (item.gstRate / 100) : 0;
    return total + itemSubtotal + itemTax;
  }, 0) * (quantity / productQuantity);

  return Math.round(refundBeforeRounding * 100) / 100;
}

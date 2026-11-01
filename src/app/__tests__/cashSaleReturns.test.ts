import { describe, expect, it } from "vitest";
import {
  calculateReturnRefundAmount,
  getRemainingReturnQuantity,
  getReturnedProductQuantity,
  getSoldProductQuantity,
  type CashSaleReturnRecord,
  type ReturnableSale,
} from "../cashSaleReturns";

const sale: ReturnableSale = {
  id: "cash-1",
  items: [
    { productId: 1, name: "Tea", qty: 2, price: 100, gstRate: 5 },
    { productId: 2, name: "Sugar", qty: 1, price: 50, gstRate: 5 },
  ],
  subtotal: 240,
  discountAmount: 10,
  totalGst: 12,
};

const returns: CashSaleReturnRecord[] = [{
  id: "return-1",
  saleId: "cash-1",
  productId: 1,
  productName: "Tea",
  quantity: 1,
  refundAmount: 100.8,
  reason: "Customer request",
  condition: "resalable",
  refundMethod: "cash",
  createdAt: "2026-01-01T00:00:00.000Z",
}];

describe("cash sale returns", () => {
  it("calculates quantities sold and previously returned per sale and product", () => {
    expect(getSoldProductQuantity(sale, 1)).toBe(2);
    expect(getReturnedProductQuantity("cash-1", 1, returns)).toBe(1);
    expect(getReturnedProductQuantity("another-sale", 1, returns)).toBe(0);
    expect(getRemainingReturnQuantity(sale, 1, returns)).toBe(1);
    expect(getRemainingReturnQuantity(sale, 2, returns)).toBe(1);
  });

  it("prorates the sale discount and item GST for the returned quantity", () => {
    expect(calculateReturnRefundAmount(sale, 1, 1)).toBe(100.8);
    expect(calculateReturnRefundAmount(sale, 1, 2)).toBe(201.6);
  });

  it("rejects invalid quantities and unknown products", () => {
    expect(calculateReturnRefundAmount(sale, 1, 0)).toBe(0);
    expect(calculateReturnRefundAmount(sale, 1, 1.5)).toBe(0);
    expect(calculateReturnRefundAmount(sale, 999, 1)).toBe(0);
  });
});

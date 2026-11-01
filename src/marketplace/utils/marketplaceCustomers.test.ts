import { describe, expect, it } from "vitest";
import {
  adjustMarketplaceCompletedPurchaseAmount,
  formatMarketplaceAddress,
  getMarketplaceMapsUrl,
  isCompletedMarketplacePurchase,
} from "./marketplaceCustomers";
import type { Order, UserAddress } from "../types";

const address: UserAddress = {
  id: "address_1",
  userId: "customer_1",
  label: "Home",
  recipientName: "Customer",
  phoneNumber: "1234567890",
  streetAddress: "10 Main Street",
  locality: "Vijay Nagar",
  city: "Jabalpur",
  pincode: "482002",
  isDefault: true,
};

const order = (
  status: Order["status"],
  paymentStatus: Order["paymentStatus"],
  totalAmount = 25000
): Pick<Order, "status" | "paymentStatus" | "totalAmount"> => ({
  status,
  paymentStatus,
  totalAmount,
});

describe("marketplace customer records", () => {
  it("counts completed paid purchases and excludes cancelled or refunded orders", () => {
    expect(isCompletedMarketplacePurchase(order("delivered", "completed"))).toBe(true);
    expect(isCompletedMarketplacePurchase(order("cancelled", "completed"))).toBe(false);
    expect(isCompletedMarketplacePurchase(order("refunded", "refunded"))).toBe(false);
    expect(isCompletedMarketplacePurchase(order("delivered", "pending"))).toBe(false);
  });

  it("applies completion and refund transitions once to the shop-scoped total", () => {
    expect(adjustMarketplaceCompletedPurchaseAmount(0, order("accepted", "pending"), order("delivered", "completed"))).toBe(25000);
    expect(adjustMarketplaceCompletedPurchaseAmount(25000, order("delivered", "completed"), order("refunded", "refunded"))).toBe(0);
    expect(adjustMarketplaceCompletedPurchaseAmount(0, order("accepted", "pending"), order("cancelled", "pending"))).toBe(0);
  });

  it("formats delivery addresses and prefers authorized coordinates for map links", () => {
    expect(formatMarketplaceAddress(address)).toBe("10 Main Street, Vijay Nagar, Jabalpur, 482002");
    expect(getMarketplaceMapsUrl({
      ...address,
      coordinates: { latitude: 23.1815, longitude: 79.9864 },
    })).toBe("https://www.google.com/maps/search/?api=1&query=23.1815%2C79.9864");
    expect(getMarketplaceMapsUrl(address)).toContain(encodeURIComponent(formatMarketplaceAddress(address)));
    expect(getMarketplaceMapsUrl({ ...address, streetAddress: "", locality: "", city: "", pincode: "" })).toBeNull();
  });
});

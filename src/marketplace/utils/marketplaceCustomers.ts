import type { Order, UserAddress } from "../types";

export function isCompletedMarketplacePurchase(
  order: Pick<Order, "status" | "paymentStatus">
): boolean {
  return order.paymentStatus === "completed" &&
    order.status !== "cancelled" &&
    order.status !== "rejected" &&
    order.status !== "refunded";
}

export function adjustMarketplaceCompletedPurchaseAmount(
  currentAmount: number,
  previousOrder: Pick<Order, "status" | "paymentStatus" | "totalAmount">,
  updatedOrder: Pick<Order, "status" | "paymentStatus" | "totalAmount">
): number {
  const previousAmount = isCompletedMarketplacePurchase(previousOrder)
    ? previousOrder.totalAmount
    : 0;
  const updatedAmount = isCompletedMarketplacePurchase(updatedOrder)
    ? updatedOrder.totalAmount
    : 0;
  return Math.max(0, currentAmount + updatedAmount - previousAmount);
}

export function formatMarketplaceAddress(address: UserAddress): string {
  return [
    address.streetAddress,
    address.locality,
    address.landmark,
    address.city,
    address.state,
    address.pincode,
  ].filter(Boolean).join(", ");
}

export function getMarketplaceMapsUrl(address: UserAddress): string | null {
  const { coordinates } = address;
  if (
    coordinates &&
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude) &&
    Math.abs(coordinates.latitude) <= 90 &&
    Math.abs(coordinates.longitude) <= 180
  ) {
    const query = `${coordinates.latitude},${coordinates.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  const addressText = formatMarketplaceAddress(address);
  return addressText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
    : null;
}

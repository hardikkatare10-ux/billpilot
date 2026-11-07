import { describe, expect, it } from 'vitest';
import type { Order } from '../marketplace/types';
import { calculateMarketplaceSalesSummary, getMarketplaceFulfillmentBucket, resolveMarketplaceDateRange } from './marketplaceSales';

const makeOrder=(overrides:Partial<Order>&Pick<Order,'id'|'shopId'|'createdAt'>):Order=>({
  id:overrides.id,shopId:overrides.shopId,createdAt:overrides.createdAt,
  orderNumber:overrides.id,customerId:'customer',customerName:'Buyer',customerPhone:'',shopName:'Shop',shopAddress:'',shopPhone:'',
  deliveryAddress:{} as Order['deliveryAddress'],items:[],itemCount:1,subtotal:0,deliveryCharge:0,gstTotal:0,platformCommission:0,totalAmount:0,
  status:'pending_confirmation',paymentMethod:'cash_on_delivery',paymentStatus:'pending',statusHistory:[],
  delivery:{orderId:overrides.id,shopId:overrides.shopId,deliveryAgentName:'',deliveryAgentPhone:'',assignedAt:overrides.createdAt,otpCode:'0000',otpVerified:false},
  estimatedDeliveryTime:overrides.createdAt,updatedAt:overrides.createdAt,...overrides,
});

describe('marketplace dashboard sales',()=>{
  it('calculates only unique current-shop order value and paid completed revenue',()=>{
    const delivered=makeOrder({id:'paid',shopId:'shop-a',createdAt:'2026-11-08T08:00:00.000Z',status:'delivered',paymentStatus:'completed',totalAmount:100000,platformCommission:5000});
    const pending=makeOrder({id:'pending',shopId:'shop-a',createdAt:'2026-11-08T09:00:00.000Z',totalAmount:50000});
    const deliveredUnpaid=makeOrder({id:'delivered-unpaid',shopId:'shop-a',createdAt:'2026-11-08T09:30:00.000Z',status:'delivered',paymentStatus:'pending',totalAmount:80000});
    const cancelled=makeOrder({id:'cancelled',shopId:'shop-a',createdAt:'2026-11-08T10:00:00.000Z',status:'cancelled',paymentStatus:'refunded',totalAmount:40000});
    const refunded=makeOrder({id:'refunded',shopId:'shop-a',createdAt:'2026-11-08T11:00:00.000Z',status:'refunded',paymentStatus:'refunded',refundAmount:25000,totalAmount:25000,platformCommission:1250,statusHistory:[{status:'delivered',timestamp:'2026-11-08T11:00:00.000Z',actorId:'x',actorRole:'shopkeeper'}]});
    const refundWithoutAmount=makeOrder({id:'refund-unknown',shopId:'shop-a',createdAt:'2026-11-08T11:15:00.000Z',status:'refunded',paymentStatus:'refunded',totalAmount:5000,statusHistory:[{status:'delivered',timestamp:'2026-11-08T11:00:00.000Z',actorId:'x',actorRole:'shopkeeper'}]});
    const otherShop=makeOrder({id:'other',shopId:'shop-b',createdAt:'2026-11-08T08:00:00.000Z',status:'delivered',paymentStatus:'completed',totalAmount:990000});
    const archived=makeOrder({id:'archived',shopId:'shop-a',createdAt:'2026-11-08T12:00:00.000Z',status:'delivered',paymentStatus:'completed',shopArchived:true,totalAmount:70000,platformCommission:3500});
    const summary=calculateMarketplaceSalesSummary([delivered,delivered,pending,deliveredUnpaid,cancelled,refunded,refundWithoutAmount,otherShop,archived],'shop-a',{start:'2026-11-08',end:'2026-11-08'});
    expect(summary.totalOrders).toBe(6);
    expect(summary.archivedOrders).toBe(1);
    expect(summary.orders.some(order => order.shopArchived)).toBe(false);
    expect(summary.totalOrderValue).toBe(3000);
    expect(summary.completedOrders).toBe(2);
    expect(summary.completedSales).toBe(1250);
    expect(summary.pendingOrders).toBe(1);
    expect(summary.pendingOrderValue).toBe(500);
    expect(summary.pendingFulfillmentAmount).toBe(500);
    expect(summary.cancelledOrders).toBe(1);
    expect(summary.cancelledOrderValue).toBe(400);
    expect(summary.refunds).toBe(250);
    expect(summary.unquantifiedRefunds).toBe(1);
    expect(summary.netMarketplaceSales).toBe(1000);
    expect(summary.recordedCommission).toBe(50);
    expect(summary.shopkeeperNetAfterCommission).toBe(950);
  });

  it('maps Out For Delivery and Delivered to their fulfillment buckets',()=>{
    const out=makeOrder({id:'BPL-4617',shopId:'shop-a',createdAt:'2026-11-08T08:00:00Z',status:'Out For Delivery' as Order['status']});
    const delivered=makeOrder({id:'BPL-5474',shopId:'shop-a',createdAt:'2026-11-08T08:00:00Z',status:'Delivered' as Order['status']});
    expect(getMarketplaceFulfillmentBucket(out)).toBe('pending');
    expect(getMarketplaceFulfillmentBucket(delivered)).toBe('delivered');
  });

  it('resolves today, yesterday, week, month, and custom date filters in local time',()=>{
    const now=new Date(2026,10,8,12,30);
    expect(resolveMarketplaceDateRange('today',now)).toEqual({start:'2026-11-08',end:'2026-11-08'});
    expect(resolveMarketplaceDateRange('yesterday',now)).toEqual({start:'2026-11-07',end:'2026-11-07'});
    expect(resolveMarketplaceDateRange('week',now)).toEqual({start:'2026-11-02',end:'2026-11-08'});
    expect(resolveMarketplaceDateRange('month',now)).toEqual({start:'2026-11-01',end:'2026-11-08'});
    expect(resolveMarketplaceDateRange('custom',now,{start:'2026-11-03',end:'2026-11-05'})).toEqual({start:'2026-11-03',end:'2026-11-05'});
  });

  it('recomputes totals when a realtime order snapshot changes fulfillment and payment status',()=>{
    const pending=makeOrder({id:'live-order',shopId:'shop-a',createdAt:'2026-11-08T08:00:00.000Z',totalAmount:70000});
    const range={start:'2026-11-08',end:'2026-11-08'};
    const before=calculateMarketplaceSalesSummary([pending],'shop-a',range);
    const delivered={...pending,status:'delivered' as const,paymentStatus:'completed' as const,statusHistory:[{status:'delivered' as const,timestamp:pending.createdAt,actorId:'owner',actorRole:'shopkeeper' as const}]};
    const after=calculateMarketplaceSalesSummary([delivered],'shop-a',range);
    expect(before.pendingOrders).toBe(1);
    expect(before.completedSales).toBe(0);
    expect(after.pendingOrders).toBe(0);
    expect(after.deliveredOrders).toBe(1);
    expect(after.completedSales).toBe(700);
  });
});

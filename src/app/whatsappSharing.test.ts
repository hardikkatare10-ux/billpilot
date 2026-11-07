import { describe, expect, it } from 'vitest';
import {
  buildDailyWhatsAppReport,
  buildWhatsAppShareUrl,
  createDailyReportPdf,
  formatDailyWhatsAppReport,
  formatDemandWhatsAppReport,
  normalizeWhatsAppRecipient,
} from './whatsappSharing';

describe('personal WhatsApp sharing', () => {
  it('keeps each business recipient independent and normalizes country prefixes', () => {
    expect(normalizeWhatsAppRecipient('9425160185', '+91')).toBe('919425160185');
    expect(normalizeWhatsAppRecipient('09425160185', '+91')).toBe('919425160185');
    expect(normalizeWhatsAppRecipient('+91 98765 43210', '+91')).toBe('919876543210');
    expect(buildWhatsAppShareUrl('9425160185', 'Daily report', '+91')).toBe('https://wa.me/919425160185?text=Daily%20report');
    expect(buildWhatsAppShareUrl('9876543210', 'Daily report', '+91')).toContain('/919876543210?');
    expect(()=>normalizeWhatsAppRecipient('123', '+91')).toThrow(/valid WhatsApp number/i);
  });

  it('encodes report text and includes daily sales, cash, discounts and returns', () => {
    const report=buildDailyWhatsAppReport('Shop A','2026-11-08',[
      {date:'2026-11-08',total:500,saleType:'cash',paidAmount:480,discountAmount:20},
      {date:'2026-11-08',total:300,paymentMode:'upi',discountAmount:10},
      {date:'2026-11-07',total:100,saleType:'cash'},
    ],[
      {createdAt:'2026-11-08T10:00:00+05:30',refundAmount:50},
      {createdAt:'2026-11-07T10:00:00+05:30',refundAmount:100},
    ]);
    expect(report).toEqual({business:'Shop A',date:'2026-11-08',totalSales:800,cashCollected:480,transactions:1,discounts:20,returns:50});
    const message=formatDailyWhatsAppReport(report);
    expect(message).toContain('Total sales: INR 800.00');
    expect(message).toContain('Cash collected: INR 480.00');
    expect(message).toContain('Returns / refunds: INR 50.00');
    const url=buildWhatsAppShareUrl('9425160185',message);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(message);
  });

  it('formats actual demand lines and creates a downloadable PDF file', async () => {
    const demand=formatDemandWhatsAppReport('Shop A','2026-11-08',[{customer:'Asha',product:'Rice',requested:10,received:4,remaining:6,status:'partial'}]);
    expect(demand).toContain('Asha — Rice');
    expect(demand).toContain('Requested: 10 | Received: 4 | Remaining: 6');
    const pdf=await createDailyReportPdf({business:'Shop A',date:'2026-11-08',totalSales:800,cashCollected:480,transactions:1,discounts:20,returns:50});
    expect(pdf.name).toBe('daily-cash-report-2026-11-08.pdf');
    expect(pdf.type).toBe('application/pdf');
    expect(pdf.size).toBeGreaterThan(500);
  });
});

export interface DailyWhatsAppReport {
  business: string;
  date: string;
  totalSales: number;
  cashCollected: number;
  transactions: number;
  discounts: number;
  returns: number;
}

export interface DemandWhatsAppLine {
  customer: string;
  product: string;
  requested: number;
  received: number;
  remaining: number;
  status?: string;
}

export interface CashSaleForReport {
  date: string; total: number; saleType?: string; paymentMode?: string; paymentMethod?: string;
  paidAmount?: number; discountAmount?: number; paymentSplits?: { mode: string; amount: number }[];
}
export interface CashReturnForReport { createdAt: string; refundAmount: number }

const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const isCashSale = (sale: CashSaleForReport) => sale.saleType==='cash'||sale.paymentMode==='cash'||sale.paymentMethod?.toLowerCase()==='cash'||sale.paymentSplits?.some(payment=>payment.mode==='cash');

export function buildDailyWhatsAppReport(business: string, date: string, invoices: CashSaleForReport[], returns: CashReturnForReport[]): DailyWhatsAppReport {
  const daily = invoices.filter(invoice=>String(invoice.date).slice(0,10)===date);
  const cash = daily.filter(isCashSale);
  const refunds = returns.filter(item=>localDay(new Date(item.createdAt))===date);
  const cashCollected = (invoice: CashSaleForReport) => {
    const split = invoice.paymentSplits?.filter(payment=>payment.mode==='cash').reduce((sum,payment)=>sum+Number(payment.amount||0),0);
    if(split!==undefined&&invoice.paymentSplits?.length)return split;
    return Number(invoice.paidAmount??invoice.total??0);
  };
  return {
    business,date,
    totalSales:daily.reduce((sum,invoice)=>sum+Number(invoice.total||0),0),
    cashCollected:cash.reduce((sum,invoice)=>sum+cashCollected(invoice),0),
    transactions:cash.length,
    discounts:cash.reduce((sum,invoice)=>sum+Number(invoice.discountAmount||0),0),
    returns:refunds.reduce((sum,item)=>sum+Number(item.refundAmount||0),0),
  };
}

export function normalizeWhatsAppRecipient(phone: string, countryCode = '+91'): string {
  const entered = String(phone || '').replace(/\D/g, '');
  const prefix = String(countryCode || '').replace(/\D/g, '');
  const localNumber = prefix ? entered.replace(/^0+/, '') : entered;
  const digits = prefix && entered.startsWith(prefix) && entered.length > 10 ? entered : `${prefix}${localNumber}`;
  if (digits.length < 8 || digits.length > 15) throw new Error('Enter a valid WhatsApp number with country code.');
  return digits;
}

export function buildWhatsAppShareUrl(phone: string, message: string, countryCode = '+91'): string {
  const recipient = normalizeWhatsAppRecipient(phone, countryCode);
  return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
}

const money = (amount: number) => `INR ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function formatDailyWhatsAppReport(report: DailyWhatsAppReport): string {
  return [
    `Daily Cash Sale Report - ${report.business}`,
    `Date: ${report.date}`,
    `Total sales: ${money(report.totalSales)}`,
    `Cash collected: ${money(report.cashCollected)}`,
    `Cash transactions: ${report.transactions}`,
    `Discounts: ${money(report.discounts)}`,
    `Returns / refunds: ${money(report.returns)}`,
  ].join('\n');
}

export function formatDemandWhatsAppReport(business: string, date: string, demands: DemandWhatsAppLine[]): string {
  const lines = demands.map((d, index) => [
    `${index + 1}. ${d.customer} — ${d.product}`,
    `   Requested: ${d.requested} | Received: ${d.received} | Remaining: ${d.remaining}${d.status ? ` | ${d.status}` : ''}`,
  ].join('\n'));
  return [`Regular Demand List - ${business}`, `Date: ${date}`, '', ...(lines.length ? lines : ['No demand records.'])].join('\n');
}

export async function createDailyReportPdf(report: DailyWhatsAppReport): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text('Daily Cash Sale Report', margin, 22);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  const rows = [
    `Business: ${report.business}`,
    `Date: ${report.date}`,
    `Total sales: ${money(report.totalSales)}`,
    `Cash collected: ${money(report.cashCollected)}`,
    `Cash transactions: ${report.transactions}`,
    `Discounts: ${money(report.discounts)}`,
    `Returns / refunds: ${money(report.returns)}`,
  ];
  let y = 36;
  for (const row of rows) {
    const wrapped = pdf.splitTextToSize(row, 174);
    pdf.text(wrapped, margin, y);
    y += wrapped.length * 7;
  }
  return new File([pdf.output('blob')], `daily-cash-report-${report.date}.pdf`, { type: 'application/pdf' });
}

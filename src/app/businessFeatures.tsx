import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, ClipboardList, FileDown, MessageCircle, Plus, Search, Share2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import type { CashSaleReturnRecord } from './cashSaleReturns';
import { buildDailyWhatsAppReport, buildWhatsAppShareUrl, createDailyReportPdf, formatDailyWhatsAppReport, formatDemandWhatsAppReport, normalizeWhatsAppRecipient, type DailyWhatsAppReport } from './whatsappSharing';

export type RegularDemandItem = { productId: number; productName: string; requested: number; received: number };
export type RegularDemandRecord = {
  id: string; customer: string; phone: string; notes: string; priority: 'low' | 'normal' | 'high';
  createdAt: string; status: 'pending' | 'partial' | 'completed' | 'cancelled'; items: RegularDemandItem[];
  receipts: { id: string; productId: number; quantity: number; receivedAt: string; receivedBy: string }[];
};
type Product = { id: number; name: string; sku: string; barcode: string; stock: number; price: number };
type Invoice = { id: string; date: string; total: number; paymentMode?: string; paymentMethod?: string; discountAmount?: number; saleType?: string };

const panel = 'rounded-xl border border-border bg-card p-5 shadow-sm';
const control = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30';

export function RegularDemandsView({ demands, setDemands, products, setProducts, actor }: {
  demands: RegularDemandRecord[]; setDemands: (v: RegularDemandRecord[] | ((p: RegularDemandRecord[]) => RegularDemandRecord[])) => void;
  products: Product[]; setProducts: (v: Product[] | ((p: Product[]) => Product[])) => void; actor: string;
}) {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [showForm, setShowForm] = useState(false);
  const [customer, setCustomer] = useState(''); const [phone, setPhone] = useState(''); const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'low'|'normal'|'high'>('normal'); const [lines, setLines] = useState<{productId:number; requested:number}[]>([]);
  const [receipt, setReceipt] = useState<{ demandId: string; productId: number; quantity: number } | null>(null);
  const [receiveQty, setReceiveQty] = useState('1');
  const receivingRef = useRef(false);
  const active = demands.filter(d => d.status === 'pending' || d.status === 'partial');
  const visible = demands.filter(d => (status === 'all' || d.status === status) && `${d.customer} ${d.phone} ${d.items.map(i=>i.productName).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const addLine = () => { const p = products[0]; if (p) setLines(v=>[...v,{productId:p.id,requested:1}]); };
  const saveDemand = () => {
    if (!customer.trim() || !lines.length || lines.some(l=>!Number.isFinite(l.requested)||l.requested<1)) { toast.error('Add a customer and at least one valid product quantity.'); return; }
    const items = [...new Map(lines.map(l=>[l.productId,l])).values()].map(l=>({productId:l.productId,productName:products.find(p=>p.id===l.productId)?.name||'Product',requested:lines.filter(row=>row.productId===l.productId).reduce((sum,row)=>sum+row.requested,0),received:0}));
    setDemands(v=>[{id:crypto.randomUUID(),customer:customer.trim(),phone:phone.trim(),notes:notes.trim(),priority,createdAt:new Date().toISOString(),status:'pending',items,receipts:[]},...v]);
    setCustomer('');setPhone('');setNotes('');setLines([]);setShowForm(false);toast.success('Demand saved.');
  };
  const confirmReceipt = () => {
    if (!receipt || receivingRef.current) return;
    receivingRef.current = true;
    const quantity = Math.floor(Number(receiveQty));
    const demand = demands.find(d=>d.id===receipt.demandId); const item = demand?.items.find(i=>i.productId===receipt.productId);
    if (!demand || !item || quantity < 1 || quantity > item.requested-item.received) { toast.error('Enter a quantity up to the remaining demand.'); receivingRef.current = false; return; }
    const receiptId=crypto.randomUUID(); const receivedAt=new Date().toISOString();
    setProducts(v=>v.map(p=>p.id===receipt.productId?{...p,stock:p.stock+quantity}:p));
    setDemands(v=>v.map(d=>d.id!==demand.id?d:{...d,items:d.items.map(i=>i.productId===receipt.productId?{...i,received:i.received+quantity}:i),receipts:[...d.receipts,{id:receiptId,productId:receipt.productId,quantity,receivedAt,receivedBy:actor}],status:d.items.every(i=>i.productId===receipt.productId?i.received+quantity>=i.requested:i.received>=i.requested)?'completed':'partial'}));
    setReceipt(null);toast.success(`${quantity} received and added to inventory.`);queueMicrotask(()=>{receivingRef.current=false;});
  };
  return <div className="regular-demands-view space-y-5">
    <style>{`@media print{body *{visibility:hidden!important}.regular-demands-view,.regular-demands-view *{visibility:visible!important}.regular-demands-view{position:absolute;inset:0;width:100%;padding:12px}.regular-demands-view button,.regular-demands-view input,.regular-demands-view select,.regular-demands-view textarea{display:none!important}.regular-demands-view details[open] summary{display:none}}`}</style>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Active demands',active.length],['Customers',new Set(active.map(d=>d.phone||d.customer)).size],['Pending items',active.flatMap(d=>d.items).filter(i=>i.received===0).length],['Partially received',active.filter(d=>d.status==='partial').length]].map(([label,value])=><div className={panel} key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
    <div className={panel}>
      <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><input className={`${control} pl-9`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer or product"/></div><select className={control+ ' w-auto'} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="partial">Partially received</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={()=>setShowForm(v=>!v)}><Plus className="h-4 w-4"/>New demand</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>window.print()}><Printer className="mr-2 inline h-4 w-4"/>Export / Print PDF</button></div>
      {showForm&&<div className="mt-5 rounded-xl border bg-muted/30 p-4 space-y-3"><h3 className="font-semibold">New customer demand</h3><div className="grid gap-3 md:grid-cols-3"><input className={control} placeholder="Customer name" value={customer} onChange={e=>setCustomer(e.target.value)}/><input className={control} placeholder="Phone number" value={phone} onChange={e=>setPhone(e.target.value)}/><select className={control} value={priority} onChange={e=>setPriority(e.target.value as typeof priority)}><option value="low">Low priority</option><option value="normal">Normal priority</option><option value="high">High priority</option></select></div>{lines.map((l,index)=><div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]" key={index}><select className={control} value={l.productId} onChange={e=>setLines(v=>v.map((x,i)=>i===index?{...x,productId:Number(e.target.value)}:x))}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · stock {p.stock}</option>)}</select><input type="number" min="1" className={control} value={l.requested} onChange={e=>setLines(v=>v.map((x,i)=>i===index?{...x,requested:Number(e.target.value)}:x))}/><button className="rounded-lg border px-3" onClick={()=>setLines(v=>v.filter((_,i)=>i!==index))}>Remove</button></div>)}<button className="rounded-lg border px-3 py-2 text-sm" onClick={addLine} disabled={!products.length}>Add product</button><textarea className={control} placeholder="Notes" value={notes} onChange={e=>setNotes(e.target.value)}/><div className="flex gap-2"><button onClick={saveDemand} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save demand</button><button onClick={()=>setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div></div>}
      <div className="mt-4 space-y-3">{visible.map(d=><article key={d.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{d.customer} <span className="ml-2 text-xs font-normal text-muted-foreground">{d.phone}</span></h3><p className="mt-1 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()} · {d.priority} priority {d.notes&&`· ${d.notes}`}</p></div><span className="h-fit rounded-full bg-muted px-3 py-1 text-xs capitalize">{d.status}</span></div><div className="mt-3 divide-y">{d.items.map(i=><div key={i.productId} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"><div><strong>{i.productName}</strong><span className="ml-2 text-muted-foreground">Requested {i.requested} · received {i.received} · remaining {i.requested-i.received}</span></div>{i.received<i.requested&&d.status!=='cancelled'&&<button className="rounded-lg border px-3 py-1.5 text-xs font-medium" onClick={()=>{setReceipt({demandId:d.id,productId:i.productId,quantity:i.requested-i.received});setReceiveQty(String(i.requested-i.received));}}>Receive stock</button>}</div>)}</div>{d.receipts.length>0&&<details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Receipt history ({d.receipts.length})</summary>{d.receipts.map(r=><p key={r.id}>{new Date(r.receivedAt).toLocaleString()} · +{r.quantity} · {r.receivedBy}</p>)}</details>}<div className="mt-3 flex gap-2">{d.status!=='completed'&&d.status!=='cancelled'&&<button onClick={()=>setDemands(v=>v.map(x=>x.id===d.id?{...x,status:'cancelled'}:x))} className="text-xs text-red-600">Cancel demand</button>}</div></article>)}{!visible.length&&<p className="py-10 text-center text-sm text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-8 w-8"/>No matching demands.</p>}</div>
    </div>
    {receipt&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl"><h3 className="font-semibold">Confirm stock receipt</h3><p className="mt-2 text-sm text-muted-foreground">Requested {demands.find(d=>d.id===receipt.demandId)?.items.find(i=>i.productId===receipt.productId)?.requested}; previously received {demands.find(d=>d.id===receipt.demandId)?.items.find(i=>i.productId===receipt.productId)?.received}; remaining {receipt.quantity}.</p><label className="mt-4 block text-xs">Newly arrived quantity</label><input className={`${control} mt-1`} type="number" min="1" max={receipt.quantity} value={receiveQty} onChange={e=>setReceiveQty(e.target.value)}/><div className="mt-4 flex justify-end gap-2"><button className="rounded-lg border px-4 py-2 text-sm" onClick={()=>setReceipt(null)}>Back</button><button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={confirmReceipt}>Confirm receipt</button></div></div></div>}
  </div>;
}

export type WhatsAppSettings = { countryCode: string; phone: string; deliveryTime: string; dailyEnabled: boolean; cashSales: boolean; regularDemands: boolean; frequency: 'daily'|'weekly'; };
type ReturnRecord = CashSaleReturnRecord;
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const inr = (amount: number) => `₹${Number(amount || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function WhatsAppReportsView({ settings, setSettings, invoices, demands, returns, shopName }: {
  settings: WhatsAppSettings; setSettings: (v: WhatsAppSettings | ((p:WhatsAppSettings)=>WhatsAppSettings))=>void;
  invoices: (Invoice & { saleType?: string; paidAmount?: number; paymentSplits?: { mode: string; amount: number }[] })[]; demands: RegularDemandRecord[]; returns: ReturnRecord[]; shopName: string;
}) {
  const [reminderDue,setReminderDue]=useState(false);
  const [shareBusy,setShareBusy]=useState(false);
  const reminderDate=useRef('');
  const today=localDateKey();
  const report=useMemo<DailyWhatsAppReport>(()=>buildDailyWhatsAppReport(shopName,today,invoices,returns),[shopName,today,invoices,returns]);
  const update=<K extends keyof WhatsAppSettings,>(key:K,value:WhatsAppSettings[K])=>setSettings(current=>({...current,[key]:value}));
  const openWhatsApp=(message:string)=>{
    try {
      const url=buildWhatsAppShareUrl(settings.phone,message,settings.countryCode);
      window.open(url,'_blank','noopener,noreferrer');
      toast.info('WhatsApp opened with your report. Review it and press Send in WhatsApp.');
    } catch(error) { toast.error(error instanceof Error?error.message:'Enter a valid WhatsApp number.'); }
  };
  const dailyMessage=()=>formatDailyWhatsAppReport(report);
  const demandLines=useMemo(()=>demands.flatMap(demand=>demand.items.map(item=>({
    customer:demand.customer,product:item.productName,requested:item.requested,received:item.received,
    remaining:Math.max(0,item.requested-item.received),status:demand.status,
  }))),[demands]);
  const demandMessage=()=>formatDemandWhatsAppReport(shopName,today,demandLines);
  const downloadDailyPdf=async()=>{
    try { const file=await createDailyReportPdf(report);const url=URL.createObjectURL(file);const anchor=document.createElement('a');anchor.href=url;anchor.download=file.name;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);toast.success('Daily report PDF downloaded.'); }
    catch(error){toast.error(error instanceof Error?error.message:'Could not generate the daily report PDF.');}
  };
  const shareDailyPdf=async()=>{
    setShareBusy(true);
    try {
      const file=await createDailyReportPdf(report);
      if(!navigator.share||!navigator.canShare?.({files:[file]})){toast.error('PDF sharing is not supported on this device. Download the PDF and attach it in WhatsApp.');return;}
      await navigator.share({files:[file],title:`Daily cash report - ${shopName}`,text:`Daily cash report for ${today}`});
    } catch(error){if(error instanceof Error&&error.name==='AbortError')return;toast.error(error instanceof Error?error.message:'Could not share the PDF.');}
    finally{setShareBusy(false);}
  };
  useEffect(()=>{
    if(!settings.dailyEnabled)return;
    const checkReminder=()=>{
      const now=new Date();const day=localDateKey(now);const [hours,minutes]=settings.deliveryTime.split(':').map(Number);
      if(now.getHours()!==hours||now.getMinutes()!==minutes||reminderDate.current===day)return;
      reminderDate.current=day;setReminderDue(true);
      if('Notification'in window&&Notification.permission==='granted'){
        const notification=new Notification('Dukan Yantra daily report',{body:'Your cash-sale report is ready. Open WhatsApp to review and send it.'});
        notification.onclick=()=>{window.focus();openWhatsApp(dailyMessage());};
      }
    };
    checkReminder();const timer=window.setInterval(checkReminder,15000);return()=>window.clearInterval(timer);
  },[settings.dailyEnabled,settings.deliveryTime,report]);
  const requestNotificationPermission=async()=>{
    if(!('Notification'in window)){toast.error('Notifications are not available in this app environment. Keep Dukan Yantra open for the in-app reminder.');return;}
    const permission=await Notification.requestPermission();
    if(permission==='granted')toast.success('Daily report reminders are enabled.');
    else toast.info('Notification permission was not granted. In-app reminders remain available while this page is open.');
  };
  const next=new Date();const [h,m]=settings.deliveryTime.split(':').map(Number);next.setHours(h||0,m||0,0,0);if(next<=new Date())next.setDate(next.getDate()+1);
  const configuredNumber=(()=>{try{return settings.phone?`+${normalizeWhatsAppRecipient(settings.phone,settings.countryCode)}`:'Not configured';}catch{return 'Invalid number';}})();
  return <div className="space-y-5">
    {reminderDue&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"><div><p className="font-semibold">Daily report reminder</p><p className="text-sm text-muted-foreground">Your report is ready. WhatsApp will open with the message; you must press Send.</p></div><button onClick={()=>openWhatsApp(dailyMessage())} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Open WhatsApp report</button></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className={panel}><p className="text-xs text-muted-foreground">Sharing</p><p className="mt-2 text-lg font-semibold">Personal WhatsApp Sharing</p></div>
      <div className={panel}><p className="text-xs text-muted-foreground">Configured number</p><p className="mt-2 text-lg font-semibold">{configuredNumber}</p></div>
      <div className={panel}><p className="text-xs text-muted-foreground">Daily report</p><p className="mt-2 text-lg font-semibold">{settings.dailyEnabled?'Reminder enabled':'Disabled'}</p></div>
      <div className={panel}><p className="text-xs text-muted-foreground">Next reminder</p><p className="mt-2 text-lg font-semibold">{settings.dailyEnabled?next.toLocaleString():'—'}</p></div>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className={`${panel} space-y-4`}>
        <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-green-600"/><h2 className="font-semibold">Personal WhatsApp settings</h2></div>
        <div className="grid grid-cols-[120px_1fr] gap-3"><select className={control} value={settings.countryCode} onChange={event=>update('countryCode',event.target.value)}><option value="+91">India +91</option><option value="+1">US +1</option><option value="+44">UK +44</option><option value="+971">UAE +971</option></select><input className={control} placeholder="Shop WhatsApp number" value={settings.phone} onChange={event=>update('phone',event.target.value)}/></div>
        <label className="flex items-center justify-between text-sm">Daily report reminder <input type="checkbox" checked={settings.dailyEnabled} onChange={event=>update('dailyEnabled',event.target.checked)}/></label>
        <label className="block text-xs">Report delivery time<input className={`${control} mt-1`} type="time" value={settings.deliveryTime} onChange={event=>update('deliveryTime',event.target.value)}/></label>
        <div className="flex flex-wrap gap-2"><button disabled={!settings.phone} onClick={()=>openWhatsApp(dailyMessage())} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Send Daily Report</button><button disabled={!settings.phone} onClick={()=>openWhatsApp(demandMessage())} className="rounded-lg border px-4 py-2 text-sm">Send Demand List</button><button disabled={shareBusy} onClick={()=>void shareDailyPdf()} className="rounded-lg border px-4 py-2 text-sm"><Share2 className="mr-2 inline h-4 w-4"/>Share PDF</button><button onClick={()=>void downloadDailyPdf()} className="rounded-lg border px-4 py-2 text-sm"><FileDown className="mr-2 inline h-4 w-4"/>Download Daily PDF</button></div>
        <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">Reminder schedule</p><p className="mt-1 text-muted-foreground">The reminder runs while the WhatsApp Reports page is open. It prepares a WhatsApp message; you must review and press Send. It does not send automatically.</p>{settings.dailyEnabled&&'Notification'in window&&Notification.permission!=='granted'&&<button onClick={()=>void requestNotificationPermission()} className="mt-2 text-primary underline">Enable device notification</button>}</div>
      </section>
      <section className={`${panel} space-y-4`}>
        <h2 className="font-semibold">Today’s cash-sale summary</h2>
        <div className="grid grid-cols-2 gap-3">{[['Total sales',report.totalSales],['Cash collected',report.cashCollected],['Cash transactions',report.transactions],['Discounts',report.discounts],['Returns / refunds',report.returns]].map(([label,value])=><div key={String(label)} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{typeof value==='number'?inr(value):value}</p></div>)}</div>
        <h3 className="border-t pt-3 text-sm font-semibold">Regular demand lines ({demandLines.length})</h3>
        <div className="max-h-72 space-y-2 overflow-auto">{demandLines.map((line,index)=><div key={`${line.customer}-${line.product}-${index}`} className="rounded-lg border p-3 text-xs"><p className="font-medium">{line.customer} · {line.product}</p><p className="mt-1 text-muted-foreground">Requested {line.requested} · Received {line.received} · Remaining {line.remaining}</p></div>)}{!demandLines.length&&<p className="text-sm text-muted-foreground">No demand records.</p>}</div>
      </section>
    </div>
  </div>;
}

import type { Tab } from './App';

export function pathToShopkeeperTab(pathname: string): Tab {
  if (pathname.startsWith('/shopkeeper/barcode')) return 'barcode';
  if (pathname.startsWith('/shopkeeper/regular-demands')) return 'regular_demands';
  if (pathname.startsWith('/shopkeeper/whatsapp-reports')) return 'whatsapp_reports';
  if (pathname.includes('/shopkeeper/billing')) return 'cashsale';
  if (pathname === '/shopkeeper/invoice' || pathname.startsWith('/shopkeeper/invoice/')) return 'invoice';
  if (pathname.startsWith('/shopkeeper/fulfillment')) return 'local_orders';
  if (pathname.includes('/shopkeeper/local/products')) return 'local_products';
  if (pathname.includes('/shopkeeper/local/orders')) return 'local_orders';
  if (pathname.includes('/shopkeeper/local')) return 'local_dashboard';
  if (pathname.includes('/shopkeeper/products')) return 'inventory';
  if (pathname.includes('/shopkeeper/inventory')) return 'inventory';
  if (pathname.includes('/shopkeeper/customers')) return 'customers';
  if (pathname.includes('/shopkeeper/invoices')) return 'invoices';
  if (pathname.includes('/shopkeeper/purchases')) return 'demand';
  if (pathname.includes('/shopkeeper/pos-devices')) return 'posdevices';
  if (pathname.includes('/shopkeeper/reminders')) return 'reminders';
  if (pathname.includes('/shopkeeper/party-rates')) return 'rates';
  if (pathname.includes('/shopkeeper/bulk-update')) return 'bulk';
  if (pathname.includes('/shopkeeper/backup')) return 'backup';
  if (pathname.includes('/shopkeeper/reports')) return 'reports';
  if (pathname.includes('/shopkeeper/sync')) return 'sync';
  if (pathname.includes('/shopkeeper/gst')) return 'gst';
  if (pathname.includes('/shopkeeper/ppi')) return 'ppi';
  if (pathname.includes('/shopkeeper/profile')) return 'profile';
  if (pathname.includes('/shopkeeper/settings')) return 'settings';
  return 'dashboard';
}

export function shopkeeperTabToPath(tab: Tab): string {
  switch (tab) {
    case 'cashsale': return '/shopkeeper/billing';
    case 'invoice': return '/shopkeeper/invoice';
    case 'inventory': return '/shopkeeper/inventory';
    case 'barcode': return '/shopkeeper/barcode';
    case 'regular_demands': return '/shopkeeper/regular-demands';
    case 'whatsapp_reports': return '/shopkeeper/whatsapp-reports';
    case 'customers': return '/shopkeeper/customers';
    case 'invoices': return '/shopkeeper/invoices';
    case 'local_dashboard': return '/shopkeeper/local';
    case 'local_products': return '/shopkeeper/local/products';
    case 'local_orders': return '/shopkeeper/fulfillment';
    case 'settings': return '/shopkeeper/settings';
    case 'demand': return '/shopkeeper/purchases';
    case 'posdevices': return '/shopkeeper/pos-devices';
    case 'reminders': return '/shopkeeper/reminders';
    case 'rates': return '/shopkeeper/party-rates';
    case 'bulk': return '/shopkeeper/bulk-update';
    case 'backup': return '/shopkeeper/backup';
    case 'reports': return '/shopkeeper/reports';
    case 'sync': return '/shopkeeper/sync';
    case 'gst': return '/shopkeeper/gst';
    case 'ppi': return '/shopkeeper/ppi';
    case 'profile': return '/shopkeeper/profile';
    default: return '/shopkeeper/dashboard';
  }
}

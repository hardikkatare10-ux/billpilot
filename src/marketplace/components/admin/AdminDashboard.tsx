/**
 * BillPilot Local - Marketplace Administrator Control Center
 * 
 * Provides administrative governance over shop verification, dispute resolution,
 * commission settlements, system audit logs, and global ERP synchronization.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Store,
  FileText,
  AlertTriangle,
  DollarSign,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  MapPin,
  ClipboardCheck,
  Clock,
} from 'lucide-react';
import {
  AuditLogEntry,
  BillPilotSyncEvent,
  CommissionLedgerEntry,
  Order,
  ReturnComplaintRequest,
  Shop,
} from '../../types';
import { formatINR } from '../../utils/formatters';
import { dbStore } from '../../services/db/store';
import { InvoiceModal } from '../common/InvoiceModal';
import { AreaDirectoryAdmin } from './AreaDirectoryAdmin';

interface AdminDashboardProps {
  shops: Shop[];
  orders: Order[];
  disputes: ReturnComplaintRequest[];
  syncEvents: BillPilotSyncEvent[];
  auditLogs: AuditLogEntry[];
  commissionLedger: CommissionLedgerEntry[];
  onRefreshData: () => void;
  onShopStatusChange?: (
    shopId: string,
    status: Shop['verificationStatus'],
    notes?: string
  ) => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  shops,
  orders,
  disputes,
  syncEvents,
  auditLogs,
  commissionLedger,
  onRefreshData,
  onShopStatusChange,
}) => {
  const [activeTab, setActiveTab] = useState<
    'applications' | 'shops' | 'areas' | 'orders' | 'disputes' | 'commissions' | 'sync' | 'audit'
  >('applications');
  const [processingShopId, setProcessingShopId] = useState<string | null>(null);

  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [arbitrateModal, setArbitrateModal] = useState<{
    dispute: ReturnComplaintRequest;
    action: 'approve_refund' | 'reject' | 'replace';
  } | null>(null);
  const [arbitrationNotes, setArbitrationNotes] = useState('');

  // Top-level financial totals
  const totalGMV = orders
    .filter((o) => o.status === 'delivered')
    .reduce((acc, o) => acc + o.totalAmount, 0);

  const totalCommissions = commissionLedger.reduce(
    (acc, c) => acc + c.commissionAmount,
    0
  );

  const verifiedShopsCount = shops.filter((s) => s.verificationStatus === 'verified').length;
  const pendingShops = shops.filter((s) => s.verificationStatus === 'pending');
  const pendingDisputesCount = disputes.filter(
    (d) => d.status === 'submitted' || d.status === 'under_review'
  ).length;

  const handleShopStatusChange = async (
    shopId: string,
    status: Shop['verificationStatus'],
    notes?: string
  ): Promise<boolean> => {
    try {
      if (onShopStatusChange) {
        await onShopStatusChange(shopId, status, notes);
      } else {
        dbStore.updateShopVerification(shopId, status, 'admin_operations', notes);
      }
      onRefreshData();
      return true;
    } catch (err) {
      console.error('Shop status change failed:', err);
      alert(
        'Could not update the shop in the cloud: ' +
          (err instanceof Error ? err.message : String(err))
      );
      return false;
    }
  };

  const processShopApplication = async (
    shopId: string,
    status: 'verified' | 'rejected'
  ) => {
    if (status === 'rejected' && !window.confirm('Reject this shopkeeper application?')) {
      return;
    }
    setProcessingShopId(shopId);
    try {
      await handleShopStatusChange(
        shopId,
        status,
        status === 'verified' ? 'Shopkeeper application approved by admin' : 'Shopkeeper application rejected by admin'
      );
    } finally {
      setProcessingShopId(null);
    }
  };

  const handleExecuteArbitration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!arbitrateModal) return;

    dbStore.arbitrateReturnComplaint(
      arbitrateModal.dispute.id,
      arbitrateModal.action,
      'admin_operations',
      arbitrationNotes || 'Resolution finalized by marketplace admin'
    );

    setArbitrateModal(null);
    setArbitrationNotes('');
    onRefreshData();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Marketplace Control Console</h1>
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded">
              Platform Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            System governance for merchant verification, consumer dispute arbitration, and financial commissions.
          </p>
        </div>

        <button
          onClick={onRefreshData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Store Engine
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            Delivered GMV
          </span>
          <span className="text-xl font-extrabold text-slate-900 font-tabular mt-1 block">
            {formatINR(totalGMV)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Customer gross purchases</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            Platform Earnings
          </span>
          <span className="text-xl font-extrabold text-emerald-700 font-tabular mt-1 block">
            {formatINR(totalCommissions)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Configured 5% platform fee</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            Verified Stores
          </span>
          <span className="text-xl font-extrabold text-slate-900 font-tabular mt-1 block">
            {verifiedShopsCount} / {shops.length}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Active local sellers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            Pending Disputes
          </span>
          <span className="text-xl font-extrabold text-rose-700 font-tabular mt-1 block">
            {pendingDisputesCount}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Requires platform review</span>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none text-xs">
        {[
          { key: 'applications', label: `Shopkeeper Requests (${pendingShops.length})`, icon: ClipboardCheck },
          { key: 'shops', label: `Shops & KYC (${shops.length})`, icon: Store },
          { key: 'areas', label: `Area Directory (${dbStore.getAreas().length})`, icon: MapPin },
          { key: 'orders', label: `All Orders (${orders.length})`, icon: FileText },
          { key: 'disputes', label: `Disputes & Returns (${disputes.length})`, icon: AlertTriangle },
          { key: 'commissions', label: 'Commission Ledger', icon: DollarSign },
          { key: 'sync', label: `BillPilot Sync (${syncEvents.length})`, icon: Activity },
          { key: 'audit', label: `Audit Logs (${auditLogs.length})`, icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Pending shopkeeper applications */}
      {activeTab === 'applications' && (
        <section className="space-y-4" aria-labelledby="shopkeeper-requests-heading">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="shopkeeper-requests-heading" className="text-lg font-bold text-slate-900">
                Shopkeeper Applications
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Review the submitted store details, then approve or reject each pending request.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              {pendingShops.length} pending
            </span>
          </div>

          {pendingShops.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
              <ClipboardCheck className="mx-auto h-10 w-10 text-emerald-500" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">No requests awaiting review</h3>
              <p className="mt-1 text-xs text-slate-500">
                New shopkeeper applications will appear here after registration.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {pendingShops.map((shop) => (
                <article key={shop.id} className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-amber-50/60 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                        <Store className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900">{shop.name}</h3>
                        <p className="mt-0.5 text-xs text-slate-600">{shop.category}</p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">
                      <Clock className="h-3 w-3" />
                      Pending
                    </span>
                  </div>

                  <div className="space-y-3 p-4 text-xs">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Owner</dt>
                        <dd className="mt-0.5 font-semibold text-slate-900">{shop.ownerName}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Phone</dt>
                        <dd className="mt-0.5 font-semibold text-slate-900">{shop.phone || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Email</dt>
                        <dd className="mt-0.5 break-all font-semibold text-slate-900">{shop.email || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Location</dt>
                        <dd className="mt-0.5 font-semibold text-slate-900">
                          {[shop.address.locality, shop.address.city, shop.address.pincode].filter(Boolean).join(', ') || 'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">GSTIN</dt>
                        <dd className="mt-0.5 font-mono font-semibold text-slate-900">{shop.verificationDetails?.gstin || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Trade License</dt>
                        <dd className="mt-0.5 font-mono font-semibold text-slate-900">{shop.verificationDetails?.tradeLicenseNo || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Applied</dt>
                        <dd className="mt-0.5 font-semibold text-slate-900">
                          {new Date(shop.createdAt).toLocaleDateString('en-IN')}
                        </dd>
                      </div>
                    </dl>
                    {shop.description && (
                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-slate-500">Store description</p>
                        <p className="mt-1 whitespace-pre-wrap text-slate-700">{shop.description}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      disabled={processingShopId === shop.id}
                      onClick={() => processShopApplication(shop.id, 'rejected')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      {processingShopId === shop.id ? 'Updating...' : 'Reject request'}
                    </button>
                    <button
                      type="button"
                      disabled={processingShopId === shop.id}
                      onClick={() => processShopApplication(shop.id, 'verified')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {processingShopId === shop.id ? 'Updating...' : 'Approve shopkeeper'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 1: Shops & Verification */}
      {activeTab === 'shops' && (
        <div className="space-y-4">
          {shops.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
              <Store className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">No merchant shops registered yet</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Neighborhood retailers can onboard using the &quot;Register Shop&quot; button in the header or discovery page.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Shop & Owner</th>
                    <th className="py-3 px-4">Locality</th>
                    <th className="py-3 px-4">License / GSTIN</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{shop.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {shop.ownerName} · {shop.phone}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {shop.address.locality}, {shop.address.city}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {shop.verificationDetails?.gstin || 'GSTIN Pending'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            shop.verificationStatus === 'verified'
                              ? 'bg-emerald-50 text-emerald-700'
                              : shop.verificationStatus === 'suspended'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {shop.verificationStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {shop.verificationStatus !== 'verified' ? (
                          <button
                            onClick={() => handleShopStatusChange(shop.id, 'verified', 'Verified by Admin')}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                          >
                            Approve Store
                          </button>
                        ) : (
                          <button
                            onClick={() => handleShopStatusChange(shop.id, 'suspended', 'Suspended for inspection')}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
                          >
                            Suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: Area Directory & Coverage */}
      {activeTab === 'areas' && (
        <AreaDirectoryAdmin onRefresh={onRefreshData} />
      )}

      {/* TAB 2: Marketplace Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">No marketplace orders placed yet</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Orders placed by customers across local shops will be aggregated here for administrative tracking.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Store</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-right">Order Total</th>
                    <th className="py-3 px-4 text-right">Platform Fee (5%)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {o.orderNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{o.shopName}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {o.customerName}
                        <span className="text-[10px] text-slate-400 block">{o.customerPhone}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatINR(o.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                        {formatINR(o.platformCommission)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize text-[11px] font-semibold text-slate-700">
                          {o.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {o.invoice && (
                          <button
                            onClick={() => setSelectedInvoiceOrder(o)}
                            className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                          >
                            Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Disputes & Returns Arbitration */}
      {activeTab === 'disputes' && (
        <div className="space-y-4">
          {disputes.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
              <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">No active customer disputes</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Customer return requests, product damaged claims, and shop complaints will appear here for resolution.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {disputes.map((d) => (
                <div
                  key={d.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">Order #{d.orderNumber}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">Store: {d.shopName}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">Customer: {d.customerName}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        d.status === 'approved' || d.status === 'refunded'
                          ? 'bg-emerald-50 text-emerald-700'
                          : d.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-800">
                      Reason: <span className="capitalize">{d.reason.replace(/_/g, ' ')}</span>
                    </p>
                    <p className="text-slate-600 mt-1">{d.description}</p>
                  </div>

                  {d.photoEvidenceUrls.length > 0 && (
                    <div className="flex gap-2 pt-1">
                      {d.photoEvidenceUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Evidence"
                          className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                        />
                      ))}
                    </div>
                  )}

                  {d.adminDecision && (
                    <p className="p-2.5 bg-blue-50 text-blue-800 rounded-lg text-xs font-medium">
                      Admin Decision: {d.adminDecision}
                    </p>
                  )}

                  {d.status === 'submitted' && (
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() =>
                          setArbitrateModal({ dispute: d, action: 'reject' })
                        }
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                      >
                        Reject Claim
                      </button>
                      <button
                        onClick={() =>
                          setArbitrateModal({ dispute: d, action: 'approve_refund' })
                        }
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg cursor-pointer"
                      >
                        Authorize Full Refund
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Commission Ledger */}
      {activeTab === 'commissions' && (
        <div className="space-y-4">
          {commissionLedger.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
              <DollarSign className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">No commission settlements recorded</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                As delivered customer orders are fulfilled by shops, marketplace commission ledgers will be generated here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Store Name</th>
                    <th className="py-3 px-4 text-right">Gross Total</th>
                    <th className="py-3 px-4 text-right">Commission Rate</th>
                    <th className="py-3 px-4 text-right">Platform Fee</th>
                    <th className="py-3 px-4 text-right">Net Shop Payout</th>
                    <th className="py-3 px-4 text-center">Settlement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commissionLedger.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">{c.orderId}</td>
                      <td className="py-3 px-4 text-slate-800">{c.shopName}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatINR(c.orderTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {c.commissionRatePct}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {formatINR(c.commissionAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatINR(c.netShopEarnings)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold uppercase">
                          {c.payoutStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BillPilot Sync Ledger */}
      {activeTab === 'sync' && (
        <div className="space-y-4">
          {syncEvents.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
              <Activity className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">No ERP sync logs recorded</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Inventory synchronization and invoice push events between BillPilot Local and BillPilot ERP will appear here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Event ID</th>
                    <th className="py-3 px-4">Store</th>
                    <th className="py-3 px-4">Direction & Action</th>
                    <th className="py-3 px-4">Payload Summary</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {syncEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">{ev.id}</td>
                      <td className="py-3 px-4 font-mono">{ev.shopId}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 capitalize">
                          {ev.syncType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {ev.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-sm">{ev.payloadSummary}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ev.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {ev.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                        {new Date(ev.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: System Audit Logs */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {auditLogs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">No system audit records</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                All security events, price alterations, shop status changes, and order state transitions are logged here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{log.actorName}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Role: {log.actorRole}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-700 font-semibold">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {log.targetEntity}:{log.targetId}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-sm">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Arbitration Modal */}
      {arbitrateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleExecuteArbitration}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-slate-900">
              Arbitrate Dispute for Order #{arbitrateModal.dispute.orderNumber}
            </h3>
            <p className="text-slate-600">
              Action: <strong className="uppercase text-blue-600">{arbitrateModal.action}</strong>
            </p>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Official Decision Notes (Audited)
              </label>
              <textarea
                required
                rows={3}
                placeholder="State basis for decision..."
                value={arbitrationNotes}
                onChange={(e) => setArbitrationNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setArbitrateModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg cursor-pointer"
              >
                Execute Arbitration
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedInvoiceOrder && (
        <InvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}
    </div>
  );
};

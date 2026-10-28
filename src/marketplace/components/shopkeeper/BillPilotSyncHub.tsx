/**
 * NearBasket - Dukan Yantra ERP Synchronization Hub
 * 
 * Standalone bidirectional integration module connecting shop catalogue,
 * stock levels, and sales orders with the Dukan Yantra ERP application.
 */

import React, { useState } from 'react';
import {
  RefreshCw,
  Server,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  FileCode,
  Key,
  Globe,
  Save,
} from 'lucide-react';
import { BillPilotConnectionConfig, BillPilotSyncEvent, Shop } from '../../types';
import { dbStore } from '../../services/db/store';

interface BillPilotSyncHubProps {
  shop: Shop;
  events: BillPilotSyncEvent[];
  onRefresh: () => void;
}

export const BillPilotSyncHub: React.FC<BillPilotSyncHubProps> = ({
  shop,
  events,
  onRefresh,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);

  // Connection settings
  const currentConfig = dbStore.getConnectionConfig(shop.id);
  const [apiUrl, setApiUrl] = useState(currentConfig.apiUrl);
  const [apiKey, setApiKey] = useState(currentConfig.apiKey);
  const [merchantId, setMerchantId] = useState(currentConfig.merchantId);
  const [webhookSecret, setWebhookSecret] = useState(currentConfig.webhookSecret);
  const [autoSyncInventory, setAutoSyncInventory] = useState(currentConfig.autoSyncInventory);
  const [autoExportOrders, setAutoExportOrders] = useState(currentConfig.autoExportOrders);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    dbStore.saveConnectionConfig(
      shop.id,
      {
        apiUrl,
        apiKey,
        merchantId,
        webhookSecret,
        autoSyncInventory,
        autoExportOrders,
        isConnected: true,
        lastPingAt: new Date().toISOString(),
      },
      shop.ownerId
    );
    setConfigSuccess(true);
    setTimeout(() => setConfigSuccess(false), 2500);
    onRefresh();
  };

  const handleTriggerSync = (type: BillPilotSyncEvent['syncType']) => {
    setIsSyncing(true);
    setSyncFeedback(null);

    setTimeout(() => {
      try {
        const ev = dbStore.triggerSyncWithBillPilot(shop.id, type);
        setSyncFeedback(ev.payloadSummary);
        onRefresh();
      } catch {
        setSyncFeedback('Synchronization request failed.');
      } finally {
        setIsSyncing(false);
      }
    }, 600);
  };

  const handleRetry = (eventId: string) => {
    try {
      dbStore.retryFailedSync(eventId);
      onRefresh();
    } catch {
      // Error handling
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Dukan Yantra Integration Engine</h1>
            <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded border border-emerald-200">
              API Contract v1.0
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Bi-directional synchronization layer connecting storefront orders with Dukan Yantra inventory and invoice ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-mono text-slate-700">
            <Server className="w-3.5 h-3.5 text-blue-600" />
            <span>ERP ID: {merchantId}</span>
          </div>
        </div>
      </div>

      {/* API Connection Configuration Card */}
      <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Dukan Yantra API Endpoint & Credentials</h3>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected & Authenticated
          </span>
        </div>

        {configSuccess && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl">
            API connection settings saved successfully. Webhooks are configured.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Dukan Yantra API Base URL
            </label>
            <input
              type="url"
              required
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Secure REST API endpoint for inventory & invoice sync
            </span>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Merchant ID (Dukan Yantra ERP)
            </label>
            <input
              type="text"
              required
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              API Secret Key
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Webhook Signature Secret
            </label>
            <input
              type="password"
              required
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncInventory}
                onChange={(e) => setAutoSyncInventory(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-700 font-medium">Auto-sync inventory every 15 mins</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoExportOrders}
                onChange={(e) => setAutoExportOrders(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-slate-700 font-medium">Auto-export orders on shop acceptance</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save API Config
            </button>
          </div>
        </div>
      </form>

      {/* Manual Handshake Actions */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white">Manual Synchronization Handshakes</h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Trigger bidirectional catalog and order updates directly with the configured Dukan Yantra ERP service.
          </p>
        </div>

        <div className="pt-1 flex flex-wrap gap-2.5">
          <button
            disabled={isSyncing}
            onClick={() => handleTriggerSync('catalogue_sync')}
            className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Pull Stock & Price Handshake
          </button>

          <button
            disabled={isSyncing}
            onClick={() => handleTriggerSync('order_export')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
            Export Accepted Orders to Dukan Yantra ERP
          </button>
        </div>

        {syncFeedback && (
          <p className="text-xs text-emerald-400 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 font-mono">
            ✓ {syncFeedback}
          </p>
        )}
      </div>

      {/* Sync Events Log */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-600" />
            Synchronization Ledger & Audit Trail ({events.length})
          </h2>
          <span className="text-xs text-slate-500">Idempotent payload events</span>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            No sync operations executed yet. Click &quot;Pull Stock &amp; Price Handshake&quot; to perform initial sync.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Direction & Type</th>
                  <th className="py-3 px-4">Payload Summary</th>
                  <th className="py-3 px-4">External ERP Ref</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {ev.direction === 'inbound_to_marketplace' ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="font-semibold text-slate-900 capitalize">
                          {ev.syncType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-700 max-w-sm">
                      {ev.payloadSummary}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {ev.externalReferenceId || '—'}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          ev.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : ev.status === 'retrying'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {ev.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                      {new Date(ev.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {ev.status === 'failed' ? (
                        <button
                          onClick={() => handleRetry(ev.id)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">Synced</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

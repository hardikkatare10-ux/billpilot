/**
 * NearBasket - Area Directory & Coverage Admin Console
 * 
 * Provides full administrative CRUD, area merging, duplicate prevention,
 * bulk CSV/JSON import with validation preview, and customer locality request reviews.
 */

import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Search,
  Plus,
  Upload,
  Merge,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  FileText,
  Building,
  Check,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { AreaRecord, AreaRequest, AreaLevel, AreaStatus } from '../../types';
import { dbStore } from '../../services/db/store';
import { parseAreaCSV, parseAreaJSON } from '../../utils/geo';

interface AreaDirectoryAdminProps {
  onRefresh: () => void;
}

export const AreaDirectoryAdmin: React.FC<AreaDirectoryAdminProps> = ({ onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | 'active' | 'inactive'>('All');
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'requests'>('directory');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaRecord | null>(null);
  const [mergingSourceArea, setMergingSourceArea] = useState<AreaRecord | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Add/Edit Form State
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('Bengaluru');
  const [formState, setFormState] = useState('Karnataka');
  const [formCountry, setFormCountry] = useState('India');
  const [formPincode, setFormPincode] = useState('');
  const [formLevel, setFormLevel] = useState<AreaLevel>('locality');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formAliases, setFormAliases] = useState('');
  const [formLat, setFormLat] = useState<number>(12.9716);
  const [formLng, setFormLng] = useState<number>(77.5946);
  const [formError, setFormError] = useState<string | null>(null);

  // Merge State
  const [targetMergeAreaId, setTargetMergeAreaId] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Bulk Import State
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');
  const [importText, setImportText] = useState('');
  const [previewRecords, setPreviewRecords] = useState<Omit<AreaRecord, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Load latest database state
  const areas = dbStore.getAreas();
  const cities = dbStore.getCities();
  const areaRequests = dbStore.getAreaRequests();
  const pendingRequestsCount = areaRequests.filter((r) => r.status === 'pending').length;

  // Filtered areas
  const filteredAreas = useMemo(() => {
    return areas.filter((area) => {
      if (selectedCityFilter !== 'All' && area.city.toLowerCase() !== selectedCityFilter.toLowerCase()) {
        return false;
      }
      if (selectedStatusFilter !== 'All' && area.status !== selectedStatusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = area.name.toLowerCase().includes(q);
        const matchesCity = area.city.toLowerCase().includes(q);
        const matchesPin = area.pincode.includes(q);
        const matchesAlias = area.aliases.some((a) => a.toLowerCase().includes(q));
        if (!matchesName && !matchesCity && !matchesPin && !matchesAlias) return false;
      }
      return true;
    });
  }, [areas, selectedCityFilter, selectedStatusFilter, searchQuery]);

  // Open Add Modal
  const openAddModal = (presetCity?: string, presetLocality?: string, presetPin?: string) => {
    setEditingArea(null);
    setFormName(presetLocality || '');
    setFormCity(presetCity || (cities.length > 0 ? cities[0] : 'Bengaluru'));
    setFormState('Karnataka');
    setFormCountry('India');
    setFormPincode(presetPin || '');
    setFormLevel('locality');
    setFormParentId('');
    setFormAliases('');
    setFormLat(12.9716);
    setFormLng(77.5946);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (area: AreaRecord) => {
    setEditingArea(area);
    setFormName(area.name);
    setFormCity(area.city);
    setFormState(area.state);
    setFormCountry(area.country);
    setFormPincode(area.pincode);
    setFormLevel(area.level);
    setFormParentId(area.parentAreaId || '');
    setFormAliases(area.aliases.join(', '));
    setFormLat(area.coordinates.latitude);
    setFormLng(area.coordinates.longitude);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCity.trim() || !formPincode.trim()) {
      setFormError('Name, city, and pincode are required.');
      return;
    }

    const aliases = formAliases
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingArea) {
        dbStore.updateArea(
          editingArea.id,
          {
            name: formName.trim(),
            city: formCity.trim(),
            state: formState.trim(),
            country: formCountry.trim(),
            pincode: formPincode.trim(),
            level: formLevel,
            parentAreaId: formParentId || undefined,
            aliases,
            coordinates: { latitude: Number(formLat), longitude: Number(formLng) },
          },
          'admin_console'
        );
      } else {
        dbStore.createArea(
          {
            name: formName.trim(),
            city: formCity.trim(),
            state: formState.trim(),
            country: formCountry.trim(),
            pincode: formPincode.trim(),
            level: formLevel,
            parentAreaId: formParentId || undefined,
            aliases,
            coordinates: { latitude: Number(formLat), longitude: Number(formLng) },
            status: 'active',
          },
          'admin_console'
        );
      }

      setIsAddModalOpen(false);
      onRefresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error saving area record');
    }
  };

  const handleToggleStatus = (area: AreaRecord) => {
    if (area.status === 'active') {
      dbStore.deactivateArea(area.id, 'admin_console');
    } else {
      dbStore.updateArea(area.id, { status: 'active' }, 'admin_console');
    }
    onRefresh();
  };

  const handleExecuteMerge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergingSourceArea || !targetMergeAreaId) return;

    try {
      dbStore.mergeAreas(mergingSourceArea.id, targetMergeAreaId, 'admin_console');
      setMergingSourceArea(null);
      setTargetMergeAreaId('');
      setMergeError(null);
      onRefresh();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Error merging area');
    }
  };

  const handleValidateBulk = () => {
    if (!importText.trim()) {
      setPreviewErrors(['Please paste or input data to validate.']);
      return;
    }

    setImportResult(null);
    if (importFormat === 'csv') {
      const res = parseAreaCSV(importText);
      setPreviewRecords(res.validRecords);
      setPreviewErrors(res.errors);
    } else {
      const res = parseAreaJSON(importText);
      setPreviewRecords(res.validRecords);
      setPreviewErrors(res.errors);
    }
  };

  const handleCommitBulkImport = () => {
    if (previewRecords.length === 0) return;
    const res = dbStore.bulkImportAreas(previewRecords, 'admin_console');
    setImportResult({ imported: res.imported, skipped: res.skipped });
    setPreviewRecords([]);
    setImportText('');
    onRefresh();
  };

  const handleApproveRequest = (req: AreaRequest) => {
    dbStore.updateAreaRequestStatus(req.id, 'approved', 'Approved and onboarding into Area Directory');
    openAddModal(req.city, req.localityName, req.pincode);
  };

  const handleRejectRequest = (req: AreaRequest) => {
    dbStore.updateAreaRequestStatus(req.id, 'rejected', 'Outside serviceable limits');
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Sub-Tabs: Area Directory vs. Customer Requests */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('directory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeSubTab === 'directory'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Verified Area Directory ({areas.length})
          </button>
          <button
            onClick={() => setActiveSubTab('requests')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'requests'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>Customer Locality Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[10px] rounded-full font-bold">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>

        {activeSubTab === 'directory' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setImportText('');
                setPreviewRecords([]);
                setPreviewErrors([]);
                setImportResult(null);
                setIsBulkImportOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Bulk CSV/JSON Import</span>
            </button>
            <button
              onClick={() => openAddModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Locality</span>
            </button>
          </div>
        )}
      </div>

      {/* SUB-TAB 1: Area Directory Table */}
      {activeSubTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search area by name, city, pincode, or alias..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                <span className="text-[11px] text-slate-500">City:</span>
                <select
                  value={selectedCityFilter}
                  onChange={(e) => setSelectedCityFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Cities</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                <span className="text-[11px] text-slate-500">Status:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value as typeof selectedStatusFilter)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Areas Table */}
          {filteredAreas.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">No area records match criteria</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Use &quot;Add New Locality&quot; or &quot;Bulk CSV/JSON Import&quot; to index neighborhoods.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Locality & Level</th>
                      <th className="py-3 px-4">City / State</th>
                      <th className="py-3 px-4">Pincode</th>
                      <th className="py-3 px-4">Aliases & Landmarks</th>
                      <th className="py-3 px-4">Coordinates</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAreas.map((area) => {
                      const isSubLocality = area.level === 'sub_locality';
                      const parentArea = area.parentAreaId ? areas.find((a) => a.id === area.parentAreaId) : null;

                      return (
                        <tr key={area.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {isSubLocality && <span className="text-slate-300 ml-2">↳</span>}
                              <div>
                                <p className="font-bold text-slate-900">{area.name}</p>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {area.level.replace(/_/g, ' ')}
                                  {parentArea && ` (under ${parentArea.name})`}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {area.city}, {area.state}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-800">
                            {area.pincode}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {area.aliases.length > 0 ? area.aliases.join(', ') : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {area.coordinates.latitude.toFixed(4)}, {area.coordinates.longitude.toFixed(4)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                area.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {area.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditModal(area)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Edit Area"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setMergingSourceArea(area);
                                  setTargetMergeAreaId('');
                                  setMergeError(null);
                                }}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Merge Area into Target"
                              >
                                <Merge className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(area)}
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                                  area.status === 'active'
                                    ? 'text-rose-700 hover:bg-rose-50'
                                    : 'text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                {area.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: Customer Locality Requests Queue */}
      {activeSubTab === 'requests' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs text-xs">
          {areaRequests.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <CheckCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">No pending customer requests</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Customer missing-locality submissions will appear here for review and one-click onboarding.
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Requested Locality</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Pincode</th>
                  <th className="py-3 px-4">Customer Contact</th>
                  <th className="py-3 px-4">Requested On</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {areaRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{req.localityName}</td>
                    <td className="py-3 px-4 text-slate-700">{req.city}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{req.pincode || '—'}</td>
                    <td className="py-3 px-4 text-slate-500">{req.customerEmail || 'Guest Visitor'}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(req.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : req.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {req.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRejectRequest(req)}
                            className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded font-semibold cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveRequest(req)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer"
                          >
                            Onboard Area
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODAL 1: Add / Edit Area Record */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <form
            onSubmit={handleSaveArea}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingArea ? `Edit Area: ${editingArea.name}` : 'Add New Locality to Directory'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Locality Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indiranagar"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">City *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bengaluru"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">State</label>
                <input
                  type="text"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pincode *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 560038"
                  value={formPincode}
                  onChange={(e) => setFormPincode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Level</label>
                <select
                  value={formLevel}
                  onChange={(e) => setFormLevel(e.target.value as AreaLevel)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="locality">Locality</option>
                  <option value="sub_locality">Sub-locality / Colony</option>
                  <option value="city">City Cluster</option>
                </select>
              </div>
            </div>

            {formLevel === 'sub_locality' && (
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Parent Locality</label>
                <select
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">Select Parent Locality</option>
                  {areas
                    .filter((a) => a.level === 'locality' && a.city.toLowerCase() === formCity.toLowerCase())
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.pincode})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Aliases & Key Landmarks (Comma Separated)
              </label>
              <input
                type="text"
                placeholder="e.g. 100ft Road, CMH Road, Defence Colony"
                value={formAliases}
                onChange={(e) => setFormAliases(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={formLat}
                  onChange={(e) => setFormLat(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={formLng}
                  onChange={(e) => setFormLng(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer shadow-xs"
              >
                {editingArea ? 'Save Area Changes' : 'Create Locality'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Merge Areas */}
      {mergingSourceArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <form
            onSubmit={handleExecuteMerge}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Merge Locality: {mergingSourceArea.name}
              </h3>
              <button
                type="button"
                onClick={() => setMergingSourceArea(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              Merging will combine aliases into the target area, repoint all child sub-localities and shop coverage records, and deactivate the duplicate source.
            </p>

            {mergeError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                {mergeError}
              </div>
            )}

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Select Destination Target Area in {mergingSourceArea.city} *
              </label>
              <select
                required
                value={targetMergeAreaId}
                onChange={(e) => setTargetMergeAreaId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
              >
                <option value="">Choose Target Area</option>
                {areas
                  .filter((a) => a.id !== mergingSourceArea.id && a.city.toLowerCase() === mergingSourceArea.city.toLowerCase() && a.status === 'active')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.pincode})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMergingSourceArea(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!targetMergeAreaId}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
              >
                Execute Merge
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Bulk CSV / JSON Import Tool with Validation Preview */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  Bulk Locality Data Import Tool
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Import licensed neighborhood datasets without manual per-record entry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkImportOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              {/* Format Switcher */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Import Format:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormat('csv');
                      setPreviewRecords([]);
                      setPreviewErrors([]);
                    }}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                      importFormat === 'csv' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    CSV Format
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormat('json');
                      setPreviewRecords([]);
                      setPreviewErrors([]);
                    }}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                      importFormat === 'json' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    JSON Array
                  </button>
                </div>
              </div>

              {/* Sample format hint */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 block">Expected Schema:</span>
                {importFormat === 'csv' ? (
                  <p className="font-mono text-[10px] text-slate-500">
                    name,city,state,country,pincode,level,latitude,longitude,aliases
                    <br />
                    Indiranagar,Bengaluru,Karnataka,India,560038,locality,12.9784,77.6408,100ft Road;CMH Road
                  </p>
                ) : (
                  <p className="font-mono text-[10px] text-slate-500">
                    [{'{"name": "Indiranagar", "city": "Bengaluru", "pincode": "560038", "latitude": 12.9784, "longitude": 77.6408}'}]
                  </p>
                )}
              </div>

              {/* Input Textarea */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Paste Raw {importFormat.toUpperCase()} Data
                </label>
                <textarea
                  rows={6}
                  placeholder={`Paste ${importFormat.toUpperCase()} records here...`}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-[11px] focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleValidateBulk}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Validate & Preview Data
                </button>
                {previewRecords.length > 0 && (
                  <span className="text-emerald-700 font-bold">
                    ✓ {previewRecords.length} records ready for import
                  </span>
                )}
              </div>

              {/* Validation Errors Preview */}
              {previewErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Validation Issues Found:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {previewErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {previewErrors.length > 5 && (
                      <li>...and {previewErrors.length - 5} more issues.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Success Result */}
              {importResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>
                    Successfully imported {importResult.imported} new areas into the database ({importResult.skipped} duplicate records skipped).
                  </span>
                </div>
              )}

              {/* Data Preview Table */}
              {previewRecords.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-800 block text-[11px]">
                    Candidate Records Preview (First 5):
                  </span>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                        <tr>
                          <th className="p-2">Name</th>
                          <th className="p-2">City</th>
                          <th className="p-2">Pincode</th>
                          <th className="p-2">Coordinates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRecords.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="p-2 font-bold text-slate-800">{r.name}</td>
                            <td className="p-2 text-slate-600">{r.city}</td>
                            <td className="p-2 font-mono">{r.pincode}</td>
                            <td className="p-2 font-mono text-[10px] text-slate-500">
                              {r.coordinates.latitude}, {r.coordinates.longitude}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsBulkImportOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={previewRecords.length === 0}
                onClick={handleCommitBulkImport}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Import {previewRecords.length} Records to Directory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

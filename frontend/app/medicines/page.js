'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import StatusBadge, { getDaysRemaining } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import {
  Pill,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  Edit2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  History,
  X,
  RefreshCw,
  ShoppingCart,
  PackagePlus,
  SlidersHorizontal,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function MedicinesPage() {
  const toast = useToast();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('expiry');
  const [filterTab, setFilterTab] = useState('all');
  const [settings, setSettings] = useState({ low_stock_threshold: 100, expiry_warning_days: 30 });

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Edit details modal state
  const [editTarget, setEditTarget] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editExpiry, setEditExpiry] = useState('');

  // Quantity Update modal state (Phase 4)
  const [qtyTarget, setQtyTarget] = useState(null);
  const [qtyMode, setQtyMode] = useState('sell'); // 'sell' | 'restock' | 'set'
  const [qtyAmount, setQtyAmount] = useState('');
  const [qtySubmitting, setQtySubmitting] = useState(false);

  // History modal state (Phase 4)
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load medicines & settings
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [medsData, settingsData] = await Promise.all([
        api.get(`/medicines?sort=${sort}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
        api.get('/settings').catch(() => ({ settings: { low_stock_threshold: 100, expiry_warning_days: 30 } }))
      ]);

      setMedicines(Array.isArray(medsData) ? medsData : []);
      if (settingsData?.settings) {
        setSettings({
          low_stock_threshold: settingsData.settings.low_stock_threshold ?? 100,
          expiry_warning_days: settingsData.settings.expiry_warning_days ?? 30,
        });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load medicines.');
    } finally {
      setLoading(false);
    }
  }, [sort, search, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      const daysLeft = getDaysRemaining(m.expiry_date);
      const isExpired = daysLeft < 0;
      const isExpiring = !isExpired && daysLeft <= settings.expiry_warning_days;
      const isLowStock = m.quantity <= settings.low_stock_threshold;
      const isSafe = !isExpired && !isExpiring && !isLowStock;

      if (filterTab === 'low_stock') return isLowStock;
      if (filterTab === 'expiring') return isExpiring;
      if (filterTab === 'expired') return isExpired;
      if (filterTab === 'safe') return isSafe;
      return true;
    });
  }, [medicines, filterTab, settings]);

  // Tab counts
  const tabCounts = useMemo(() => {
    let lowStock = 0;
    let expiring = 0;
    let expired = 0;
    let safe = 0;

    medicines.forEach((m) => {
      const daysLeft = getDaysRemaining(m.expiry_date);
      const isExpired = daysLeft < 0;
      const isExpiring = !isExpired && daysLeft <= settings.expiry_warning_days;
      const isLowStock = m.quantity <= settings.low_stock_threshold;

      if (isExpired) expired++;
      else if (isExpiring) expiring++;
      if (isLowStock) lowStock++;
      if (!isExpired && !isExpiring && !isLowStock) safe++;
    });

    return { all: medicines.length, lowStock, expiring, expired, safe };
  }, [medicines, settings]);

  // Delete batch
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/medicines/${deleteTarget.id}`);
      toast.success(`Batch ${deleteTarget.batch_id} removed from inventory.`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete medicine batch.');
    } finally {
      setDeleting(false);
    }
  };

  // Open Edit Details
  const openEditModal = (med) => {
    setEditTarget(med);
    setEditName(med.name);
    setEditExpiry(med.expiry_date);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditing(true);
    try {
      await api.put(`/medicines/${editTarget.id}`, {
        name: editName.trim(),
        expiry_date: editExpiry,
      });
      toast.success('Medicine batch details updated.');
      setEditTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update details.');
    } finally {
      setEditing(false);
    }
  };

  // Open Quantity Modal
  const openQtyModal = (med, defaultMode = 'sell') => {
    setQtyTarget(med);
    setQtyMode(defaultMode);
    setQtyAmount('');
  };

  // Calculate projected new quantity
  const projectedQuantity = useMemo(() => {
    if (!qtyTarget) return 0;
    const amount = parseInt(qtyAmount, 10);
    if (isNaN(amount) || amount < 0) return qtyTarget.quantity;

    if (qtyMode === 'sell') {
      return Math.max(0, qtyTarget.quantity - amount);
    } else if (qtyMode === 'restock') {
      return qtyTarget.quantity + amount;
    } else if (qtyMode === 'set') {
      return amount;
    }
    return qtyTarget.quantity;
  }, [qtyTarget, qtyMode, qtyAmount]);

  // Submit Quantity Update
  const handleQtySubmit = async (e) => {
    e.preventDefault();
    if (!qtyTarget) return;

    const amount = parseInt(qtyAmount, 10);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid whole number.');
      return;
    }

    if ((qtyMode === 'sell' || qtyMode === 'restock') && amount === 0) {
      toast.error('Quantity amount must be greater than zero.');
      return;
    }

    if (qtyMode === 'sell' && amount > qtyTarget.quantity) {
      toast.error(`Cannot sell ${amount} units. Only ${qtyTarget.quantity} units are in stock.`);
      return;
    }

    setQtySubmitting(true);
    try {
      const res = await api.patch(`/medicines/${qtyTarget.id}/quantity`, {
        mode: qtyMode,
        amount,
      });

      toast.success(res.message || 'Stock quantity updated successfully.');
      if (res.alertTriggered) {
        toast.warning('Stock dropped below threshold: Low stock alert generated and emailed!');
      }

      setQtyTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update stock quantity.');
    } finally {
      setQtySubmitting(false);
    }
  };

  // Open History Modal
  const openHistoryModal = async (med) => {
    setHistoryTarget(med);
    setHistoryLogs([]);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/medicines/${med.id}/history`);
      setHistoryLogs(res?.history || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load stock history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2.5">
              <Pill className="w-6 h-6 text-[#0F766E]" />
              Medicine Inventory
            </h1>
            <p className="text-xs text-[#475569] mt-1">
              Real-time batch tracking, stock dispensation, restock logs, and expiry monitoring.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              className="p-2.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-xs"
              title="Refresh inventory"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/medicines/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add Medicine Batch
            </Link>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-3 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by medicine name or batch ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-slate-400 focus:bg-white focus:border-[#0F766E] outline-none transition"
              />
            </div>

            {/* Sort selector */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-3 py-2 text-xs font-medium bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:bg-white focus:border-[#0F766E] outline-none transition cursor-pointer"
              >
                <option value="expiry">Sort: Expiry (Earliest first)</option>
                <option value="name">Sort: Name (A-Z)</option>
                <option value="quantity">Sort: Quantity (Lowest first)</option>
              </select>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E2E8F0]">
            {[
              { id: 'all', label: 'All Batches', count: tabCounts.all },
              { id: 'low_stock', label: 'Low Stock', count: tabCounts.lowStock, badgeClass: 'text-orange-700 bg-orange-100' },
              { id: 'expiring', label: 'Expiring Soon', count: tabCounts.expiring, badgeClass: 'text-amber-700 bg-amber-100' },
              { id: 'expired', label: 'Expired', count: tabCounts.expired, badgeClass: 'text-red-700 bg-red-100' },
              { id: 'safe', label: 'Safe', count: tabCounts.safe, badgeClass: 'text-emerald-700 bg-emerald-100' },
            ].map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    active
                      ? 'bg-[#0F766E] text-white shadow-xs'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      active ? 'bg-white/20 text-white' : tab.badgeClass || 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Table / Cards */}
        {loading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
            <div className="w-8 h-8 border-3 border-[#0F766E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-[#475569]">Loading inventory...</p>
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Pill className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">No medicine batches found</h3>
            <p className="text-xs text-[#475569] mt-1 max-w-sm mx-auto">
              {search || filterTab !== 'all'
                ? 'Try adjusting your search criteria or switching status filter tabs.'
                : 'Your pharmacy inventory is empty. Start by adding your first medicine batch.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Medicine Name</th>
                    <th className="py-3 px-4">Batch ID</th>
                    <th className="py-3 px-4 text-right">In Stock</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Safety Status</th>
                    <th className="py-3 px-4 text-center">Quick Stock</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {filteredMedicines.map((med) => {
                    const days = getDaysRemaining(med.expiry_date);
                    return (
                      <tr key={med.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                          {med.name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[#475569]">
                          {med.batch_id}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-[#0F172A]">
                          <span
                            className={`inline-block font-mono text-sm px-2 py-0.5 rounded-md ${
                              med.quantity <= settings.low_stock_threshold
                                ? 'bg-orange-50 text-orange-700 font-bold ring-1 ring-orange-200'
                                : 'text-slate-800'
                            }`}
                          >
                            {med.quantity}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#475569]">
                          <div>{med.expiry_date}</div>
                          <div className="text-[10px] text-slate-400">
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge
                            expiryDate={med.expiry_date}
                            quantity={med.quantity}
                            lowStockThreshold={settings.low_stock_threshold}
                            expiryWarningDays={settings.expiry_warning_days}
                          />
                        </td>

                        {/* Quick Stock Actions (Phase 4) */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => openQtyModal(med, 'sell')}
                              className="px-2 py-1 text-xs font-semibold text-slate-700 hover:text-red-700 hover:bg-white rounded-md transition shadow-2xs flex items-center gap-1"
                              title="Sell / Dispense units"
                            >
                              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                              Sell
                            </button>
                            <button
                              type="button"
                              onClick={() => openQtyModal(med, 'restock')}
                              className="px-2 py-1 text-xs font-semibold text-slate-700 hover:text-[#0F766E] hover:bg-white rounded-md transition shadow-2xs flex items-center gap-1"
                              title="Restock units"
                            >
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                              Restock
                            </button>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openHistoryModal(med)}
                              className="p-1.5 text-slate-500 hover:text-[#0F766E] hover:bg-slate-100 rounded-lg transition"
                              title="View stock audit history"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(med)}
                              className="p-1.5 text-slate-500 hover:text-[#0F766E] hover:bg-slate-100 rounded-lg transition"
                              title="Edit batch details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(med)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View (< 768px) */}
            <div className="md:hidden space-y-3">
              {filteredMedicines.map((med) => {
                const days = getDaysRemaining(med.expiry_date);
                return (
                  <div
                    key={med.id}
                    className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#0F172A]">{med.name}</h4>
                        <span className="font-mono text-xs text-[#475569]">
                          Batch: {med.batch_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openHistoryModal(med)}
                          className="p-1.5 text-slate-500 hover:text-[#0F766E] rounded-md"
                          title="History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(med)}
                          className="p-1.5 text-slate-500 hover:text-[#0F766E] rounded-md"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(med)}
                          className="p-1.5 text-slate-500 hover:text-red-600 rounded-md"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Current Stock
                        </span>
                        <span className="font-mono font-bold text-sm text-[#0F172A]">
                          {med.quantity} units
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Expiry Date
                        </span>
                        <span className="font-medium text-[#0F172A]">
                          {med.expiry_date}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <StatusBadge
                        expiryDate={med.expiry_date}
                        quantity={med.quantity}
                        lowStockThreshold={settings.low_stock_threshold}
                        expiryWarningDays={settings.expiry_warning_days}
                        compact
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openQtyModal(med, 'sell')}
                          className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
                        >
                          Sell
                        </button>
                        <button
                          type="button"
                          onClick={() => openQtyModal(med, 'restock')}
                          className="px-2.5 py-1 text-xs font-semibold text-[#0F766E] bg-[#E6F4F1] hover:bg-[#d0ece7] rounded-lg transition"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* PHASE 4: UPDATE QUANTITY MODAL (SELL / RESTOCK / SET)   */}
        {/* ======================================================== */}
        {qtyTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E2E8F0]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">
                    Update Stock: {qtyTarget.name}
                  </h3>
                  <span className="font-mono text-xs text-slate-400">
                    Batch: {qtyTarget.batch_id} • Current Stock: {qtyTarget.quantity} units
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setQtyTarget(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Toggle Buttons */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl my-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setQtyMode('sell')}
                  className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition ${
                    qtyMode === 'sell'
                      ? 'bg-white text-red-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                  Sell
                </button>
                <button
                  type="button"
                  onClick={() => setQtyMode('restock')}
                  className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition ${
                    qtyMode === 'restock'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  Restock
                </button>
                <button
                  type="button"
                  onClick={() => setQtyMode('set')}
                  className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1 transition ${
                    qtyMode === 'set'
                      ? 'bg-white text-[#0F766E] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#0F766E]" />
                  Correction
                </button>
              </div>

              <form onSubmit={handleQtySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
                    {qtyMode === 'sell'
                      ? 'Units Sold (Dispensed)'
                      : qtyMode === 'restock'
                      ? 'Units Received (Restocked)'
                      : 'Corrected Total Stock Quantity'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    autoFocus
                    placeholder={qtyMode === 'set' ? `${qtyTarget.quantity}` : 'Enter amount (e.g. 10)'}
                    value={qtyAmount}
                    onChange={(e) => setQtyAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none"
                  />

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400 font-medium">Presets:</span>
                    {[5, 10, 25, 50, 100].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setQtyAmount(String(val))}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
                      >
                        +{val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Projected Change Card */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Stock Outcome
                    </span>
                    <span className="font-semibold text-slate-600">
                      {qtyTarget.quantity} units
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      New Total
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        projectedQuantity <= settings.low_stock_threshold
                          ? 'text-orange-600'
                          : 'text-[#0F766E]'
                      }`}
                    >
                      {projectedQuantity} units
                    </span>
                  </div>
                </div>

                {qtyMode === 'sell' && parseInt(qtyAmount, 10) > qtyTarget.quantity && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Cannot sell {qtyAmount} units. Maximum available in stock is {qtyTarget.quantity}.
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setQtyTarget(null)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={qtySubmitting || (qtyMode === 'sell' && parseInt(qtyAmount, 10) > qtyTarget.quantity)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#115E59] rounded-xl disabled:opacity-50 transition"
                  >
                    {qtySubmitting ? 'Recording Transaction...' : 'Apply Stock Change'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 4: AUDIT STOCK HISTORY MODAL                      */}
        {/* ======================================================== */}
        {historyTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E2E8F0]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                    <History className="w-4 h-4 text-[#0F766E]" />
                    Audit Stock History: {historyTarget.name}
                  </h3>
                  <span className="font-mono text-xs text-slate-400">
                    Batch: {historyTarget.batch_id} • Current Stock: {historyTarget.quantity} units
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryTarget(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 max-h-80 overflow-y-auto pr-1">
                {historyLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Loading transaction log...
                  </div>
                ) : historyLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No historical stock records recorded for this batch yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyLogs.map((log) => {
                      const net = log.new_quantity - log.old_quantity;
                      let badgeColor = 'bg-slate-100 text-slate-700';
                      let label = log.change_reason;

                      if (log.change_reason === 'ADD') {
                        badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                        label = 'Initial Entry';
                      } else if (log.change_reason === 'SOLD') {
                        badgeColor = 'bg-red-50 text-red-700 border-red-200';
                        label = 'Sold / Dispensed';
                      } else if (log.change_reason === 'RESTOCK') {
                        badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        label = 'Restocked';
                      } else if (log.change_reason === 'CORRECTION') {
                        badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                        label = 'Correction';
                      }

                      return (
                        <div
                          key={log.id}
                          className="p-3 bg-slate-50/80 border border-[#E2E8F0] rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${badgeColor}`}>
                                {label}
                              </span>
                              <span className="font-mono text-slate-400 text-[11px]">
                                {log.changed_at}
                              </span>
                            </div>
                            <div className="text-slate-600 text-[11px]">
                              Stock transition:{' '}
                              <span className="font-mono font-medium">{log.old_quantity}</span> →{' '}
                              <span className="font-mono font-bold text-[#0F172A]">{log.new_quantity}</span>
                            </div>
                          </div>

                          <div className="font-mono font-bold text-sm">
                            {net > 0 ? (
                              <span className="text-emerald-600">+{net}</span>
                            ) : net < 0 ? (
                              <span className="text-red-600">{net}</span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 text-right">
                <button
                  type="button"
                  onClick={() => setHistoryTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E2E8F0]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                  <Trash2 className="w-5 h-5" />
                  Delete Medicine Batch
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 text-xs text-[#475569] leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <span className="font-bold text-[#0F172A]">{deleteTarget.name}</span> (Batch{' '}
                <span className="font-mono font-bold">{deleteTarget.batch_id}</span>)? This will also
                remove its historical inventory logs.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Medicine Details Modal */}
        {editTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E2E8F0]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-[#0F766E] font-bold text-sm">
                  <Edit2 className="w-4 h-4" />
                  Edit Batch Details ({editTarget.batch_id})
                </div>
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1">
                    Medicine Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:border-[#0F766E] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:border-[#0F766E] outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editing}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#115E59] rounded-xl disabled:opacity-50"
                  >
                    {editing ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

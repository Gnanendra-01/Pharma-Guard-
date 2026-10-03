'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import {
  ArrowLeft,
  Pill,
  Hash,
  Layers,
  Calendar,
  Save,
  AlertCircle
} from 'lucide-react';

export default function NewMedicinePage() {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState('');
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Quick date helper
  const setQuickExpiry = (monthsAhead) => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthsAhead);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setExpiryDate(`${y}-${m}-${day}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Medicine name is required.');
      return;
    }
    if (!batchId.trim()) {
      setError('Batch ID is required.');
      return;
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 0) {
      setError('Quantity must be 0 or a positive whole number.');
      return;
    }

    if (!expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      setError('Please provide a valid expiry date (YYYY-MM-DD).');
      return;
    }

    setLoading(true);
    try {
      await api.post('/medicines', {
        name: name.trim(),
        batch_id: batchId.trim().toUpperCase(),
        quantity: parsedQty,
        expiry_date: expiryDate,
      });

      toast.success(`Batch ${batchId.trim().toUpperCase()} added successfully!`);
      router.push('/medicines');
    } catch (err) {
      const msg = err.message || 'Failed to add medicine.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb / Back button */}
        <div className="mb-6">
          <Link
            href="/medicines"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F766E] hover:text-[#115E59] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Inventory
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mt-2">
            Add Medicine Batch
          </h1>
          <p className="text-xs text-[#475569] mt-1">
            Register a newly received shipment or batch with quantity and expiry details.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Medicine Name */}
            <div>
              <label htmlFor="med-name" className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
                Medicine Name & Strength <span className="text-red-500">*</span>
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Pill className="w-4 h-4" />
                </div>
                <input
                  id="med-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Paracetamol 500mg, Amoxicillin 250mg/5ml"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-slate-400 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none transition"
                />
              </div>
            </div>

            {/* Batch ID and Initial Stock */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="batch-id" className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
                  Batch / Lot ID <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    id="batch-id"
                    type="text"
                    required
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    placeholder="e.g. BATCH-2026-X9"
                    className="block w-full pl-10 pr-3.5 py-2.5 text-sm uppercase font-mono bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-slate-400 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none transition"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Must be unique within your pharmacy.
                </span>
              </div>

              <div>
                <label htmlFor="quantity" className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
                  Initial Stock Quantity <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <input
                    id="quantity"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 250"
                    className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-slate-400 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none transition"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Total units, strips, or vials currently received.
                </span>
              </div>
            </div>

            {/* Expiry Date */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="expiry-date" className="block text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Expiry Date <span className="text-red-500">*</span>
                </label>
                {/* Quick select buttons */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-slate-400">Quick set:</span>
                  <button
                    type="button"
                    onClick={() => setQuickExpiry(1)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition"
                  >
                    +1 Mo
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickExpiry(6)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition"
                  >
                    +6 Mo
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickExpiry(12)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition"
                  >
                    +1 Yr
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickExpiry(24)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition"
                  >
                    +2 Yrs
                  </button>
                </div>
              </div>

              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  id="expiry-date"
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none transition"
                />
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
              <Link
                href="/medicines"
                className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F766E] disabled:opacity-60 transition"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving Batch...' : 'Save Medicine Batch'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

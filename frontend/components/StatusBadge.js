'use client';

import React from 'react';
import { AlertCircle, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Calculates days remaining until target date (YYYY-MM-DD) from today.
 */
export function getDaysRemaining(expiryDateStr) {
  if (!expiryDateStr) return 0;
  const [y, m, d] = expiryDateStr.split('-').map(Number);
  const targetMidnight = Date.UTC(y, m - 1, d);
  const now = new Date();
  const todayMidnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((targetMidnight - todayMidnight) / MS_PER_DAY);
}

/**
 * Renders clinical status badges for medicine batches.
 * Priority: Expired > Expiring Soon > Low Stock > Safe
 */
export default function StatusBadge({
  expiryDate,
  quantity,
  lowStockThreshold = 100,
  expiryWarningDays = 30,
  compact = false
}) {
  const daysLeft = getDaysRemaining(expiryDate);
  const isExpired = daysLeft < 0;
  const isExpiring = !isExpired && daysLeft <= expiryWarningDays;
  const isLowStock = quantity <= lowStockThreshold;

  const badges = [];

  if (isExpired) {
    badges.push({
      key: 'expired',
      label: compact ? 'Expired' : `Expired (${Math.abs(daysLeft)}d ago)`,
      className: 'bg-red-50 text-red-700 border-red-200 ring-red-600/10',
      icon: AlertCircle,
    });
  } else if (isExpiring) {
    badges.push({
      key: 'expiring',
      label: compact ? `${daysLeft}d left` : `Expiring in ${daysLeft} days`,
      className: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/10',
      icon: Clock,
    });
  }

  if (isLowStock) {
    badges.push({
      key: 'low-stock',
      label: compact ? 'Low Stock' : `Low Stock (${quantity} left)`,
      className: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-600/10',
      icon: AlertTriangle,
    });
  }

  if (badges.length === 0) {
    badges.push({
      key: 'safe',
      label: compact ? 'Safe' : `Safe (${daysLeft}d left)`,
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/10',
      icon: CheckCircle2,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges.map((b) => {
        const Icon = b.icon;
        return (
          <span
            key={b.key}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ring-1 ring-inset ${b.className}`}
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            {b.label}
          </span>
        );
      })}
    </div>
  );
}

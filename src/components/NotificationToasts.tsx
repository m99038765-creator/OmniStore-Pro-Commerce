import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  X,
  ShieldAlert,
  ClipboardList,
  ArrowUpRight
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const NotificationToasts: React.FC = () => {
  const {
    alerts,
    dismissAlert,
    flaggedAuditAlerts,
    dismissFlaggedAuditAlert,
    openGlobalSkuAuditLog,
    products
  } = useStore();

  return (
    <div
      id="notification-toasts-container"
      className="fixed bottom-5 right-5 z-[65] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {/* Persistent Flagged Audit Alerts (Quarantine / Damage) */}
        {flaggedAuditAlerts.map(flagged => {
          const matchedProduct =
            products.find(
              p =>
                p.id === flagged.productId ||
                p.sku.toUpperCase() === flagged.sku.toUpperCase()
            ) || null;
          const isQuarantine =
            flagged.flagType === 'quarantine' || flagged.flagType === 'both';

          return (
            <motion.div
              key={flagged.id}
              id={`flagged-audit-alert-toast-${flagged.sku}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.16 } }}
              role="alert"
              aria-live="assertive"
              className="pointer-events-auto rounded-xl p-4 shadow-2xl border border-rose-500/75 bg-neutral-950/95 backdrop-blur-md text-rose-50 ring-1 ring-rose-500/30 space-y-2.5"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/45 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-bold tracking-wide uppercase text-rose-200">
                        Flagged Audit Alert
                      </h4>
                      <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-rose-500/25 text-rose-200 border border-rose-400/40">
                        Persistent
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {flagged.timestamp}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/35">
                      {flagged.sku}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                        isQuarantine
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/45'
                      }`}
                    >
                      {flagged.statusLabel}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-white mt-1.5 truncate">
                    {flagged.productName}
                  </p>
                  <p className="text-[11px] text-neutral-300 mt-0.5 leading-snug">
                    {flagged.reason} · <span className="font-mono text-neutral-400">{flagged.operatorId}</span>
                  </p>
                </div>

                <button
                  type="button"
                  id={`dismiss-flagged-audit-alert-${flagged.id}`}
                  onClick={() => dismissFlaggedAuditAlert(flagged.id)}
                  className="text-neutral-400 hover:text-white p-1 rounded-md transition-colors -mr-1 -mt-1 cursor-pointer shrink-0"
                  aria-label="Dismiss Flagged Audit Alert"
                  title="Dismiss persistent alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-2 border-t border-rose-500/25 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-neutral-400 truncate">
                  {flagged.warehouse}
                </span>
                <button
                  type="button"
                  id={`open-flagged-audit-modal-${flagged.sku}`}
                  onClick={() => openGlobalSkuAuditLog(flagged.sku, matchedProduct)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                >
                  <ClipboardList className="w-3.5 h-3.5 stroke-[2.25]" />
                  <span>Open SKU Audit Log</span>
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </motion.div>
          );
        })}

        {/* Standard Transient Alerts */}
        {alerts.map(alert => {
          const isCritical = alert.type === 'critical';
          const isWarning = alert.type === 'warning';
          const isSuccess = alert.type === 'success';

          return (
            <motion.div
              key={alert.id}
              id={`toast-${alert.id}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`pointer-events-auto rounded-xl p-4 shadow-xl border backdrop-blur-md flex items-start gap-3 transition-all ${
                isCritical
                  ? 'bg-rose-950/90 border-rose-800/60 text-rose-100 shadow-rose-950/30'
                  : isWarning
                  ? 'bg-amber-950/90 border-amber-800/60 text-amber-100 shadow-amber-950/30'
                  : isSuccess
                  ? 'bg-emerald-950/90 border-emerald-800/60 text-emerald-100 shadow-emerald-950/30'
                  : 'bg-neutral-900/90 border-neutral-800 text-neutral-100 shadow-black/40'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isCritical && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {alert.type === 'info' && <Info className="w-5 h-5 text-sky-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold tracking-wide uppercase text-white/90">
                    {alert.title}
                  </h4>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {alert.timestamp}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  {alert.message}
                </p>
              </div>

              <button
                id={`dismiss-toast-${alert.id}`}
                onClick={() => dismissAlert(alert.id)}
                className="text-neutral-400 hover:text-white p-1 rounded-md transition-colors -mr-1 -mt-1 cursor-pointer"
                aria-label="Close alert"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

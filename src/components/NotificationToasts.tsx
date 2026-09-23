import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const NotificationToasts: React.FC = () => {
  const { alerts, dismissAlert } = useStore();

  return (
    <div
      id="notification-toasts-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {alerts.map((alert, index) => {
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
                className="text-neutral-400 hover:text-white p-1 rounded-md transition-colors -mr-1 -mt-1"
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

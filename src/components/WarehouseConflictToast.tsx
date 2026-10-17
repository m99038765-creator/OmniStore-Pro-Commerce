import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  X,
  Zap,
  ArrowRightLeft,
  RotateCcw,
  ShieldAlert,
  Lock,
  UserCheck,
  ExternalLink,
  Building2,
  Check
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { WarehouseConflictEvent } from '../types';

export const WarehouseConflictToast: React.FC = () => {
  const {
    warehouseConflicts,
    dismissWarehouseConflict,
    resolveWarehouseConflict,
    openAdminForProduct,
    products
  } = useStore();

  if (warehouseConflicts.length === 0) return null;

  return (
    <div
      id="warehouse-conflict-toast-container"
      className="fixed top-4 right-4 z-70 flex flex-col gap-3 max-w-md w-full pointer-events-none"
    >
      <AnimatePresence>
        {warehouseConflicts.map((conflict: WarehouseConflictEvent) => {
          const targetProduct = products.find(p => p.sku === conflict.sku || p.id === conflict.productId);

          return (
            <motion.div
              key={conflict.id}
              id={`warehouse-conflict-toast-${conflict.id}`}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto rounded-2xl p-4 sm:p-5 bg-neutral-950/95 border-2 border-amber-500/90 shadow-2xl shadow-amber-950/90 text-white backdrop-blur-md relative overflow-hidden space-y-3"
            >
              {/* Animated Warning Stripe Ambient Accent */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />

              {/* Toast Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/60 flex items-center justify-center text-amber-400 shrink-0 shadow-xs">
                    <AlertTriangle className="w-4 h-4 stroke-[2.5] animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/25 text-amber-300 border border-amber-500/50">
                        Warehouse Conflict
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">
                        {conflict.timestamp}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-white mt-0.5">
                      Simultaneous Stock Edit Collision
                    </h4>
                  </div>
                </div>

                <button
                  id={`dismiss-conflict-toast-${conflict.id}`}
                  onClick={() => dismissWarehouseConflict(conflict.id)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Dismiss conflict notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Conflict Narrative */}
              <p className="text-xs text-neutral-200 leading-relaxed font-normal">
                {conflict.message}
              </p>

              {/* Dual Operator Collision Card */}
              <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-neutral-400 text-[10px] uppercase font-mono tracking-wider border-b border-neutral-800 pb-1.5">
                  <span>Active Session (You)</span>
                  <span className="text-amber-400 font-bold">Collision</span>
                  <span>Conflicting Staff Member</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {/* User A */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/60 flex items-center justify-center text-sky-300 text-[10px] font-mono font-bold shrink-0">
                      U1
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-white truncate block text-[11px]">
                        {conflict.userA.operatorName}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono block">
                        {conflict.userA.operatorId}
                      </span>
                    </div>
                  </div>

                  {/* Zap / Collision indicator */}
                  <div className="p-1.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0 border border-amber-500/40">
                    <ArrowRightLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>

                  {/* User B */}
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end text-right">
                    <div className="min-w-0">
                      <span className="font-semibold text-amber-300 truncate block text-[11px]">
                        {conflict.userB.operatorName}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono block">
                        {conflict.userB.operatorId}
                      </span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300 text-[10px] font-mono font-bold shrink-0">
                      U2
                    </div>
                  </div>
                </div>

                {/* SKU Context Strip */}
                <div className="pt-1.5 border-t border-neutral-800/80 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span className="text-sky-400 font-bold">
                    SKU: {conflict.sku}
                  </span>
                  <span>Stock on Hand: <strong className="text-white">{conflict.currentStock} units</strong></span>
                </div>
              </div>

              {/* Action Buttons for Conflict Resolution */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Inspect SKU in Admin */}
                {targetProduct && (
                  <button
                    id={`conflict-inspect-sku-btn-${conflict.id}`}
                    type="button"
                    onClick={() => {
                      openAdminForProduct(targetProduct);
                      dismissWarehouseConflict(conflict.id);
                    }}
                    className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
                    title="Open Warehouse Admin targeting this SKU"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Inspect SKU</span>
                  </button>
                )}

                {/* Force Sync & Reload */}
                <button
                  id={`conflict-sync-reload-btn-${conflict.id}`}
                  type="button"
                  onClick={() => resolveWarehouseConflict(conflict.id, 'refresh')}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Fetch latest server inventory stock"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Sync & Reload</span>
                </button>

                {/* Override Lock */}
                <button
                  id={`conflict-override-lock-btn-${conflict.id}`}
                  type="button"
                  onClick={() => resolveWarehouseConflict(conflict.id, 'override')}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Force overwrite lock for your active console"
                >
                  <Lock className="w-3 h-3" />
                  <span>Override</span>
                </button>

                {/* Yield to other operator */}
                <button
                  id={`conflict-yield-btn-${conflict.id}`}
                  type="button"
                  onClick={() => resolveWarehouseConflict(conflict.id, 'yield')}
                  className="px-2.5 py-1.5 rounded-xl text-neutral-400 hover:text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
                  title="Yield inventory adjustment to the other staff member"
                >
                  <span>Yield</span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

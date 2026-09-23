import re

with open("src/components/InventoryAlertModal.tsx", "r") as f:
    content = f.read()

old_card_stats = """                              <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1 font-mono">
                                <span>
                                  Target: <strong className="text-amber-300">${alert.targetPrice.toFixed(2)}</strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Current: <strong className="text-white">${alert.currentPrice.toFixed(2)}</strong>
                                </span>
                              </div>"""

new_card_stats = """                              <div className="flex flex-col gap-0.5 mt-1">
                                <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                                  {alert.targetPrice ? (
                                    <>
                                      <span>Target: <strong className="text-amber-300">${alert.targetPrice.toFixed(2)}</strong></span>
                                      <span>•</span>
                                      <span>Current: <strong className="text-white">${alert.currentPrice.toFixed(2)}</strong></span>
                                    </>
                                  ) : (
                                    <span>Tracking Inventory Status Only</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 mt-0.5">
                                  {alert.notifyOnRestock && <span className="bg-sky-500/10 text-sky-400 px-1.5 rounded">Restock</span>}
                                  {alert.notifyOnLowStock && <span className="bg-amber-500/10 text-amber-400 px-1.5 rounded">Low Stock</span>}
                                </div>
                              </div>"""

content = content.replace(old_card_stats, new_card_stats)

old_target = """                    const diff = alert.currentPrice - alert.targetPrice;
                    const pctDiff = Math.round((diff / alert.currentPrice) * 100);"""
new_target = """                    const diff = alert.targetPrice ? alert.currentPrice - alert.targetPrice : 0;
                    const pctDiff = alert.targetPrice ? Math.round((diff / alert.currentPrice) * 100) : 0;"""

content = content.replace(old_target, new_target)

old_status_bar = """                        {/* Status bar */}
                        <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
                          {isTriggered ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              Triggered! Saved $
                              {Math.max(0, alert.originalPriceAtCreation - alert.currentPrice).toFixed(2)} compared to when alert was configured.
                            </span>
                          ) : (
                            <span className="text-neutral-400">
                              Currently <strong className="text-neutral-200">${diff.toFixed(2)}</strong> ({pctDiff}%) above your target threshold.
                            </span>
                          )}
                          <span className="text-[10px] text-neutral-500 font-mono">
                            Created {new Date(alert.createdAt).toLocaleDateString()}
                          </span>
                        </div>"""

new_status_bar = """                        {/* Status bar */}
                        <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
                          {isTriggered ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              Triggered! Price met or Inventory update sent.
                            </span>
                          ) : alert.targetPrice ? (
                            <span className="text-neutral-400">
                              Currently <strong className="text-neutral-200">${diff.toFixed(2)}</strong> ({pctDiff}%) above your target threshold.
                            </span>
                          ) : (
                            <span className="text-neutral-400">
                              Actively monitoring inventory levels...
                            </span>
                          )}
                          <span className="text-[10px] text-neutral-500 font-mono">
                            Created {new Date(alert.createdAt).toLocaleDateString()}
                          </span>
                        </div>"""

content = content.replace(old_status_bar, new_status_bar)

with open("src/components/InventoryAlertModal.tsx", "w") as f:
    f.write(content)

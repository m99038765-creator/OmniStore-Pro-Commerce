import re

with open("src/components/InventoryAlertModal.tsx", "r") as f:
    content = f.read()

old_form_ui = """                <div className="space-y-4">
                  {/* Target Price */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">
                      Notify me when price drops to
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-neutral-500 font-mono">$</span>
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl py-2.5 pl-7 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Quick Percentages */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500 font-medium px-1">Quick Select:</span>
                    <div className="flex gap-1.5">
                      {[5, 10, 15, 20, 25].map((pct) => {
                        const calculated = (currentProduct.price * (1 - pct / 100)).toFixed(2);
                        const isSelected = targetInput === calculated;
                        return (
                          <button
                            key={pct}
                            onClick={() => setTargetInput(calculated)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all border ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-600 hover:text-neutral-200'
                            }`}
                          >
                            -{pct}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-neutral-600"
                      placeholder="alerts@example.com"
                    />
                  </div>
                </div>"""

new_form_ui = """                <div className="space-y-4">
                  {/* Target Price */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">
                      Notify me when price drops to
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-neutral-500 font-mono">$</span>
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl py-2.5 pl-7 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
                        placeholder="Any (Optional)"
                      />
                    </div>
                  </div>

                  {/* Quick Percentages */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-neutral-500 font-medium px-1">Quick Select:</span>
                    <div className="flex gap-1.5">
                      {[5, 10, 15, 20, 25].map((pct) => {
                        const calculated = (currentProduct.price * (1 - pct / 100)).toFixed(2);
                        const isSelected = targetInput === calculated;
                        return (
                          <button
                            key={pct}
                            onClick={() => setTargetInput(calculated)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all border ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-600 hover:text-neutral-200'
                            }`}
                          >
                            -{pct}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inventory Toggles */}
                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnRestock}
                        onChange={(e) => setNotifyOnRestock(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-neutral-950"
                      />
                      <span className="text-sm font-medium text-neutral-200">Alert me when Back in Stock</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnLowStock}
                        onChange={(e) => setNotifyOnLowStock(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-neutral-950"
                      />
                      <span className="text-sm font-medium text-neutral-200">Alert me when Low in Stock</span>
                    </label>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-neutral-600"
                      placeholder="alerts@example.com"
                    />
                  </div>
                </div>"""

content = content.replace(old_form_ui, new_form_ui)

with open("src/components/InventoryAlertModal.tsx", "w") as f:
    f.write(content)

import {
  Product,
  Order,
  SkuAuditLogEntry,
  SkuAiSuggestion,
  AiSuggestionEngineResponse,
  CategoryDepletionInsight,
  CategoryDepletionReport
} from '../types';

/**
 * Baseline empirical sales velocity (units / day) for high-velocity electronics
 */
const BASELINE_VELOCITY: Record<string, { dailyRate: number; trend: 'accelerating' | 'steady' | 'cooling' }> = {
  'p-1': { dailyRate: 5.8, trend: 'accelerating' }, // RTX 5090 OC (High demand gaming GPU)
  'p-2': { dailyRate: 3.4, trend: 'steady' },       // M3 Max MacBook (Steady enterprise creator)
  'p-3': { dailyRate: 7.2, trend: 'accelerating' }, // Sony WH-1000XM5 (High-volume consumer audio)
  'p-4': { dailyRate: 2.5, trend: 'steady' },       // LG OLED evo (Home theater flagship)
  'p-5': { dailyRate: 4.3, trend: 'accelerating' }, // ROG Swift OLED (Esports monitor)
  'p-6': { dailyRate: 1.8, trend: 'steady' },       // Herman Miller Embody (Ergonomic workstation)
  'p-7': { dailyRate: 6.0, trend: 'steady' },       // Keychron Q1 Pro (Mechanical keyboard)
  'p-8': { dailyRate: 1.2, trend: 'steady' },       // Leica Q3 Monochrom (Luxury niche camera)
  'p-9': { dailyRate: 2.1, trend: 'cooling' },      // Apple Studio Display (Enterprise display)
  'p-10': { dailyRate: 4.6, trend: 'accelerating' } // Shure SM7dB (Broadcast audio)
};

/**
 * Calculates predictive SKU restock suggestions based on stock depletion rates,
 * live order velocity, and recent audit trail events.
 */
export function calculateSkuAiSuggestions(
  inventory: Product[],
  orders: Order[],
  auditLogs: SkuAuditLogEntry[] = []
): AiSuggestionEngineResponse {
  // Aggregate sales events per product from orders
  const salesCountByProduct: Record<string, number> = {};
  const recentOrdersCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // past 7 days
  let totalDataPoints = orders.length;

  orders.forEach(order => {
    order.items.forEach(item => {
      salesCountByProduct[item.productId] = (salesCountByProduct[item.productId] || 0) + item.quantity;
      totalDataPoints += item.quantity;
    });
  });

  // Also factor in recent subtraction / fulfillment audit events
  const auditFulfillmentsBySku: Record<string, number> = {};
  auditLogs.forEach(log => {
    if (log.adjustmentValue < 0) {
      auditFulfillmentsBySku[log.sku] = (auditFulfillmentsBySku[log.sku] || 0) + Math.abs(log.adjustmentValue);
      totalDataPoints++;
    }
  });

  const suggestions: SkuAiSuggestion[] = inventory.map(product => {
    const baseInfo = BASELINE_VELOCITY[product.id] || { dailyRate: 3.0, trend: 'steady' };
    const orderSales = salesCountByProduct[product.id] || 0;
    const auditFulfillments = auditFulfillmentsBySku[product.sku] || 0;
    
    // Dynamic sales velocity modifier based on observed real-time activity
    const activityBoost = Math.min(3.5, (orderSales * 0.3) + (auditFulfillments * 0.2));
    const dailyDepletionRate = Math.max(0.4, Math.round((baseInfo.dailyRate + activityBoost) * 10) / 10);
    const hourlyDepletionRate = Math.round((dailyDepletionRate / 24) * 100) / 100;

    const availableStock = Math.max(0, product.stock - (product.reserved || 0));

    // Calculate time to stockout
    let projectedStockoutHours = 0;
    let projectedStockoutDays = 0;

    if (availableStock <= 0) {
      projectedStockoutHours = 0;
      projectedStockoutDays = 0;
    } else {
      projectedStockoutHours = Math.round((availableStock / (dailyDepletionRate / 24)) * 10) / 10;
      projectedStockoutDays = Math.round((projectedStockoutHours / 24) * 10) / 10;
    }

    // Urgency categorization
    let urgency: 'critical' | 'high' | 'moderate' | 'stable';
    if (availableStock === 0 || projectedStockoutHours < 24) {
      urgency = 'critical';
    } else if (projectedStockoutDays <= 3.5 || availableStock <= product.lowStockThreshold) {
      urgency = 'high';
    } else if (projectedStockoutDays <= 7.0) {
      urgency = 'moderate';
    } else {
      urgency = 'stable';
    }

    // Target buffer days based on risk profile
    const targetBufferDays = urgency === 'critical' ? 21 : urgency === 'high' ? 14 : urgency === 'moderate' ? 10 : 7;

    // Recommended replenishment calculation
    const unitsTarget = Math.ceil(dailyDepletionRate * targetBufferDays);
    const netDeficit = Math.max(0, unitsTarget - availableStock);
    // Standardize to clean batch multiples of 5, minimum 5 units
    const recommendedRestockQty = Math.max(5, Math.ceil(Math.max(5, netDeficit) / 5) * 5);

    // Wholesale inventory replenishment cost (~62% of retail price)
    const estimatedRestockCost = recommendedRestockQty * Math.round(product.price * 0.62);

    // Dynamic sales velocity trend
    let salesVelocityTrend: 'accelerating' | 'steady' | 'cooling' = baseInfo.trend;
    if (activityBoost > 1.2) {
      salesVelocityTrend = 'accelerating';
    } else if (product.stock <= 0) {
      salesVelocityTrend = 'accelerating'; // Depleted due to fast sell-out
    }

    // Contextual predictive narrative
    let reasoning = '';
    if (availableStock === 0) {
      reasoning = `STOCK DEPLETED: Burning at ${dailyDepletionRate} units/day. Currently 0 available units. Emergency restock of +${recommendedRestockQty} units required immediately to restore a ${targetBufferDays}-day operating buffer.`;
    } else if (projectedStockoutHours < 24) {
      reasoning = `CRITICAL IMMINENT STOCKOUT: At current velocity (${dailyDepletionRate} units/day), available stock of ${availableStock} units will completely exhaust in ~${projectedStockoutHours} hours. Immediate replenishment of +${recommendedRestockQty} units is recommended.`;
    } else if (urgency === 'high') {
      reasoning = `HIGH DEPLETION RISK: Current stock (${availableStock} units) is within the safety threshold (${product.lowStockThreshold} units). Projected depletion in ${projectedStockoutDays} days. Restock +${recommendedRestockQty} units to secure customer fulfillment.`;
    } else if (urgency === 'moderate') {
      reasoning = `MODERATE BUFFER: Depleting at ${dailyDepletionRate} units/day with ${projectedStockoutDays} days remaining before replenishment deadline. Schedule a restock of +${recommendedRestockQty} units.`;
    } else {
      reasoning = `STABLE INVENTORY: Operating with ${projectedStockoutDays} days of supply. Replenish +${recommendedRestockQty} units during regular automated weekly cycle counts.`;
    }

    const confidenceScore = Math.min(0.98, Math.max(0.85, 0.88 + (totalDataPoints > 20 ? 0.08 : 0.03)));

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      image: product.images?.[0] || '',
      category: product.category,
      warehouse: product.warehouse,
      price: product.price,
      currentStock: product.stock,
      reserved: product.reserved || 0,
      availableStock,
      lowStockThreshold: product.lowStockThreshold,
      dailyDepletionRate,
      hourlyDepletionRate,
      projectedStockoutHours,
      projectedStockoutDays,
      urgency,
      salesVelocityTrend,
      recent30DaysSales: Math.round(dailyDepletionRate * 30),
      recent7DaysSales: Math.round(dailyDepletionRate * 7) + orderSales,
      recommendedRestockQty,
      targetBufferDays,
      estimatedRestockCost,
      reasoning,
      confidenceScore
    };
  });

  // Sort by urgency hierarchy: critical first, then high, then shortest time to stockout
  const urgencyWeight = { critical: 4, high: 3, moderate: 2, stable: 1 };
  suggestions.sort((a, b) => {
    const diff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
    if (diff !== 0) return diff;
    return a.projectedStockoutHours - b.projectedStockoutHours;
  });

  const urgentRestockCount = suggestions.filter(s => s.urgency === 'critical' || s.urgency === 'high').length;
  const averageDailyDepletionAll = Math.round((suggestions.reduce((acc, s) => acc + s.dailyDepletionRate, 0) / (suggestions.length || 1)) * 10) / 10;
  const totalCapitalRecommended = suggestions
    .filter(s => s.urgency === 'critical' || s.urgency === 'high')
    .reduce((acc, s) => acc + s.estimatedRestockCost, 0);

  // Generate programmatic executive briefing
  const topCritical = suggestions.filter(s => s.urgency === 'critical');
  const topHigh = suggestions.filter(s => s.urgency === 'high');

  let executiveBriefing = `OmniStore AI Predictive Engine detected ${urgentRestockCount} high-priority SKU replenishment requirements across active distribution bays. `;
  if (topCritical.length > 0) {
    executiveBriefing += `Critical runout alerts triggered for ${topCritical.map(c => `${c.sku} (${c.name})`).join(', ')} with estimated depletion in under 24 hours. `;
  }
  if (topHigh.length > 0) {
    executiveBriefing += `Secondary high-velocity restock recommended for ${topHigh.map(h => h.sku).join(', ')} to avoid breach of safety stock thresholds. `;
  }
  executiveBriefing += `Total estimated replenishment capital needed to restore 14-day supply buffers: $${totalCapitalRecommended.toLocaleString()}.`;

  return {
    generatedAt: new Date().toISOString(),
    totalSkusAnalyzed: inventory.length,
    urgentRestockCount,
    averageDailyDepletionAll,
    totalCapitalRecommended,
    suggestions,
    executiveBriefing,
    algorithmDetails: {
      model: 'OmniStore-Velocity-Depletion-Engine-v2.4',
      bufferDays: 14,
      dataPointsConsidered: totalDataPoints,
      usingGemini: false
    }
  };
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  audio: { label: 'Audio', color: '#0ea5e9' },
  workstation: { label: 'Workstations', color: '#6366f1' },
  computing: { label: 'Computing', color: '#8b5cf6' },
  optics: { label: 'Cinema Optics', color: '#10b981' },
  peripherals: { label: 'Peripherals', color: '#f59e0b' }
};

/**
 * Calculates predictive category depletion insights across categories,
 * identifying which product sectors are trending towards rapid inventory depletion.
 */
export function calculateCategoryDepletionReport(
  inventory: Product[],
  orders: Order[],
  auditLogs: SkuAuditLogEntry[] = []
): CategoryDepletionReport {
  // First calculate SKU-level granular predictions
  const skuSuggestionsResponse = calculateSkuAiSuggestions(inventory, orders, auditLogs);
  const skuSuggestions = skuSuggestionsResponse.suggestions;

  const categoryKeys = ['audio', 'workstation', 'computing', 'optics', 'peripherals'];

  const categoryInsights: CategoryDepletionInsight[] = categoryKeys.map(catKey => {
    const catProducts = inventory.filter(p => p.category === catKey);
    const catSuggestions = skuSuggestions.filter(s => s.category === catKey);

    const availableStock = catProducts.reduce((sum, p) => sum + Math.max(0, p.stock - (p.reserved || 0)), 0);
    const reservedStock = catProducts.reduce((sum, p) => sum + (p.reserved || 0), 0);
    const totalStock = catProducts.reduce((sum, p) => sum + p.stock, 0);
    const inventoryValuation = catProducts.reduce((sum, p) => sum + (p.stock * p.price), 0);

    // Aggregate category burn rate (units/day)
    const dailyBurnRate = Math.round(
      catSuggestions.reduce((sum, s) => sum + s.dailyDepletionRate, 0) * 10
    ) / 10;
    const hourlyBurnRate = Math.round((dailyBurnRate / 24) * 100) / 100;

    // Projected time to category stockout
    let projectedDepletionHours = 0;
    let projectedDepletionDays = 0;

    if (availableStock <= 0) {
      projectedDepletionHours = 0;
      projectedDepletionDays = 0;
    } else {
      projectedDepletionHours = Math.round((availableStock / (dailyBurnRate / 24)) * 10) / 10;
      projectedDepletionDays = Math.round((projectedDepletionHours / 24) * 10) / 10;
    }

    // Number of individual SKUs in this category under critical runout (< 24h)
    const criticalSkusCount = catSuggestions.filter(s => s.urgency === 'critical').length;
    const highRiskSkusCount = catSuggestions.filter(s => s.urgency === 'high').length;

    // Category risk level
    let runoutRiskLevel: 'critical' | 'high' | 'moderate' | 'healthy' = 'healthy';
    if (projectedDepletionHours <= 48 || criticalSkusCount >= 2 || availableStock <= 5) {
      runoutRiskLevel = 'critical';
    } else if (projectedDepletionHours <= 120 || criticalSkusCount >= 1 || highRiskSkusCount >= 2) {
      runoutRiskLevel = 'high';
    } else if (projectedDepletionHours <= 240) {
      runoutRiskLevel = 'moderate';
    }

    // Velocity trend across category
    const acceleratingCount = catSuggestions.filter(s => s.salesVelocityTrend === 'accelerating').length;
    const coolingCount = catSuggestions.filter(s => s.salesVelocityTrend === 'cooling').length;
    let depletionVelocityTrend: 'accelerating' | 'steady' | 'cooling' = 'steady';
    if (acceleratingCount >= 2 || (acceleratingCount > 0 && acceleratingCount >= catSuggestions.length / 2)) {
      depletionVelocityTrend = 'accelerating';
    } else if (coolingCount >= 2) {
      depletionVelocityTrend = 'cooling';
    }

    // Find fastest depleting individual SKU in category
    const sortedCatSkus = [...catSuggestions].sort((a, b) => a.projectedStockoutHours - b.projectedStockoutHours);
    const topSku = sortedCatSkus[0] || {
      sku: catProducts[0]?.sku || 'N/A',
      name: catProducts[0]?.name || 'N/A',
      availableStock: catProducts[0]?.stock || 0,
      currentStock: catProducts[0]?.stock || 0,
      projectedStockoutHours: 999
    };

    const reorderCapitalNeeded = catSuggestions
      .filter(s => s.urgency === 'critical' || s.urgency === 'high')
      .reduce((sum, s) => sum + s.estimatedRestockCost, 0);

    const recommendedPoUnits = catSuggestions
      .filter(s => s.urgency === 'critical' || s.urgency === 'high')
      .reduce((sum, s) => sum + s.recommendedRestockQty, 0);

    // Dynamic turnover and optimal reorder modeling based on current sales patterns
    const monthlySalesVolume = Math.round(dailyBurnRate * 30);
    const turnoverRatio = totalStock > 0 ? Math.round(((monthlySalesVolume * 12) / Math.max(1, totalStock)) * 10) / 10 : 0;
    
    let turnoverSpeed: 'ultra-high' | 'high' | 'moderate' | 'steady' = 'steady';
    if (turnoverRatio >= 18 || dailyBurnRate >= 2.5) {
      turnoverSpeed = 'ultra-high';
    } else if (turnoverRatio >= 12 || dailyBurnRate >= 1.5) {
      turnoverSpeed = 'high';
    } else if (turnoverRatio >= 6 || dailyBurnRate >= 0.8) {
      turnoverSpeed = 'moderate';
    }

    // Optimal reorder quantity: replenish to guarantee 14 days of safety buffer while accounting for available stock
    const targetBufferDays = 14;
    const optimalSafetyStock = Math.ceil(dailyBurnRate * targetBufferDays);
    const optimalReorderQuantity = Math.max(
      recommendedPoUnits,
      Math.max(0, optimalSafetyStock - availableStock)
    );

    const suggestedPoLeadTimeDays = runoutRiskLevel === 'critical' ? 1 : runoutRiskLevel === 'high' ? 3 : 7;

    const meta = CATEGORY_META[catKey] || { label: catKey, color: '#38bdf8' };

    // Formulate descriptive AI predictive narrative
    let narrative = '';
    if (runoutRiskLevel === 'critical') {
      narrative = `Severe stockout velocity detected. Available stock of ${availableStock} units is being depleted at ${dailyBurnRate} units/day (~${projectedDepletionDays}d runtime). Bottlenecked primarily by ${topSku.sku} (${topSku.name}). Optimal PO batch of +${optimalReorderQuantity} units recommended immediately.`;
    } else if (runoutRiskLevel === 'high') {
      narrative = `Elevated demand acceleration (${dailyBurnRate} units/day). Category turnover is ${turnoverSpeed.toUpperCase()} (${turnoverRatio}x annual pace). Reordering +${optimalReorderQuantity} units guarantees 14-day supply protection.`;
    } else if (runoutRiskLevel === 'moderate') {
      narrative = `Stable fulfillment cadence with moderate depletion burn (${dailyBurnRate} units/day). Inventory coverage is approximately ${projectedDepletionDays} days; maintain standard replenish cycle of +${optimalReorderQuantity} units.`;
    } else {
      narrative = `Robust inventory headroom. Healthy safety stock buffer (${projectedDepletionDays} days remaining at ${dailyBurnRate} units/day burn velocity).`;
    }

    return {
      categoryId: catKey,
      categoryLabel: meta.label,
      color: meta.color,
      availableStock,
      reservedStock,
      totalStock,
      inventoryValuation,
      skuCount: catProducts.length,
      dailyBurnRate,
      hourlyBurnRate,
      monthlySalesVolume,
      turnoverRatio,
      turnoverSpeed,
      projectedDepletionHours,
      projectedDepletionDays,
      runoutRiskLevel,
      depletionVelocityTrend,
      criticalSkusCount,
      topDepletingSku: {
        sku: topSku.sku,
        name: topSku.name,
        stock: topSku.availableStock ?? topSku.currentStock ?? 0,
        hoursLeft: topSku.projectedStockoutHours
      },
      reorderCapitalNeeded,
      recommendedPoUnits,
      optimalReorderQuantity,
      targetBufferDays,
      suggestedPoLeadTimeDays,
      aiPredictiveNarrative: narrative
    };
  });

  // Sort categories by risk and turnover velocity: critical first, then high, then lowest projected hours
  const riskWeight = { critical: 4, high: 3, moderate: 2, healthy: 1 };
  categoryInsights.sort((a, b) => {
    const diff = riskWeight[b.runoutRiskLevel] - riskWeight[a.runoutRiskLevel];
    if (diff !== 0) return diff;
    return a.projectedDepletionHours - b.projectedDepletionHours;
  });

  const highestRisk = categoryInsights[0]?.categoryLabel || 'None';
  const highestTurnoverCategory = [...categoryInsights].sort((a, b) => b.turnoverRatio - a.turnoverRatio)[0]?.categoryLabel || highestRisk;
  const categoriesAtRiskCount = categoryInsights.filter(
    c => c.runoutRiskLevel === 'critical' || c.runoutRiskLevel === 'high'
  ).length;

  const overallVelocity = Math.round(
    categoryInsights.reduce((sum, c) => sum + c.dailyBurnRate, 0) * 10
  ) / 10;

  const totalRecommendedOptimalReorderUnits = categoryInsights.reduce((sum, c) => sum + c.optimalReorderQuantity, 0);
  const totalEstimatedReorderCost = categoryInsights.reduce((sum, c) => sum + c.reorderCapitalNeeded, 0);

  const executiveAiSynthesis = `${highestTurnoverCategory} is experiencing the highest velocity turnover (${categoryInsights.find(c => c.categoryLabel === highestTurnoverCategory)?.dailyBurnRate || 0} units/day), with ${highestRisk} category facing imminent depletion in ${categoryInsights[0]?.projectedDepletionDays || 0} days. Optimal restock recommendation across warehouse bays totals +${totalRecommendedOptimalReorderUnits} units to secure safety thresholds.`;

  return {
    generatedAt: new Date().toISOString(),
    highestRiskCategory: highestRisk,
    highestTurnoverCategory,
    overallWarehouseDepletionVelocity: overallVelocity,
    totalRecommendedOptimalReorderUnits,
    totalEstimatedReorderCost,
    categoriesAtRiskCount,
    categories: categoryInsights,
    executiveAiSynthesis
  };
}


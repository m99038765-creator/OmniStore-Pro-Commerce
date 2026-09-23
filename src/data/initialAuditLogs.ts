import { SkuAuditLogEntry } from '../types';

export const INITIAL_SKU_AUDIT_LOGS: SkuAuditLogEntry[] = [
  // AUD-REF-8040 (AcousticLab Model 8)
  {
    id: 'audit_log_aud_01',
    sku: 'AUD-REF-8040',
    productId: 'prod_studio_ref_monitors',
    productName: 'AcousticLab Model 8 Active Reference Monitors',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    adjustmentValue: 2,
    adjustmentType: 'cycle_count',
    previousStock: 5,
    newStock: 7,
    operatorId: 'OP-8821 (J. Vance)',
    operatorName: 'Julian Vance - Senior Floor Specialist',
    reason: 'Routine Bi-Weekly Cycle Count & Serial Verification',
    warehouse: 'Bay Area Hub (WH-01)',
    batchNumber: 'BATCH-2026-09-A4',
    notes: 'Discrepancy resolved: 2 units located in holding bay 3B staging area.'
  },
  {
    id: 'audit_log_aud_02',
    sku: 'AUD-REF-8040',
    productId: 'prod_studio_ref_monitors',
    productName: 'AcousticLab Model 8 Active Reference Monitors',
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), // 1 day ago
    adjustmentValue: 5,
    adjustmentType: 'restock',
    previousStock: 0,
    newStock: 5,
    operatorId: 'OP-4419 (M. Chen)',
    operatorName: 'Mei Chen - Inventory Lead',
    reason: 'Vendor Intake Inbound Shipment #PO-88301',
    warehouse: 'Bay Area Hub (WH-01)',
    batchNumber: 'BATCH-2026-09-A1',
    notes: 'Received from AcousticLab factory distributor; QA passed.'
  },
  {
    id: 'audit_log_aud_03',
    sku: 'AUD-REF-8040',
    productId: 'prod_studio_ref_monitors',
    productName: 'AcousticLab Model 8 Active Reference Monitors',
    timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3 days ago
    adjustmentValue: -1,
    adjustmentType: 'subtract',
    previousStock: 1,
    newStock: 0,
    operatorId: 'OP-1092 (R. Patel)',
    operatorName: 'Raj Patel - Quality Auditor',
    reason: 'Damaged Packaging Isolation Write-Off',
    warehouse: 'Bay Area Hub (WH-01)',
    batchNumber: 'BATCH-2026-08-Q9',
    notes: 'Corner carton impact during transit forklift maneuver; quarantined for RMA return.'
  },

  // KB-TITAN-75 (Vanguard 75%)
  {
    id: 'audit_log_kb_01',
    sku: 'KB-TITAN-75',
    productId: 'prod_mech_keyboard_cnc',
    productName: 'Vanguard 75% CNC Billet Aluminum Mechanical Keyboard',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    adjustmentValue: -2,
    adjustmentType: 'subtract',
    previousStock: 5,
    newStock: 3,
    operatorId: 'OP-7734 (E. Ross)',
    operatorName: 'Elena Ross - Logistics Coordinator',
    reason: 'High-Velocity Floor Dispatch & Assembly Allocation',
    warehouse: 'East Coast DC (WH-02)',
    batchNumber: 'BATCH-2026-09-K2',
    notes: 'Transferred 2 units to express staging line for urgent fulfillment.'
  },
  {
    id: 'audit_log_kb_02',
    sku: 'KB-TITAN-75',
    productId: 'prod_mech_keyboard_cnc',
    productName: 'Vanguard 75% CNC Billet Aluminum Mechanical Keyboard',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    adjustmentValue: 10,
    adjustmentType: 'restock',
    previousStock: 2,
    newStock: 12,
    operatorId: 'OP-8821 (J. Vance)',
    operatorName: 'Julian Vance - Senior Floor Specialist',
    reason: 'Scheduled Vendor Replenishment (Anodized Chassis Run)',
    warehouse: 'East Coast DC (WH-02)',
    batchNumber: 'BATCH-2026-09-K1',
    notes: 'Custom artisan shipment delivered via insured freight.'
  },

  // COMP-WORKSTATION-X9 (Apex Titanium Pro)
  {
    id: 'audit_log_comp_01',
    sku: 'COMP-WORKSTATION-X9',
    productId: 'prod_titanium_workstation',
    productName: 'Apex Precision Studio Workstation X9',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    adjustmentValue: 3,
    adjustmentType: 'add',
    previousStock: 2,
    newStock: 5,
    operatorId: 'SYS-AUTO-01 (Automated Floor Gantry)',
    operatorName: 'Automated Gantry Robot A-01',
    reason: 'Final Assembly Burn-In & QA Bin Relocation',
    warehouse: 'Pacific Northwest Facility (WH-03)',
    batchNumber: 'BATCH-2026-09-W4',
    notes: 'Stress-test certifications complete; added to available inventory pool.'
  },
  {
    id: 'audit_log_comp_02',
    sku: 'COMP-WORKSTATION-X9',
    productId: 'prod_titanium_workstation',
    productName: 'Apex Precision Studio Workstation X9',
    timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    adjustmentValue: -1,
    adjustmentType: 'subtract',
    previousStock: 3,
    newStock: 2,
    operatorId: 'OP-4419 (M. Chen)',
    operatorName: 'Mei Chen - Inventory Lead',
    reason: 'Executive Demo Unit Allocation',
    warehouse: 'Pacific Northwest Facility (WH-03)',
    batchNumber: 'BATCH-2026-09-W2',
    notes: 'Allocated for benchmark testing lab.'
  },

  // AUDIO-HEADPHONES-PRO (Planar Magnetic)
  {
    id: 'audit_log_hp_01',
    sku: 'AUD-PLANAR-01',
    productId: 'prod_planar_headphones',
    productName: 'Stratos Open-Back Planar Magnetic Headphones',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    adjustmentValue: 8,
    adjustmentType: 'restock',
    previousStock: 4,
    newStock: 12,
    operatorId: 'OP-1092 (R. Patel)',
    operatorName: 'Raj Patel - Quality Auditor',
    reason: 'Monthly Stock Resupply Intake',
    warehouse: 'Bay Area Hub (WH-01)',
    batchNumber: 'BATCH-2026-09-P1',
    notes: 'Clean batch inspection passed with zero acoustic driver defects.'
  },
  {
    id: 'audit_log_hp_02',
    sku: 'AUD-PLANAR-01',
    productId: 'prod_planar_headphones',
    productName: 'Stratos Open-Back Planar Magnetic Headphones',
    timestamp: new Date(Date.now() - 55 * 60 * 60 * 1000).toISOString(),
    adjustmentValue: -2,
    adjustmentType: 'cycle_count',
    previousStock: 6,
    newStock: 4,
    operatorId: 'OP-8821 (J. Vance)',
    operatorName: 'Julian Vance - Senior Floor Specialist',
    reason: 'Barcode Scan Variance Reconciliation',
    warehouse: 'Bay Area Hub (WH-01)',
    batchNumber: 'BATCH-2026-08-P9',
    notes: 'Reconciled missing units booked to VIP replacement ticket.'
  },

  // OPTICS-LENS-MASTER (Cine Lens)
  {
    id: 'audit_log_opt_01',
    sku: 'OPT-ANAMOR-35',
    productId: 'prod_anamorphic_lens',
    productName: 'Helios 35mm T2.0 1.5x Full-Frame Anamorphic Cinema Prime',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    adjustmentValue: 1,
    adjustmentType: 'add',
    previousStock: 3,
    newStock: 4,
    operatorId: 'OP-4419 (M. Chen)',
    operatorName: 'Mei Chen - Inventory Lead',
    reason: 'Customer Rental Inspection Return & Recalibration',
    warehouse: 'SoCal Studio Hub (WH-04)',
    batchNumber: 'BATCH-2026-09-L7',
    notes: 'Optical collimator test 100% sharp; returned to active stock pool.'
  },

  // DISP-OLED-49 (AuraVision 49" Curved QD-OLED) - Explicitly Under Quarantine
  {
    id: 'audit_log_disp_quarantine_01',
    sku: 'DISP-OLED-49',
    productId: 'prod_curved_oled_monitor',
    productName: 'AuraVision 49" Curved QD-OLED UltraWide 240Hz Monitor',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    adjustmentValue: -2,
    adjustmentType: 'subtract',
    previousStock: 8,
    newStock: 6,
    operatorId: 'OP-9912 (S. Tanaka)',
    operatorName: 'Sora Tanaka - QA Lead Inspector',
    reason: 'Under Quarantine: Micro-Flicker QA Diagnostic Hold',
    warehouse: 'Bay Area Hub (WH-01)',
    batchNumber: 'BATCH-2026-09-Q2',
    notes: 'Lot #772 flagged: 2 units placed Under Quarantine due to micro-flicker test failure; quarantined pending factory panel replacement.'
  },

  // COMP-TB4-4TB (TitanBolt 4TB PCIe Gen4 NVMe External SSD) - Explicitly Damaged
  {
    id: 'audit_log_comp_damaged_01',
    sku: 'COMP-TB4-4TB',
    productId: 'prod_nvme_tb4_ssd',
    productName: 'TitanBolt 4TB PCIe Gen4 NVMe External SSD',
    timestamp: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
    adjustmentValue: -3,
    adjustmentType: 'subtract',
    previousStock: 15,
    newStock: 12,
    operatorId: 'OP-1092 (R. Patel)',
    operatorName: 'Raj Patel - Quality Auditor',
    reason: 'Damaged Enclosure Isolation Write-Off',
    warehouse: 'East Coast DC (WH-02)',
    batchNumber: 'BATCH-2026-09-T1',
    notes: 'Drop impact sustained during conveyor sorting; aluminum housing dented and quarantined for RMA return.'
  }
];

export function getAuditLogsForSku(sku: string, currentStock = 10, productName = 'Hardware Item'): SkuAuditLogEntry[] {
  const normalizedSku = sku.trim().toUpperCase();
  const directMatches = INITIAL_SKU_AUDIT_LOGS.filter(
    log => log.sku.toUpperCase() === normalizedSku ||
           log.sku.replace(/[-\s_]/g, '').toUpperCase() === normalizedSku.replace(/[-\s_]/g, '')
  );

  if (directMatches.length > 0) {
    return directMatches;
  }

  // If SKU is not pre-populated with custom logs, dynamically generate realistic historical audit log entries
  return [
    {
      id: `audit_dyn_${sku}_01`,
      sku,
      productName,
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      adjustmentValue: 3,
      adjustmentType: 'cycle_count',
      previousStock: Math.max(0, currentStock - 3),
      newStock: currentStock,
      operatorId: 'OP-8821 (J. Vance)',
      operatorName: 'Julian Vance - Senior Floor Specialist',
      reason: 'Standard Cycle Count Audit & Barcode Handheld Scan',
      warehouse: 'Automated Logistics Hub (WH-01)',
      batchNumber: `BATCH-${sku.replace(/[^A-Z0-9]/gi, '').slice(0, 6)}-01`,
      notes: 'Physical bin inventory confirmed with optical laser scanner.'
    },
    {
      id: `audit_dyn_${sku}_02`,
      sku,
      productName,
      timestamp: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
      adjustmentValue: 10,
      adjustmentType: 'restock',
      previousStock: Math.max(0, currentStock - 13),
      newStock: Math.max(0, currentStock - 3),
      operatorId: 'OP-4419 (M. Chen)',
      operatorName: 'Mei Chen - Inventory Lead',
      reason: 'Inbound Pallet Acceptance & Factory Inspection',
      warehouse: 'Automated Logistics Hub (WH-01)',
      batchNumber: `BATCH-${sku.replace(/[^A-Z0-9]/gi, '').slice(0, 6)}-02`,
      notes: 'Dock door 4 intake verified; zero packaging damage noted.'
    },
    {
      id: `audit_dyn_${sku}_03`,
      sku,
      productName,
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      adjustmentValue: -1,
      adjustmentType: 'subtract',
      previousStock: Math.max(1, currentStock - 12),
      newStock: Math.max(0, currentStock - 13),
      operatorId: 'OP-1092 (R. Patel)',
      operatorName: 'Raj Patel - Quality Auditor',
      reason: 'Compliance & Calibration Bench Testing Hold',
      warehouse: 'Automated Logistics Hub (WH-01)',
      batchNumber: `BATCH-${sku.replace(/[^A-Z0-9]/gi, '').slice(0, 6)}-03`,
      notes: 'Unit pulled for certified ISO electromagnetic compliance audit.'
    }
  ];
}

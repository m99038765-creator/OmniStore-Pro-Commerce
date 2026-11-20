import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Product } from '../types';
import { getRegionalHubByName, RegionalHub } from './transitCalculator';

export interface WarehouseFacilityMetadata {
  streetAddress: string;
  postalCode: string;
  dockBay: string;
  carrierAccount: string;
  zonePrefix: string;
}

export interface ShippingLabelManifestItem {
  product: Product;
  hub: RegionalHub;
  facility: WarehouseFacilityMetadata;
  binLocation: string;
  aisleCode: string;
  zoneCode: string;
  trackingNumber: string;
  estimatedWeightLbs: number;
  handlingTags: string[];
}

export interface BatchShippingLabelsPdfResult {
  batchId: string;
  filename: string;
  pageCount: number;
  warehousesCovered: string[];
  generatedAt: string;
  items: ShippingLabelManifestItem[];
}

const HUB_FACILITY_MAP: Record<string, WarehouseFacilityMetadata> = {
  'wh-01-sf': {
    streetAddress: '1850 Mariposa Logistics Pkwy, Suite 400',
    postalCode: '94107',
    dockBay: 'DOCK A-04',
    carrierAccount: 'OMNI-WST-8801',
    zonePrefix: 'W1'
  },
  'wh-02-ny': {
    streetAddress: '420 Port Newark Freight Way, Bldg 7',
    postalCode: '10013',
    dockBay: 'DOCK E-12',
    carrierAccount: 'OMNI-EST-4402',
    zonePrefix: 'E2'
  },
  'wh-03-chi': {
    streetAddress: '2900 O\'Hare Cargo Blvd, Terminal C',
    postalCode: '60666',
    dockBay: 'DOCK M-08',
    carrierAccount: 'OMNI-MID-3103',
    zonePrefix: 'M3'
  },
  'wh-03-sea': {
    streetAddress: '7400 Duwamish Industrial Way S, Bay 3',
    postalCode: '98108',
    dockBay: 'DOCK P-03',
    carrierAccount: 'OMNI-PNW-7703',
    zonePrefix: 'P3'
  },
  'wh-04-la': {
    streetAddress: '5100 Alameda Distribution Ctr, Gate 9',
    postalCode: '90058',
    dockBay: 'DOCK S-09',
    carrierAccount: 'OMNI-SOC-9204',
    zonePrefix: 'S4'
  },
  'wh-01-den': {
    streetAddress: '14200 E 40th Ave Freight Hub, Unit B',
    postalCode: '80239',
    dockBay: 'DOCK R-02',
    carrierAccount: 'OMNI-RMN-5501',
    zonePrefix: 'R1'
  }
};

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function estimateWeightByCategory(category: Product['category'], skuHash: number): number {
  const baseByCat: Record<Product['category'], number> = {
    workstation: 18.4,
    optics: 6.2,
    audio: 11.5,
    computing: 3.8,
    peripherals: 4.1
  };
  const base = baseByCat[category] ?? 5.5;
  const variance = ((skuHash % 24) - 10) * 0.1;
  return Math.max(0.8, Math.round((base + variance) * 10) / 10);
}

function formatDateStamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function formatReadableTimestamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * Builds structured warehouse routing & shipping label metadata for each selected SKU,
 * sorted by warehouse hub and bin location for streamlined floor batch picking.
 */
export function buildShippingLabelManifest(
  products: Product[],
  now: Date = new Date()
): ShippingLabelManifestItem[] {
  const dateStamp = formatDateStamp(now).slice(2); // YYMMDD

  const items: ShippingLabelManifestItem[] = products.map((product) => {
    const hub = getRegionalHubByName(product.warehouse);
    const facility = HUB_FACILITY_MAP[hub.id] || HUB_FACILITY_MAP['wh-01-sf'];
    const h = hashString(`${product.sku}:${hub.code}`);

    const zoneLetter = String.fromCharCode(65 + (h % 6)); // A..F
    const aisleNum = String(1 + ((h >> 3) % 14)).padStart(2, '0');
    const shelfTier = String.fromCharCode(65 + ((h >> 7) % 4)); // A..D
    const binSlot = String(1 + ((h >> 9) % 24)).padStart(2, '0');

    const zoneCode = `${facility.zonePrefix}-${zoneLetter}`;
    const aisleCode = `A${aisleNum}`;
    const binLocation = `${zoneCode}-${aisleCode}-${shelfTier}${binSlot}`;

    const skuClean = product.sku.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
    const checkDigits = String(1000 + (h % 9000));
    const trackingNumber = `OMN-${hub.code.replace('-', '')}-${dateStamp}-${skuClean}-${checkDigits}`;

    const handlingTags =
      product.warehouseTags && product.warehouseTags.length > 0
        ? product.warehouseTags.map((t) => t.toUpperCase())
        : product.category === 'optics' || product.category === 'audio'
        ? ['FRAGILE', 'INSURED PARCEL']
        : ['STANDARD FREIGHT'];

    return {
      product,
      hub,
      facility,
      binLocation,
      aisleCode,
      zoneCode,
      trackingNumber,
      estimatedWeightLbs: estimateWeightByCategory(product.category, h),
      handlingTags
    };
  });

  // Sort by hub code, then bin location, then SKU for efficient warehouse staging
  items.sort((a, b) => {
    const hubCmp = a.hub.name.localeCompare(b.hub.name);
    if (hubCmp !== 0) return hubCmp;
    const binCmp = a.binLocation.localeCompare(b.binLocation);
    if (binCmp !== 0) return binCmp;
    return a.product.sku.localeCompare(b.product.sku);
  });

  return items;
}

/**
 * Draws a crisp vector 1D Code-128-style routing barcode directly onto the jsPDF canvas.
 */
function drawVectorBarcode(
  doc: jsPDF,
  code: string,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // Deterministic bit sequence derived from code characters (start guard + payload + stop guard)
  const bars: number[] = [2, 1, 1, 2, 1, 2]; // start guard
  for (let i = 0; i < code.length; i++) {
    const ch = code.charCodeAt(i);
    bars.push(1 + (ch % 3));
    bars.push(1 + ((ch >> 2) % 2));
    bars.push(1 + ((ch >> 4) % 3));
    bars.push(1 + ((ch >> 1) % 2));
  }
  bars.push(2, 1, 2, 1, 1, 2); // stop guard

  const totalUnits = bars.reduce((s, v) => s + v, 0);
  const unitW = width / totalUnits;

  doc.setFillColor(15, 23, 42);
  let cursorX = x;
  bars.forEach((units, idx) => {
    const w = units * unitW;
    if (idx % 2 === 0) {
      doc.rect(cursorX, y, Math.max(0.55, w), height, 'F');
    }
    cursorX += w;
  });
}

/**
 * Generates and downloads a multi-page printable 4"x6" Shipping Labels PDF
 * (one label page per selected SKU) enriched with live warehouse location data.
 */
export async function downloadBatchShippingLabelsPdf(
  selectedProducts: Product[],
  preparedBy = 'Warehouse Operations Lead'
): Promise<BatchShippingLabelsPdfResult> {
  if (!selectedProducts || selectedProducts.length === 0) {
    throw new Error('At least one SKU must be selected to generate shipping labels.');
  }

  const now = new Date();
  const manifestItems = buildShippingLabelManifest(selectedProducts, now);
  const dateStamp = formatDateStamp(now);
  const batchSuffix = String(1000 + (hashString(`${dateStamp}:${manifestItems.length}`) % 9000));
  const batchId = `SHP-${dateStamp}-${batchSuffix}`;

  // Pre-generate crisp QR codes for all selected SKUs in parallel
  const qrDataUrls = await Promise.all(
    manifestItems.map((item) => {
      const qrPayload = JSON.stringify({
        type: 'OMNISTORE_SHIPPING_LABEL',
        batch: batchId,
        sku: item.product.sku,
        hub: item.hub.code,
        warehouse: item.hub.name,
        city: `${item.hub.city}, ${item.hub.state}`,
        bin: item.binLocation,
        tracking: item.trackingNumber
      });
      return QRCode.toDataURL(qrPayload, {
        width: 240,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    })
  );

  // Standard 4" x 6" Thermal Shipping Label (288 pt x 432 pt)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [288, 432]
  });

  const pageW = 288;
  const pageH = 432;
  const pad = 14;
  const innerW = pageW - pad * 2;
  const totalPages = manifestItems.length;
  const printableTs = formatReadableTimestamp(now);

  manifestItems.forEach((item, index) => {
    if (index > 0) {
      doc.addPage([288, 432], 'portrait');
    }

    const { product, hub, facility, binLocation, trackingNumber, estimatedWeightLbs, handlingTags } = item;
    const availableUnits = Math.max(0, product.stock - (product.reserved || 0));

    // Outer label crisp border
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1.4);
    doc.rect(pad - 4, pad - 4, innerW + 8, pageH - (pad - 4) * 2);

    // 1. Top Service & Hub Routing Header Band
    const topY = pad - 4;
    doc.setFillColor(15, 23, 42);
    doc.rect(pad - 4, topY, innerW + 8, 40, 'F');

    // Large bold Hub Code Box (Left)
    doc.setFillColor(255, 255, 255);
    doc.rect(pad, topY + 4, 58, 32, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(hub.code, pad + 29, topY + 25, { align: 'center' });

    // Carrier Service Header (Center)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('OMNISTORE FREIGHT', pad + 66, topY + 17);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${hub.region.toUpperCase()} · <${hub.dispatchSlaHours}H SLA`, pad + 66, topY + 29);

    // Page Counter Badge (Right)
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(52, 211, 153);
    doc.text(`LBL ${index + 1}/${totalPages}`, pageW - pad, topY + 17, { align: 'right' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(203, 213, 225);
    doc.text(`${estimatedWeightLbs.toFixed(1)} LBS`, pageW - pad, topY + 29, { align: 'right' });

    let y = topY + 48;

    // 2. Origin Warehouse Facility Location Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text('ORIGIN WAREHOUSE / FULFILLMENT FACILITY', pad, y);
    doc.text(facility.dockBay, pageW - pad, y, { align: 'right' });
    y += 11;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(hub.name, pad, y);
    y += 11;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(facility.streetAddress, pad, y);
    y += 10;
    doc.text(`${hub.city}, ${hub.state} ${facility.postalCode} · USA`, pad, y);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `GPS ${hub.lat.toFixed(2)}, ${hub.lng.toFixed(2)}`,
      pageW - pad,
      y,
      { align: 'right' }
    );
    y += 9;

    // Divider
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1);
    doc.line(pad - 4, y, pageW - pad + 4, y);
    y += 9;

    // 3. Warehouse Routing & Bin Location Highlight Grid
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.7);
    doc.roundedRect(pad, y, innerW, 44, 3, 3, 'FD');

    // Vertical split inside routing box
    const midX = pad + innerW * 0.56;
    doc.setDrawColor(203, 213, 225);
    doc.line(midX, y + 4, midX, y + 40);

    // Left: Bin / Aisle / Zone
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('WAREHOUSE BIN / LOCATION', pad + 7, y + 11);

    doc.setFont('courier', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(binLocation, pad + 7, y + 26);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`CUTOFF ${hub.cutOffHourLocal}:00 · ${facility.carrierAccount}`, pad + 7, y + 37);

    // Right: Stock & Availability
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('HUB STOCK / AVAIL', midX + 7, y + 11);

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${product.stock}u / ${availableUnits}u`, midX + 7, y + 26);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`CAT: ${product.category.toUpperCase()}`, midX + 7, y + 37);

    y += 52;

    // 4. SKU Manifest + Embedded Scannable QR Code
    const qrSize = 76;
    const textColW = innerW - qrSize - 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text('SKU IDENTIFIER & ITEM MANIFEST', pad, y);

    // SKU Bold Highlight
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(product.sku, pad, y + 15);

    // Product Name (wrapped cleanly up to 3 lines)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    const wrappedName = doc.splitTextToSize(product.name, textColW).slice(0, 3);
    doc.text(wrappedName, pad, y + 27);

    // Value & Reserved info
    const metaY = y + 27 + wrappedName.length * 10 + 4;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `VAL $${product.price.toFixed(2)} · RSV ${product.reserved || 0}u`,
      pad,
      Math.min(metaY, y + 66)
    );

    // Batch ID
    doc.text(`BATCH ${batchId}`, pad, Math.min(metaY + 10, y + 76));

    // QR Code box on the right
    const qrX = pageW - pad - qrSize;
    const qrY = y - 2;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.8);
    doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
    doc.addImage(qrDataUrls[index], 'PNG', qrX, qrY, qrSize, qrSize);

    y += qrSize + 10;

    // 5. Handling Instructions / Warehouse Tags Strip
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.6);
    doc.line(pad - 4, y, pageW - pad + 4, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('HANDLING FLAGS:', pad, y + 8);

    let chipX = pad + 68;
    handlingTags.slice(0, 3).forEach((tag) => {
      const label = tag.slice(0, 14);
      const chipW = Math.min(80, label.length * 4.4 + 10);
      if (chipX + chipW > pageW - pad) return;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(chipX, y, chipW, 12, 2, 2, 'F');
      doc.setFont('courier', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(label, chipX + chipW / 2, y + 8.3, { align: 'center' });
      chipX += chipW + 4;
    });

    y += 18;

    // 6. Carrier 1D Routing Barcode & Tracking Number Section
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1.2);
    doc.line(pad - 4, y, pageW - pad + 4, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text('WAYBILL / ROUTING BARCODE', pageW / 2, y, { align: 'center' });
    y += 6;

    drawVectorBarcode(doc, trackingNumber, pad + 4, y, innerW - 8, 52);
    y += 64;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(trackingNumber, pageW / 2, y, { align: 'center' });

    // 7. Label Footer
    const footerY = pageH - pad - 4;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(pad, footerY - 12, pageW - pad, footerY - 12);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${printableTs} · ${preparedBy.slice(0, 18)}`, pad, footerY - 2);
    doc.text(`PAGE ${index + 1} OF ${totalPages}`, pageW - pad, footerY - 2, { align: 'right' });
  });

  // Mark PDF for immediate print dialog when opened in desktop PDF viewers
  doc.autoPrint();

  const filename = `Batch-Shipping-Labels-${dateStamp}-${totalPages}SKUs.pdf`;
  doc.save(filename);

  const warehousesCovered = Array.from(new Set(manifestItems.map((i) => i.hub.name)));

  return {
    batchId,
    filename,
    pageCount: totalPages,
    warehousesCovered,
    generatedAt: now.toISOString(),
    items: manifestItems
  };
}

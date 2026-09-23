import re

with open("src/components/WarehouseBatchStockUpdate.tsx", "r") as f:
    content = f.read()

# 1. Add imports
content = content.replace("import {", "import QRCode from 'qrcode';\nimport {", 1)

if "Printer" not in content and "lucide-react" in content:
    content = content.replace("import {", "import {\n  Printer,", 1)

# 2. Add handlePrintLabels function
print_fn = """
  const handlePrintLabels = async () => {
    if (selectedProducts.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addAlert('Please allow popups to print labels.', 'error');
      return;
    }

    try {
      const labelsHtml = await Promise.all(selectedProducts.map(async (p) => {
        const qrDataUrl = await QRCode.toDataURL(p.sku, { width: 150, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        return `
          <div class="label">
            <div class="sku">${p.sku}</div>
            <img src="${qrDataUrl}" alt="QR Code for ${p.sku}" />
            <div class="name">${p.name}</div>
            <div class="warehouse">${p.warehouse}</div>
          </div>
        `;
      }));

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Batch Labels - ${new Date().toISOString()}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: white; color: black; }
              .grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
              }
              .label {
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 16px;
                text-align: center;
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
              }
              .label img { width: 120px; height: 120px; margin: 8px 0; }
              .sku { font-family: monospace; font-weight: bold; font-size: 16px; letter-spacing: 1px; }
              .name { font-size: 12px; font-weight: 600; text-transform: uppercase; margin-top: 4px; }
              .warehouse { font-size: 10px; color: #666; margin-top: 4px; }
              @media print {
                body { padding: 0; }
                .grid { gap: 10px; }
                .label { border: 1px dashed #999; }
                @page { margin: 0.5in; }
              }
            </style>
          </head>
          <body>
            <div class="grid">
              ${labelsHtml.join('')}
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      console.error('Error generating labels:', err);
      addAlert('Failed to generate print layout.', 'error');
    }
  };

  const handleExecuteBatchAdjustment = () => {
"""

content = content.replace("  const handleExecuteBatchAdjustment = () => {", print_fn)

# 3. Add print button below execute button
old_button_block = """            {/* Execute Batch Action Button */}
            <button
              id="execute-batch-stock-update-btn"
              type="button"
              onClick={handleExecuteBatchAdjustment}
              disabled={selectedProductIds.length === 0 || isSubmitting}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                selectedProductIds.length === 0 || isSubmitting
                  ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/20 active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Applying Batch Update across {selectedProductIds.length} SKUs...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {selectedProductIds.length === 0
                      ? 'Select SKUs to Apply Batch Update'
                      : `Apply Uniform Adjustment (${selectedProductIds.length} SKUs)`}
                  </span>
                </>
              )}
            </button>"""

new_button_block = """            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                id="execute-batch-stock-update-btn"
                type="button"
                onClick={handleExecuteBatchAdjustment}
                disabled={selectedProductIds.length === 0 || isSubmitting}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                  selectedProductIds.length === 0 || isSubmitting
                    ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/20 active:scale-[0.98]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Applying Batch Update across {selectedProductIds.length} SKUs...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {selectedProductIds.length === 0
                        ? 'Select SKUs to Apply Batch Update'
                        : `Apply Uniform Adjustment (${selectedProductIds.length} SKUs)`}
                    </span>
                  </>
                )}
              </button>

              <button
                id="print-batch-labels-btn"
                type="button"
                onClick={handlePrintLabels}
                disabled={selectedProductIds.length === 0 || isSubmitting}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  selectedProductIds.length === 0 || isSubmitting
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 hover:border-neutral-600'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>Print Batch Labels ({selectedProductIds.length})</span>
              </button>
            </div>"""

content = content.replace(old_button_block, new_button_block)

with open("src/components/WarehouseBatchStockUpdate.tsx", "w") as f:
    f.write(content)

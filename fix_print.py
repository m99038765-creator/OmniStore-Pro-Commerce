import re

with open("src/components/WarehouseBatchStockUpdate.tsx", "r") as f:
    content = f.read()

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

  const handleExecuteBatchAdjustment = async () => {
"""

content = content.replace("  const handleExecuteBatchAdjustment = async () => {", print_fn)

with open("src/components/WarehouseBatchStockUpdate.tsx", "w") as f:
    f.write(content)


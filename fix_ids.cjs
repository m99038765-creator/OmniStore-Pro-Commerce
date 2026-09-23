const fs = require('fs');

function replaceRandoms(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  
  if (!content.includes('let idCounter = 0;')) {
    // Add counter at top if not exists
    if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
      const importMatch = content.match(/import.*?;\n/g);
      let lastImportIndex = 0;
      if (importMatch) {
         const lastImport = importMatch[importMatch.length - 1];
         lastImportIndex = content.lastIndexOf(lastImport) + lastImport.length;
      }
      content = content.slice(0, lastImportIndex) + '\nlet _globalIdCounter = 0;\nconst _getUniqueId = (prefix = "id") => `${prefix}_${Date.now()}_${++_globalIdCounter}`;\n' + content.slice(lastImportIndex);
    }
  }

  content = content.replace(/'scan_' \+ Date\.now\(\)\.toString\(36\) \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 6\)/g, '_getUniqueId("scan")');
  content = content.replace(/'act_' \+ Date\.now\(\) \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 6\)/g, '_getUniqueId("act")');
  content = content.replace(/'alt_' \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 9\)/g, '_getUniqueId("alt")');
  content = content.replace(/'alt_price_' \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 9\)/g, '_getUniqueId("alt_price")');
  content = content.replace(/`ord_custom_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substring\(2, 6\)\}`/g, '_getUniqueId("ord_custom")');
  content = content.replace(/`txn_\$\{Math\.random\(\)\.toString\(36\)\.substring\(2, 11\)\}`/g, '_getUniqueId("txn")');

  fs.writeFileSync(filepath, content);
}

replaceRandoms('src/components/WarehouseBarcodeScanner.tsx');
replaceRandoms('src/context/StoreContext.tsx');
replaceRandoms('src/data/sampleOrders.ts');

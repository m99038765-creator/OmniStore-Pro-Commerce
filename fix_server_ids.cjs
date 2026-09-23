const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('let _serverIdCounter = 0;')) {
  const importMatch = content.match(/import.*?;\n/g);
  let lastImportIndex = 0;
  if (importMatch) {
     const lastImport = importMatch[importMatch.length - 1];
     lastImportIndex = content.lastIndexOf(lastImport) + lastImport.length;
  }
  content = content.slice(0, lastImportIndex) + '\nlet _serverIdCounter = 0;\nconst _getUniqueServerId = (prefix = "id") => `${prefix}_${Date.now()}_${++_serverIdCounter}`;\n' + content.slice(lastImportIndex);
}

content = content.replace(/'res_' \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 10\)/g, '_getUniqueServerId("res")');
content = content.replace(/'ord_' \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 12\)/g, '_getUniqueServerId("ord")');
content = content.replace(/'txn_' \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 14\)/g, '_getUniqueServerId("txn")');
content = content.replace(/'audit_' \+ Math\.random\(\)\.toString\(36\)\.substring\(2, 11\)/g, '_getUniqueServerId("audit")');
content = content.replace(/`audit-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 6\)\}`/g, '_getUniqueServerId("audit")');

fs.writeFileSync('server.ts', content);

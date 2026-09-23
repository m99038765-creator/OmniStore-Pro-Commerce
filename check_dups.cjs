const fs = require("fs");
const path = require("path");

function checkFile(filepath) {
  const content = fs.readFileSync(filepath, "utf8");
  const idMatches = content.match(/id:\s*['"`]([^'"`]+)['"`]/g);
  if (idMatches) {
    const ids = idMatches.map(m => m.match(/['"`]([^'"`]+)['"`]/)[1]);
    const counts = {};
    ids.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > 1) {
        console.log(`Duplicate ID in ${filepath}: ${id}`);
      }
    });
  }
}

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) walk(fullPath);
    else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) checkFile(fullPath);
  });
}
walk("src");

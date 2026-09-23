const fs = require("fs");
const path = require("path");

function walk(dir, regex) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) walk(fullPath, regex);
    else if (fullPath.endsWith(".tsx")) {
        const content = fs.readFileSync(fullPath, "utf8");
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (line.includes('key={') || line.includes('key=')) {
                // we just want to know where keys are being used and potentially duplicate
                // this is just to spot it
            }
        });
    }
  });
}
// Actually, let's just use grep on the shell to see all map iterations and keys.

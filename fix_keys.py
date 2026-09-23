import os
import re

directory = "src"
for root, _, files in os.walk(directory):
    for file in files:
        if not file.endswith((".tsx", ".ts")):
            continue
        path = os.path.join(root, file)
        with open(path, "r") as f:
            content = f.read()
        
        # Replace key={`${something.id}-${index}`} with key={something.id}
        content = re.sub(r'key={`\$\{([^}]+)\.id\}-\$\{index\}`}', r'key={\1.id}', content)
        
        # Replace key={`${sku}-${index}`} with key={sku}
        content = re.sub(r'key={`\$\{sku\}-\$\{index\}`}', r'key={sku}', content)
        
        # Replace key={`${wh.name}-${index}`} with key={wh.name}
        content = re.sub(r'key={`\$\{wh.name\}-\$\{index\}`}', r'key={wh.name}', content)

        with open(path, "w") as f:
            f.write(content)

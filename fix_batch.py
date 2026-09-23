import re

with open("src/components/WarehouseBatchStockUpdate.tsx", "r") as f:
    content = f.read()

# Replace key={`${product.id}-${index}`} with key={product.id}
content = content.replace('key={`${product.id}-${index}`}', 'key={product.id}')

with open("src/components/WarehouseBatchStockUpdate.tsx", "w") as f:
    f.write(content)

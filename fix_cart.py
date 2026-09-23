import re

with open("src/components/CartDrawer.tsx", "r") as f:
    content = f.read()

# Replace key={`${item.product.id}-${index}`} with key={item.product.id}
content = content.replace('key={`${item.product.id}-${index}`}', 'key={item.product.id}')

with open("src/components/CartDrawer.tsx", "w") as f:
    f.write(content)

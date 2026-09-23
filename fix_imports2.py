import re

with open("src/components/ProductCard.tsx", "r") as f:
    content = f.read()

content = content.replace("import { Star,", "import { Navigation, Star,")

with open("src/components/ProductCard.tsx", "w") as f:
    f.write(content)

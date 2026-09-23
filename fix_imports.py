import re

with open("src/components/ProductCard.tsx", "r") as f:
    content = f.read()

# Fix the broken import
content = content.replace("import {\n  Navigation, motion } from 'motion/react';", "import { motion } from 'motion/react';")

# Add Navigation to lucide-react if not there
if "Navigation" not in content and "lucide-react" in content:
    content = content.replace("import { Star, ", "import { Navigation, Star, ", 1)

with open("src/components/ProductCard.tsx", "w") as f:
    f.write(content)

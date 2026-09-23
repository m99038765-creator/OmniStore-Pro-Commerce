import re

with open("src/App.tsx", "r") as f:
    content = f.read()

# Add import
content = content.replace(
    "import { OrderHistoryModal } from './components/OrderHistoryModal';",
    "import { OrderHistoryModal } from './components/OrderHistoryModal';\nimport { NewsletterSubscription } from './components/NewsletterSubscription';"
)

# Insert component before footer
old_footer = """      {/* Footer */}
      <footer"""

new_footer = """      {/* Newsletter */}
      <NewsletterSubscription />

      {/* Footer */}
      <footer"""

content = content.replace(old_footer, new_footer)

with open("src/App.tsx", "w") as f:
    f.write(content)


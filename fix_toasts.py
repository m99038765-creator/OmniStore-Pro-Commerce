import re

with open("src/components/NotificationToasts.tsx", "r") as f:
    content = f.read()

# Replace key={`${alert.id}-${index}`} with key={alert.id}
content = content.replace('key={`${alert.id}-${index}`}', 'key={alert.id}')

with open("src/components/NotificationToasts.tsx", "w") as f:
    f.write(content)

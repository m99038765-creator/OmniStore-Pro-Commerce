with open("src/components/SkuAuditLogModal.tsx", "r") as f:
    content = f.read()

content = content.replace('key={entry.id || index}', 'key={`${entry.id}-${index}`}')

with open("src/components/SkuAuditLogModal.tsx", "w") as f:
    f.write(content)

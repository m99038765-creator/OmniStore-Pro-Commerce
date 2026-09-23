import re

with open("src/context/StoreContext.tsx", "r") as f:
    content = f.read()

missing_block = """  const removeInventoryAlert = useCallback((productId: string) => {
    setInventoryAlerts(prev => prev.filter(a => a.productId !== productId));
    addAlert('info', 'Watch Cancelled', 'Alert removed.');
  }, [addAlert]);

  const getInventoryAlertForProduct = useCallback((productId: string) => {
    return inventoryAlerts.find(a => a.productId === productId);
  }, [inventoryAlerts]);"""

# Insert it after setInventoryAlert
set_end = content.find("  }, [addAlert]);", content.find("const setInventoryAlert"))
if set_end != -1:
    set_end += len("  }, [addAlert]);")
    content = content[:set_end] + "\n\n" + missing_block + content[set_end:]

with open("src/context/StoreContext.tsx", "w") as f:
    f.write(content)

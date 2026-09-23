import re

with open("src/context/StoreContext.tsx", "r") as f:
    content = f.read()

def replace_block(pattern_start, pattern_end, new_block, text):
    start_idx = text.find(pattern_start)
    if start_idx == -1:
        print("start not found:", pattern_start)
        return text
    end_idx = text.find(pattern_end, start_idx)
    if end_idx == -1:
        print("end not found:", pattern_end)
        return text
    end_idx += len(pattern_end)
    return text[:start_idx] + new_block + text[end_idx:]

new_check = """const checkAndTriggerInventoryAlerts = useCallback((productId: string, updates: { price?: number, stock?: number }, prodName?: string, lowStockThreshold?: number) => {
    setInventoryAlerts(prevAlerts => {
      let hasChanges = false;
      const updated = prevAlerts.map(alert => {
        if (alert.productId === productId) {
          let updatedAlert = { ...alert };
          if (updates.price !== undefined) updatedAlert.currentPrice = updates.price;
          
          let justTriggered = false;

          // Price Check
          if (updates.price !== undefined && alert.targetPrice && updates.price <= alert.targetPrice && alert.status !== 'triggered') {
            hasChanges = true;
            justTriggered = true;
            const savings = Math.max(0, alert.originalPriceAtCreation - updates.price);
            const savingsText = savings > 0 ? ` (Save $${savings.toFixed(2)}!)` : '';

            addAlert(
              'success',
              '🎯 Target Price Met!',
              `"${alert.productName}" dropped to $${updates.price.toFixed(2)} (Target: ≤$${alert.targetPrice.toFixed(2)})${savingsText}. Ready for immediate checkout!`
            );
            playPriceDropChime();

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`🎯 Price Drop Alert: ${alert.productName}`, {
                  body: `Price reached $${updates.price.toFixed(2)} (Target: ≤$${alert.targetPrice.toFixed(2)})!`,
                  icon: alert.productImage || '/favicon.ico'
                });
              } catch {}
            }

            updatedAlert.status = 'triggered';
            updatedAlert.triggeredAt = new Date().toISOString();
            updatedAlert.triggeredPrice = updates.price;
          }

          // Restock Check
          if (updates.stock !== undefined && alert.notifyOnRestock && updates.stock > 0) {
            hasChanges = true;
            justTriggered = true;
            addAlert('success', '📦 Back in Stock!', `"${alert.productName}" is now back in stock!`);
            playPriceDropChime();
            updatedAlert.notifyOnRestock = false;
            
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try { new Notification(`📦 Restock Alert: ${alert.productName}`, { body: `The product is back in stock.`, icon: alert.productImage || '/favicon.ico' }); } catch {}
            }
          }

          // Low Stock Check
          if (updates.stock !== undefined && alert.notifyOnLowStock && updates.stock > 0 && updates.stock <= (lowStockThreshold || 5)) {
            hasChanges = true;
            justTriggered = true;
            addAlert('warning', '⚠️ Low Stock Alert!', `"${alert.productName}" is running low (${updates.stock} left).`);
            playPriceDropChime();
            updatedAlert.notifyOnLowStock = false;
            
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try { new Notification(`⚠️ Low Stock: ${alert.productName}`, { body: `Only ${updates.stock} left.`, icon: alert.productImage || '/favicon.ico' }); } catch {}
            }
          }

          if (updates.price !== undefined && !hasChanges) {
             hasChanges = true;
          }

          return updatedAlert;
        }
        return alert;
      });
      return hasChanges ? updated : prevAlerts;
    });
  }, [addAlert, playPriceDropChime]);"""

content = replace_block("const checkAndTriggerInventoryAlerts = useCallback((productId: string, currentPrice: number, prodName?: string) => {", "  }, [addAlert, playPriceDropChime]);", new_check, content)

new_set = """const setInventoryAlert = useCallback((product: Product, options: { targetPrice?: number | null, notifyOnRestock?: boolean, notifyOnLowStock?: boolean, notificationEmail?: string }) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const roundedTarget = options.targetPrice ? Math.round(options.targetPrice * 100) / 100 : undefined;
    const isMetAlready = roundedTarget ? product.price <= roundedTarget : false;

    setInventoryAlerts(prev => {
      const existingIdx = prev.findIndex(a => a.productId === product.id);

      const baseAlert = existingIdx >= 0 ? prev[existingIdx] : {
        id: _getUniqueId("alt_price"),
        productId: product.id,
        productName: product.name,
        productImage: product.images[0] || '',
        sku: product.sku,
        originalPriceAtCreation: product.price,
        currentPrice: product.price,
        createdAt: new Date().toISOString()
      };

      const newAlert: InventoryAlert = {
        ...baseAlert,
        targetPrice: roundedTarget !== undefined ? roundedTarget : baseAlert.targetPrice,
        notifyOnRestock: options.notifyOnRestock ?? baseAlert.notifyOnRestock,
        notifyOnLowStock: options.notifyOnLowStock ?? baseAlert.notifyOnLowStock,
        notificationEmail: options.notificationEmail?.trim() ?? baseAlert.notificationEmail ?? '',
        status: isMetAlready ? 'triggered' : 'active',
      };

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = newAlert;
        return copy;
      }
      return [...prev, newAlert];
    });

    addAlert('success', 'Alert Saved', `You are now tracking "${product.name}".`);
  }, [addAlert]);"""

content = replace_block("const setInventoryAlert = useCallback((product: Product, targetPrice: number, notificationEmail?: string) => {", "  }, [addAlert]);", new_set, content)

with open("src/context/StoreContext.tsx", "w") as f:
    f.write(content)

import re

with open("src/components/InventoryAlertModal.tsx", "r") as f:
    content = f.read()

# Replace the component name and basic state
old_form_state = """  const [targetInput, setTargetInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);

  const currentProduct: Product | null = activeInventoryAlertProduct;"""

new_form_state = """  const [targetInput, setTargetInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [notifyOnRestock, setNotifyOnRestock] = useState<boolean>(false);
  const [notifyOnLowStock, setNotifyOnLowStock] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const currentProduct: Product | null = activeInventoryAlertProduct;"""

content = content.replace(old_form_state, new_form_state)

# Replace the effect initializing the form
old_effect = """  useEffect(() => {
    if (currentProduct) {
      const existing = getInventoryAlertForProduct(currentProduct.id);
      if (existing) {
        setTargetInput(existing.targetPrice.toString());
        setEmailInput(existing.notificationEmail || '');
      } else {
        const defaultTarget = (currentProduct.price * 0.90).toFixed(2);
        setTargetInput(defaultTarget);
        setEmailInput('');
      }
    }
  }, [currentProduct, getInventoryAlertForProduct]);"""

new_effect = """  useEffect(() => {
    if (currentProduct) {
      const existing = getInventoryAlertForProduct(currentProduct.id);
      if (existing) {
        setTargetInput(existing.targetPrice ? existing.targetPrice.toString() : '');
        setEmailInput(existing.notificationEmail || '');
        setNotifyOnRestock(existing.notifyOnRestock || false);
        setNotifyOnLowStock(existing.notifyOnLowStock || false);
      } else {
        const defaultTarget = (currentProduct.price * 0.90).toFixed(2);
        setTargetInput(defaultTarget);
        setEmailInput('');
        setNotifyOnRestock(currentProduct.stock === 0); // Auto-check restock if out of stock
        setNotifyOnLowStock(currentProduct.stock > 0);
      }
    }
  }, [currentProduct, getInventoryAlertForProduct]);"""

content = content.replace(old_effect, new_effect)

# Replace handleSaveAlert
old_save = """  const handleSaveAlert = () => {
    if (!currentProduct) return;
    const target = parseFloat(targetInput);
    if (isNaN(target) || target <= 0) {
      return; // Basic validation
    }
    setInventoryAlert(currentProduct, target, emailInput);
    handleClose();
  };"""

new_save = """  const handleSaveAlert = () => {
    if (!currentProduct) return;
    const target = targetInput.trim() ? parseFloat(targetInput) : null;
    if (target !== null && (isNaN(target) || target < 0)) {
      return; // Basic validation
    }
    setInventoryAlert(currentProduct, {
      targetPrice: target,
      notifyOnRestock,
      notifyOnLowStock,
      notificationEmail: emailInput
    });
    handleClose();
  };"""

content = content.replace(old_save, new_save)

with open("src/components/InventoryAlertModal.tsx", "w") as f:
    f.write(content)

import re

with open("src/components/ProductCard.tsx", "r") as f:
    content = f.read()

# Add import
import_stmt = "import { getDistanceToWarehouse, MOCK_USER_LOCATION } from '../utils/distance';"
content = content.replace("import { Product } from '../types';", "import { Product } from '../types';\n" + import_stmt)

# Add Navigation icon if not there (we have MapPin already)
if "Navigation" not in content and "lucide-react" in content:
    content = content.replace("import {", "import {\n  Navigation,", 1)

# Add hook calculation
hook_spot = "const existingAlert = inventoryAlerts.find(a => a.productId === product.id);"
calc_str = """
  const distance = getDistanceToWarehouse(product.warehouse);
"""
content = content.replace(hook_spot, hook_spot + calc_str)

# Update UI block
old_ui = """            <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1 shrink-0">
              <MapPin className="w-2.5 h-2.5 text-neutral-500" />
              {product.warehouse.split('(')[0].trim()}
            </span>"""

new_ui = """            <div className="flex flex-col items-end shrink-0 text-right">
              <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1 justify-end">
                <MapPin className="w-2.5 h-2.5 text-neutral-500" />
                {product.warehouse.split('(')[0].trim()}
              </span>
              {distance !== null && (
                <span className={`text-[9px] font-mono flex items-center gap-1 justify-end mt-0.5 ${
                  distance < 500 ? 'text-emerald-400' : distance < 1500 ? 'text-amber-400' : 'text-rose-400'
                }`} title={`Simulated distance from ${MOCK_USER_LOCATION.city}`}>
                  <Navigation className="w-2 h-2" />
                  {distance} mi away
                </span>
              )}
            </div>"""

content = content.replace(old_ui, new_ui)

with open("src/components/ProductCard.tsx", "w") as f:
    f.write(content)

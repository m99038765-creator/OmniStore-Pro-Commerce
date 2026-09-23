import re

with open("src/components/WarehouseBatchStockUpdate.tsx", "r") as f:
    content = f.read()

# 1. Add ScanLine to lucide-react imports if not there (or QrCode)
if "ScanLine" not in content and "lucide-react" in content:
    content = content.replace("import {", "import {\n  ScanLine,\n  QrCode,", 1)
else:
    # Just to be safe, replace an existing import block
    content = content.replace("import {", "import {\n  ScanLine,\n  QrCode,", 1)

# 2. Add ScannerModal import
content = content.replace(
    "import { useStore } from '../context/StoreContext';",
    "import { useStore } from '../context/StoreContext';\nimport { ScannerModal } from './ScannerModal';"
)

# 3. Add state for scanner modal
state_hook = """  const [searchQuery, setSearchQuery] = useState('');"""
new_state_hook = """  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);"""
content = content.replace(state_hook, new_state_hook)

# 4. Add scanner button next to search input
search_input_ui = """                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="batch-search-skus-input"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter SKUs by code, product, or warehouse..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>"""

new_search_input_ui = """                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="batch-search-skus-input"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter SKUs by code, product, or warehouse..."
                  className="w-full pl-8 pr-9 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors"
                title="Scan barcode with camera"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Scan</span>
              </button>"""
content = content.replace(search_input_ui, new_search_input_ui)

# 5. Add ScannerModal component to the render output
end_tag = "    </div>\n  );\n};\n"
if end_tag in content:
    content = content.replace(end_tag, """
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => {
          setSearchQuery(code);
          setIsScannerOpen(false);
        }}
      />
    </div>
  );
};
""")

with open("src/components/WarehouseBatchStockUpdate.tsx", "w") as f:
    f.write(content)


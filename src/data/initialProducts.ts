import { Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_studio_ref_monitors',
    sku: 'AUD-REF-8040',
    name: 'AcousticLab Model 8 Active Reference Monitors',
    tagline: 'Nearfield coaxial acoustic monitors with bi-amplified DSP room calibration',
    description: 'Engineered for audio mastering engineers and demanding producers. Features custom woven Kevlar woofers, waveguide titanium dome tweeters, and 192kHz/24-bit floating point hardware DSP equalization.',
    category: 'audio',
    price: 849.00,
    originalPrice: 999.00,
    rating: 4.9,
    reviewCount: 142,
    stock: 7,
    reserved: 0,
    lowStockThreshold: 4,
    warehouse: 'Bay Area Hub (WH-01)',
    images: [
      'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=900&auto=format&fit=crop&q=80'
    ],
    features: [
      'Bi-amplified 180W Class-D amplification',
      'Integrated hardware room-correction DSP',
      'Balanced XLR & TRS gold-plated inputs',
      'Precision acoustic baffle isolation feet included'
    ],
    specs: {
      'Frequency Response': '38 Hz – 28 kHz (±2dB)',
      'Amplifier Power': '120W LF + 60W HF',
      'Max Peak SPL': '112 dB SPL @ 1m',
      'Input Impedance': '10 kOhms Balanced',
      'Weight': '11.4 kg / 25.1 lbs per pair'
    },
    isTrending: true,
    isBestSeller: true,
    warranty: '5-Year Manufacturer Express Warranty'
  },
  {
    id: 'prod_mech_keyboard_cnc',
    sku: 'KB-TITAN-75',
    name: 'Vanguard 75% CNC Billet Aluminum Mechanical Keyboard',
    tagline: 'Gasket-mounted bespoke artisan keyboard with hot-swappable lubricated switches',
    description: 'Machined from a single block of aerospace-grade 6063 aluminum, anodized with a micro-bead blasted silky finish. Multi-layer Poron gasket suspension provides an incomparably deep, satisfying acoustic thock.',
    category: 'peripherals',
    price: 329.00,
    rating: 4.8,
    reviewCount: 98,
    stock: 3, // Low stock on purpose to show warning & real-time badge!
    reserved: 0,
    lowStockThreshold: 5,
    warehouse: 'East Coast DC (WH-02)',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=900&auto=format&fit=crop&q=80'
    ],
    features: [
      'Precision CNC 6063 aluminum chassis (1.9 kg net weight)',
      'Gasket mounted FR4 leaf-spring flex cut plate',
      'Factory pre-lubed Gateron Oil King linear switches',
      'South-facing per-key RGB with custom QMK/VIA keymap firmware'
    ],
    specs: {
      'Layout': '75% Compact (82 Keys + CNC Rotary Knob)',
      'Connectivity': 'Detachable Braided Type-C (1000Hz Polling)',
      'Plate Material': 'FR4 with Acoustic Flex Cuts',
      'Keycaps': 'Double-shot PBT Cherry Profile',
      'Weight': '1.92 kg / 4.23 lbs'
    },
    isTrending: true,
    warranty: '2-Year Direct Replacement Warranty'
  },
  {
    id: 'prod_cinema_camera_fx',
    sku: 'OPT-CIN-4K60',
    name: 'Lumix Alpha Full-Frame 6K Digital Cinema Core',
    tagline: 'Dual-native ISO 6K cinema camera with 15+ stops dynamic range and active sensor cooling',
    description: 'Built for independent film directors and high-end commercial visual creators. Features 10-bit 4:2:2 internal ProRes RAW recording, phase hybrid autofocus, and a dual cooling fan chamber for limitless continuous recording.',
    category: 'optics',
    price: 2399.00,
    originalPrice: 2599.00,
    rating: 5.0,
    reviewCount: 64,
    stock: 4,
    reserved: 0,
    lowStockThreshold: 3,
    warehouse: 'Bay Area Hub (WH-01)',
    images: [
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=900&auto=format&fit=crop&q=80'
    ],
    features: [
      'Full-Frame 24.2MP BSI CMOS Sensor',
      '6K 30p 3:2 Open-Gate & 4K 120p High-Speed Capture',
      'Internal 12-bit ProRes RAW / Blackmagic RAW',
      'Active thermo-electric fan for continuous non-stop shooting'
    ],
    specs: {
      'Lens Mount': 'L-Mount Alliance Standard',
      'Dynamic Range': '15+ stops (V-Log/V-Gamut)',
      'ISO Sensitivity': 'Dual Native ISO 640 & 4000 (Expandable to 204,800)',
      'Storage Slots': 'CFexpress Type B + UHS-II SDXC Dual Slot',
      'Weight': '820 g (Body only)'
    },
    isBestSeller: true,
    warranty: '3-Year Global Commercial Warranty'
  },
  {
    id: 'prod_spatial_headphones_nc',
    sku: 'AUD-HP-APEX',
    name: 'Solace Pro Spatial ANC Studio Headphones',
    tagline: 'Beryllium-coated dynamic drivers with adaptive hybrid noise cancellation',
    description: 'Immerse in uncompromised sonic fidelity with ultra-low THD (<0.05%), memory foam lambskin earcups, ultra-low latency lossless wireless connectivity, and 50-hour continuous battery reserve.',
    category: 'audio',
    price: 449.00,
    rating: 4.7,
    reviewCount: 310,
    stock: 18,
    reserved: 0,
    lowStockThreshold: 6,
    warehouse: 'Midwest Logistics (WH-03)',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=900&auto=format&fit=crop&q=80'
    ],
    features: [
      '45mm Custom Beryllium Dome Transducers',
      'Quad-microphone real-time acoustic active noise cancelling',
      'Lossless 24-bit/96kHz wireless audio codec support',
      'Forged aluminum yoke and supple lambskin ear cushions'
    ],
    specs: {
      'Frequency Band': '10 Hz – 40,000 Hz Hi-Res Certified',
      'Battery Life': 'Up to 50 hours (ANC On) / 70 hours (ANC Off)',
      'Quick Charge': '15 minutes charge = 7 hours playback',
      'Bluetooth': 'Version 5.4 with aptX Lossless & LDAC',
      'Weight': '278 g'
    },
    isBestSeller: true,
    warranty: '2-Year Premium Care Warranty'
  },
  {
    id: 'prod_ultrawide_oled_display',
    sku: 'DISP-OLED-49',
    name: 'Horizon 49" Curved QD-OLED Master Workstation Display',
    tagline: '5120x1440 Dual-QHD 240Hz 0.03ms with integrated 90W USB-C KVM dock',
    description: 'The definitive panoramic canvas for developers, designers, and traders. Infinite contrast ratio with self-emissive pixels, Delta E < 1 color accuracy calibration out of the factory, and seamless picture-by-picture dual host inputs.',
    category: 'workstation',
    price: 1399.00,
    originalPrice: 1599.00,
    rating: 4.9,
    reviewCount: 88,
    stock: 5,
    reserved: 0,
    lowStockThreshold: 4,
    warehouse: 'East Coast DC (WH-02)',
    images: [
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=900&auto=format&fit=crop&q=80'
    ],
    features: [
      'Quantum Dot OLED panel with 0.03ms GTG response time',
      'VESA DisplayHDR True Black 400 with 99.3% DCI-P3 gamut',
      'Built-in hardware KVM switch to control two systems simultaneously',
      'Single-cable 90W USB-C power delivery with Gigabit Ethernet pass-through'
    ],
    specs: {
      'Screen Size & Curve': '49-inch 32:9 Aspect Ratio / 1800R Curvature',
      'Resolution & Refresh': '5120 x 1440 @ 240 Hz',
      'Contrast Ratio': '1,500,000:1 (Infinite Black)',
      'Inputs': '2x HDMI 2.1, 1x DP 1.4, 1x USB-C 90W, 3x USB 3.2 Hub',
      'Mounting': 'VESA 100x100mm with heavy-duty ergonomic arm'
    },
    isTrending: true,
    warranty: '3-Year Zero-Burn-In Guarantee'
  },
  {
    id: 'prod_thunderbolt_raid_dock',
    sku: 'COMP-TB4-4TB',
    name: 'CipherVault Pro 4TB NVMe Thunderbolt 4 Hardware Array',
    tagline: '7,200 MB/s sustained PCIe Gen4 RAID dock with hardware AES-256 encryption',
    description: 'Mission-critical high-bandwidth storage designed for 8K REDCODE workflows. Equipped with dual internal M.2 NVMe drives in RAID 0/1 array, active heatsink chamber, and 85W host computer pass-through charging.',
    category: 'computing',
    price: 679.00,
    rating: 4.8,
    reviewCount: 52,
    stock: 11,
    reserved: 0,
    lowStockThreshold: 5,
    warehouse: 'Bay Area Hub (WH-01)',
    images: [
      'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=900&auto=format&fit=crop&q=80'
    ],
    features: [
      'Thunderbolt 4 / USB4 certified interface (40 Gbps)',
      'Configurable hardware RAID 0 (Max Speed) or RAID 1 (Full Redundancy)',
      'Dedicated hardware AES-256 encryption micro-controller',
      'Daisy-chain support for up to 5 additional Thunderbolt peripherals'
    ],
    specs: {
      'Capacity': '4.0 TB (2x 2TB Western Digital Black PCIe 4.0)',
      'Sequential Read': 'Up to 7,450 MB/s',
      'Sequential Write': 'Up to 6,900 MB/s',
      'Cooling': 'Whisper-quiet magnetic levitation fluid fan (<18 dB)',
      'Dimensions': '142 x 94 x 42 mm'
    },
    warranty: '5-Year Enterprise Data Recovery Warranty'
  },
  {
    id: 'prod_broadcast_mic_boom',
    sku: 'AUD-MIC-POD',
    name: 'Aether Broadcast XLR Cardioid Studio Microphone',
    tagline: 'Large-diaphragm dynamic broadcast capsule with internal shock suspension',
    description: 'The industry-acclaimed vocal voiceover and broadcast weapon. Optimized for tight directional pickup rejection, silky smooth voice presence, and immune to electromagnetic humming from nearby monitors.',
    category: 'audio',
    price: 389.00,
    rating: 4.9,
    reviewCount: 220,
    stock: 14,
    reserved: 0,
    lowStockThreshold: 5,
    warehouse: 'Midwest Logistics (WH-03)',
    images: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583244532610-2a234e7c3eca?w=900&auto=format&fit=crop&q=80'
    ],
    features: [
      'End-address dynamic capsule with cardioid polar pattern',
      'Integrated internal pneumatic shock isolation system',
      'Dual-layer stainless mesh pop filter prevents plosive bursts',
      'Bass roll-off and mid-range boost presence switches'
    ],
    specs: {
      'Transducer Type': 'Dynamic Moving Coil',
      'Polar Pattern': 'Cardioid (Uniform with frequency)',
      'Impedance': '150 Ohms',
      'Connector': 'Three-pin professional audio (XLR)',
      'Housing': 'Dark graphite enameled die-cast aluminum'
    },
    isBestSeller: true,
    warranty: '10-Year Built-to-Last Guarantee'
  },
  {
    id: 'prod_biometric_chronograph',
    sku: 'ACC-CHRONO-TITAN',
    name: 'Chronos Apex Titanium Biometric Field Instrument',
    tagline: 'Sapphire glass GPS telemetry timepiece with titanium grade 5 monocoque chassis',
    description: 'Precision horology meets modern health metrics. Featuring dual-frequency multi-GNSS tracking, offline topographic vector contours, solar sapphire charging lens, and 28 days of expedition battery autonomy.',
    category: 'peripherals',
    price: 799.00,
    originalPrice: 899.00,
    rating: 4.8,
    reviewCount: 79,
    stock: 2, // Low stock - 2 units left!
    reserved: 0,
    lowStockThreshold: 3,
    warehouse: 'East Coast DC (WH-02)',
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=900&auto=format&fit=crop&q=80'
    ],
    features: [
      'Grade 5 DLC-coated titanium bezel and rear casing',
      'High-transmittance Power Sapphire solar charging crystal',
      'Dual-band GNSS multi-satellite navigation system',
      '10 ATM Water resistance rating (100 meters dive tested)'
    ],
    specs: {
      'Display': '1.4" Sunlight-visible transflective MIP (280x280)',
      'Battery Life': '28 days smartwatch / 89 hours GPS mode',
      'Sensors': 'Optical HR, Pulse Ox, Barometric Altimeter, 3-Axis Compass',
      'Band': 'QuickFit 22mm fluorocarbon tactical strap',
      'Weight': '62 g (Body only)'
    },
    isTrending: true,
    warranty: '2-Year Worldwide Warranty'
  }
];

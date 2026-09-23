import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  MapPin,
  Bell,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Plus,
  Edit3,
  Trash2,
  Phone,
  Mail,
  Building,
  Globe,
  Sliders,
  Smartphone,
  Radio,
  Clock,
  Heart,
  History,
  BellRing,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  RefreshCw,
  Send
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { SavedAddress, CommunicationPreferences, UserProfile } from '../types';

export const UserProfileModal: React.FC = () => {
  const {
    isUserProfileOpen,
    setIsUserProfileOpen,
    userProfile,
    updateUserProfile,
    addSavedAddress,
    updateSavedAddress,
    deleteSavedAddress,
    setDefaultShippingAddress,
    setDefaultBillingAddress,
    updateCommunicationPreferences,
    orders,
    wishlistProductIds,
    inventoryAlerts,
    setIsOrderHistoryOpen,
    setIsInventoryAlertModalOpen,
    setOnlyWishlist,
    addAlert
  } = useStore();

  const [activeTab, setActiveTab] = useState<'details' | 'addresses' | 'communications' | 'security'>('details');

  // Account details form state
  const [firstName, setFirstName] = useState(userProfile.firstName);
  const [lastName, setLastName] = useState(userProfile.lastName);
  const [displayName, setDisplayName] = useState(userProfile.displayName);
  const [email, setEmail] = useState(userProfile.email);
  const [phone, setPhone] = useState(userProfile.phone);
  const [company, setCompany] = useState(userProfile.company);
  const [role, setRole] = useState(userProfile.role);
  const [timezone, setTimezone] = useState(userProfile.timezone);
  const [currency, setCurrency] = useState(userProfile.currency);
  const [avatarColor, setAvatarColor] = useState(userProfile.avatarColor || 'emerald');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Sync state whenever userProfile changes
  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.firstName);
      setLastName(userProfile.lastName);
      setDisplayName(userProfile.displayName);
      setEmail(userProfile.email);
      setPhone(userProfile.phone);
      setCompany(userProfile.company);
      setRole(userProfile.role);
      setTimezone(userProfile.timezone);
      setCurrency(userProfile.currency);
      setAvatarColor(userProfile.avatarColor || 'emerald');
    }
  }, [userProfile, isUserProfileOpen]);

  // Address modal/form state
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<Omit<SavedAddress, 'id'>>({
    label: '',
    fullName: userProfile.displayName || `${userProfile.firstName} ${userProfile.lastName}`,
    company: userProfile.company || '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: userProfile.phone || '',
    isDefaultShipping: false,
    isDefaultBilling: false
  });
  const [addressFormError, setAddressFormError] = useState<string | null>(null);
  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null);

  // Communication preferences local state
  const [prefs, setPrefs] = useState<CommunicationPreferences>(userProfile.communicationPreferences);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  useEffect(() => {
    if (userProfile?.communicationPreferences) {
      setPrefs(userProfile.communicationPreferences);
    }
  }, [userProfile?.communicationPreferences, isUserProfileOpen]);

  // Handle Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUserProfileOpen) {
        if (isAddressModalOpen) {
          setIsAddressModalOpen(false);
        } else {
          setIsUserProfileOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUserProfileOpen, isAddressModalOpen, setIsUserProfileOpen]);

  if (!isUserProfileOpen) return null;

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDetails(true);

    setTimeout(() => {
      updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: displayName.trim() || `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
        role: role.trim(),
        timezone,
        currency,
        avatarColor
      });
      setIsSavingDetails(false);
    }, 300);
  };

  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: '',
      fullName: displayName || `${firstName} ${lastName}`,
      company: company || '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'United States',
      phone: phone || '',
      isDefaultShipping: userProfile.savedAddresses.length === 0,
      isDefaultBilling: userProfile.savedAddresses.length === 0
    });
    setAddressFormError(null);
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      label: addr.label,
      fullName: addr.fullName,
      company: addr.company || '',
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      phone: addr.phone,
      isDefaultShipping: addr.isDefaultShipping,
      isDefaultBilling: addr.isDefaultBilling
    });
    setAddressFormError(null);
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAddressFormError(null);

    if (!addressForm.label.trim()) {
      setAddressFormError('Please provide a label for this address (e.g. "Main Studio", "Home Office").');
      return;
    }
    if (!addressForm.fullName.trim()) {
      setAddressFormError('Recipient full name is required.');
      return;
    }
    if (!addressForm.addressLine1.trim()) {
      setAddressFormError('Street address line 1 is required.');
      return;
    }
    if (!addressForm.city.trim() || !addressForm.state.trim() || !addressForm.postalCode.trim()) {
      setAddressFormError('City, State/Province, and Postal Code are required.');
      return;
    }

    if (editingAddressId) {
      updateSavedAddress(editingAddressId, addressForm);
    } else {
      addSavedAddress(addressForm);
    }

    setIsAddressModalOpen(false);
    setEditingAddressId(null);
  };

  const handleCopyAddress = (addr: SavedAddress) => {
    const formatted = `${addr.fullName}${addr.company ? `\n${addr.company}` : ''}\n${addr.addressLine1}${addr.addressLine2 ? `\n${addr.addressLine2}` : ''}\n${addr.city}, ${addr.state} ${addr.postalCode}\n${addr.country}\nPhone: ${addr.phone}`;
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(formatted);
      }
    } catch {
      // fallback
    }
    setCopiedAddressId(addr.id);
    addAlert('info', 'Address Copied', `"${addr.label}" copied to clipboard.`);
    setTimeout(() => {
      setCopiedAddressId(null);
    }, 2000);
  };

  const handleSavePreferences = () => {
    setIsSavingPrefs(true);
    setTimeout(() => {
      updateCommunicationPreferences(prefs);
      setIsSavingPrefs(false);
    }, 300);
  };

  const handleOptOutMarketing = () => {
    const updated: CommunicationPreferences = {
      ...prefs,
      hardwareDigestNewsletter: false,
      developerApiUpdates: false,
      exclusiveDropsEmail: false,
      vipEarlyAccessSms: false
    };
    setPrefs(updated);
    updateCommunicationPreferences(updated);
    addAlert('info', 'Marketing Disabled', 'Promotional & newsletter broadcasts have been turned off. Transactional order updates remain active.');
  };

  const handleEnableAllNotifications = () => {
    const updated: CommunicationPreferences = {
      ...prefs,
      orderConfirmationsEmail: true,
      orderConfirmationsSms: true,
      shippingUpdatesEmail: true,
      shippingUpdatesSms: true,
      deliveryOutAlertsSms: true,
      inventoryAlertsEmail: true,
      priceDropAlertsEmail: true,
      backInStockSms: true,
      firmwareUpdatesEmail: true,
      hardwareDigestNewsletter: true,
      developerApiUpdates: true,
      exclusiveDropsEmail: true,
      vipEarlyAccessSms: true
    };
    setPrefs(updated);
    updateCommunicationPreferences(updated);
    addAlert('success', 'All Channels Enabled', 'All order, stock watch, and hardware digest notifications enabled.');
  };

  const getAvatarBgClass = (color: string) => {
    switch (color) {
      case 'sky':
        return 'from-sky-500/20 to-sky-950/40 text-sky-400 border-sky-500/40';
      case 'purple':
        return 'from-purple-500/20 to-purple-950/40 text-purple-400 border-purple-500/40';
      case 'amber':
        return 'from-amber-500/20 to-amber-950/40 text-amber-400 border-amber-500/40';
      case 'rose':
        return 'from-rose-500/20 to-rose-950/40 text-rose-400 border-rose-500/40';
      case 'cyan':
        return 'from-cyan-500/20 to-cyan-950/40 text-cyan-400 border-cyan-500/40';
      case 'emerald':
      default:
        return 'from-emerald-500/20 to-emerald-950/40 text-emerald-400 border-emerald-500/40';
    }
  };

  const userInitials = (firstName && lastName)
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : 'AV';

  return (
    <AnimatePresence>
      <div
        id="user-profile-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-neutral-950/80 backdrop-blur-md"
        onClick={() => setIsUserProfileOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Top Decorative Glow & Header Banner */}
          <div className="relative bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border-b border-neutral-800/80 px-6 py-5 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* User Bio Header */}
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br border flex items-center justify-center font-bold text-lg shadow-lg ${getAvatarBgClass(avatarColor)}`}
                >
                  {userInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      {displayName || `${firstName} ${lastName}`}
                    </h2>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {userProfile.membershipTier}
                    </span>
                    {userProfile.twoFactorEnabled && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-sky-400" />
                        2FA Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
                    <span className="font-mono text-neutral-300">{email}</span>
                    <span>•</span>
                    <span>{role || 'Hardware Creator'}</span>
                    {company && (
                      <>
                        <span>•</span>
                        <span className="text-neutral-400">{company}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                id="close-user-profile-modal"
                onClick={() => setIsUserProfileOpen(false)}
                className="self-start sm:self-center p-2 rounded-xl bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
                title="Close Profile (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 mt-5 overflow-x-auto no-scrollbar pt-1">
              <button
                id="tab-profile-details"
                onClick={() => setActiveTab('details')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'details'
                    ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                    : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Account Details</span>
              </button>

              <button
                id="tab-profile-addresses"
                onClick={() => setActiveTab('addresses')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'addresses'
                    ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                    : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Saved Addresses</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === 'addresses'
                      ? 'bg-neutral-950 text-emerald-400'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {userProfile.savedAddresses.length}
                </span>
              </button>

              <button
                id="tab-profile-communications"
                onClick={() => setActiveTab('communications')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'communications'
                    ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                    : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Communication Preferences</span>
              </button>

              <button
                id="tab-profile-security"
                onClick={() => setActiveTab('security')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'security'
                    ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                    : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Security & Activity</span>
              </button>
            </div>
          </div>

          {/* Modal Body / Tab Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-neutral-950">
            {/* ========================================================================= */}
            {/* TAB 1: ACCOUNT DETAILS                                                    */}
            {/* ========================================================================= */}
            {activeTab === 'details' && (
              <form onSubmit={handleSaveDetails} className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    Personal & Organization Profile
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Update your primary account identity, organization credentials, and regional workspace settings.
                  </p>
                </div>

                {/* Avatar Color Picker */}
                <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
                  <label className="block text-xs font-semibold text-neutral-300 mb-2">
                    Profile Badge Accent Color
                  </label>
                  <div className="flex items-center gap-3">
                    {[
                      { id: 'emerald', label: 'Emerald Studio', bg: 'bg-emerald-500' },
                      { id: 'sky', label: 'Sky Blue', bg: 'bg-sky-500' },
                      { id: 'purple', label: 'Acoustic Violet', bg: 'bg-purple-500' },
                      { id: 'amber', label: 'Amber Gold', bg: 'bg-amber-500' },
                      { id: 'rose', label: 'Rose Red', bg: 'bg-rose-500' },
                      { id: 'cyan', label: 'Cyan Core', bg: 'bg-cyan-500' }
                    ].map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setAvatarColor(c.id)}
                        className={`w-7 h-7 rounded-full ${c.bg} transition-all cursor-pointer flex items-center justify-center ${
                          avatarColor === c.id ? 'ring-3 ring-white scale-110 shadow-md' : 'opacity-70 hover:opacity-100'
                        }`}
                        title={c.label}
                      >
                        {avatarColor === c.id && <Check className="w-3.5 h-3.5 text-neutral-950 stroke-[3]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      First Name <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Alex"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Last Name <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Vance"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Display Name / Handle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Public Display Name / Signature
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Alex Vance"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Appears on your product reviews, consignment receipts, and studio orders.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Primary Contact Email <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="m99038765@gmail.com"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 transition-colors font-mono"
                      />
                      <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Contact Phone & Company */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Direct Mobile / Delivery SMS Phone
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (415) 890-2134"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 transition-colors font-mono"
                      />
                      <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Company / Studio Entity
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="AcousticLab Audio & Hardware"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                      />
                      <Building className="w-4 h-4 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Professional Role & Regional Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Engineering Role / Title
                    </label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Principal Acoustic Architect"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Workspace Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="America/Los_Angeles (PST/PDT)">Pacific Time (US & Canada)</option>
                      <option value="America/New_York (EST/EDT)">Eastern Time (US & Canada)</option>
                      <option value="America/Chicago (CST/CDT)">Central Time (US & Canada)</option>
                      <option value="Europe/London (GMT/BST)">London / Western Europe</option>
                      <option value="Europe/Berlin (CET/CEST)">Berlin / Central Europe</option>
                      <option value="Asia/Tokyo (JST)">Tokyo / Japan Standard Time</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      Billing Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as any)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="USD">USD ($) — United States Dollar</option>
                      <option value="EUR">EUR (€) — Eurozone</option>
                      <option value="GBP">GBP (£) — British Pound</option>
                      <option value="CAD">CAD ($) — Canadian Dollar</option>
                    </select>
                  </div>
                </div>

                {/* Form Footer Save Button */}
                <div className="flex items-center justify-between pt-4 border-t border-neutral-800/80">
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Member ID: <span className="font-mono text-neutral-300">{userProfile.id}</span></span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingDetails}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isSavingDetails ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Save Account Details</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: SAVED ADDRESSES                                                    */}
            {/* ========================================================================= */}
            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      Saved Shipping & Billing Destinations
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Manage delivery docks, studio facilities, and billing addresses for one-click checkout.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAddAddress}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Add New Address</span>
                  </button>
                </div>

                {/* Addresses Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userProfile.savedAddresses.length === 0 ? (
                    <div className="md:col-span-2 text-center py-12 px-4 rounded-2xl bg-neutral-900/40 border border-dashed border-neutral-800">
                      <MapPin className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                      <h4 className="text-sm font-semibold text-neutral-300">
                        No Saved Addresses
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                        Add your primary recording studio, home lab, or warehouse loading dock for rapid autonomous fulfillment.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAddAddress}
                        className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-neutral-950 hover:bg-emerald-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Add First Address</span>
                      </button>
                    </div>
                  ) : (
                    userProfile.savedAddresses.map((addr) => {
                      const isCopied = copiedAddressId === addr.id;

                      return (
                        <div
                          key={addr.id}
                          className={`relative p-5 rounded-2xl bg-neutral-900/80 border transition-all flex flex-col justify-between ${
                            addr.isDefaultShipping
                              ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                              : 'border-neutral-800 hover:border-neutral-700'
                          }`}
                        >
                          <div>
                            {/* Card Header: Label & Status Badges */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                                  <span>{addr.label}</span>
                                </h4>
                                {addr.company && (
                                  <span className="text-[11px] font-medium text-neutral-400 block mt-0.5">
                                    {addr.company}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {addr.isDefaultShipping && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    Default Shipping
                                  </span>
                                )}
                                {addr.isDefaultBilling && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    Default Billing
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Address Details */}
                            <div className="space-y-1 text-xs text-neutral-300 font-sans border-t border-neutral-800/80 pt-3">
                              <p className="font-semibold text-white">{addr.fullName}</p>
                              <p>{addr.addressLine1}</p>
                              {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                              <p>
                                {addr.city}, {addr.state} {addr.postalCode}
                              </p>
                              <p className="text-neutral-400">{addr.country}</p>
                              <p className="text-neutral-400 font-mono text-[11px] pt-1 flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-neutral-500" />
                                {addr.phone}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="mt-5 pt-3 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2">
                            {/* Set Default Buttons */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {!addr.isDefaultShipping && (
                                <button
                                  type="button"
                                  onClick={() => setDefaultShippingAddress(addr.id)}
                                  className="text-[11px] font-medium px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                                  title="Make this the default shipping address"
                                >
                                  Make Shipping
                                </button>
                              )}
                              {!addr.isDefaultBilling && (
                                <button
                                  type="button"
                                  onClick={() => setDefaultBillingAddress(addr.id)}
                                  className="text-[11px] font-medium px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                                  title="Make this the default billing address"
                                >
                                  Make Billing
                                </button>
                              )}
                            </div>

                            {/* Edit / Copy / Delete Buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopyAddress(addr)}
                                className="p-1.5 rounded-lg bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                                title="Copy address to clipboard"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditAddress(addr)}
                                className="p-1.5 rounded-lg bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                                title="Edit this address"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSavedAddress(addr.id)}
                                className="p-1.5 rounded-lg bg-neutral-800/60 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Delete address"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: COMMUNICATION PREFERENCES                                          */}
            {/* ========================================================================= */}
            {activeTab === 'communications' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-400" />
                      Communication & Notification Hub
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Tailor SMS dispatch pings, real-time price alerts, and hardware engineering bulletins.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOptOutMarketing}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                      title="Keep order alerts only"
                    >
                      Opt-Out Marketing
                    </button>
                    <button
                      type="button"
                      onClick={handleEnableAllNotifications}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                    >
                      Enable All
                    </button>
                  </div>
                </div>

                {/* Section A: Order & Logistics Communications */}
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <h4 className="font-semibold text-white text-xs uppercase tracking-wider">
                      Orders & Warehouse Consignment Alerts
                    </h4>
                  </div>

                  <div className="space-y-3.5">
                    {/* Item 1 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-emerald-300 transition-colors">
                          Order Receipts & Tax Invoices (Email)
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Receive itemized PDF receipts and authorization certificates immediately upon checkout.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.orderConfirmationsEmail}
                        onChange={(e) => setPrefs({ ...prefs, orderConfirmationsEmail: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-emerald-500 cursor-pointer"
                      />
                    </label>

                    {/* Item 2 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-emerald-300 transition-colors">
                          Instant Order Confirmation (SMS)
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Short message text with direct tracking link sent to your registered phone.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.orderConfirmationsSms}
                        onChange={(e) => setPrefs({ ...prefs, orderConfirmationsSms: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-emerald-500 cursor-pointer"
                      />
                    </label>

                    {/* Item 3 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-emerald-300 transition-colors">
                          Shipment Transit & Hub Milestone Alerts (Email)
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Automated barcode scans when consignment leaves the warehouse or arrives at regional sorting hubs.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.shippingUpdatesEmail}
                        onChange={(e) => setPrefs({ ...prefs, shippingUpdatesEmail: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-emerald-500 cursor-pointer"
                      />
                    </label>

                    {/* Item 4 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-emerald-300 transition-colors">
                          Out-For-Delivery Final Mile SMS
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Priority courier ping when courier van is within 15 minutes of your studio address.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.deliveryOutAlertsSms}
                        onChange={(e) => setPrefs({ ...prefs, deliveryOutAlertsSms: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-emerald-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Section B: Inventory & Price Watches */}
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                    <BellRing className="w-4 h-4 text-amber-400" />
                    <h4 className="font-semibold text-white text-xs uppercase tracking-wider">
                      Inventory & Dynamic Pricing Watches
                    </h4>
                  </div>

                  <div className="space-y-3.5">
                    {/* Item 1 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-amber-300 transition-colors">
                          Target Price Drop Triggers (Email)
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Immediate email when hardware in your watch list reaches or drops below your target price.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.priceDropAlertsEmail}
                        onChange={(e) => setPrefs({ ...prefs, priceDropAlertsEmail: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-amber-500 cursor-pointer"
                      />
                    </label>

                    {/* Item 2 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-amber-300 transition-colors">
                          Wishlist Low-Stock Warnings (Email)
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Proactive heads-up when any wishlisted product inventory falls below 5 remaining units.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.inventoryAlertsEmail}
                        onChange={(e) => setPrefs({ ...prefs, inventoryAlertsEmail: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-amber-500 cursor-pointer"
                      />
                    </label>

                    {/* Item 3 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-amber-300 transition-colors">
                          Instant Restock Text Alert (SMS)
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Instant priority SMS when sold-out studio gear or cinema optics get restocked at the warehouse.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.backInStockSms}
                        onChange={(e) => setPrefs({ ...prefs, backInStockSms: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-amber-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Section C: Product Firmware & Engineering Digests */}
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                    <Radio className="w-4 h-4 text-purple-400" />
                    <h4 className="font-semibold text-white text-xs uppercase tracking-wider">
                      Hardware Firmware, Releases & Developer API
                    </h4>
                  </div>

                  <div className="space-y-3.5">
                    {/* Item 1 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-purple-300 transition-colors">
                          Hardware Firmware Updates & Critical Patches (Email)
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Driver updates, audio DSP calibration curves, and compatibility advisories for purchased devices.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.firmwareUpdatesEmail}
                        onChange={(e) => setPrefs({ ...prefs, firmwareUpdatesEmail: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-purple-500 cursor-pointer"
                      />
                    </label>

                    {/* Item 2 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-purple-300 transition-colors">
                          Omnistore Pro Engineering Monthly Digest
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Curated monthly teardowns, acoustic room modeling research, and high-speed NVMe storage benchmarks.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.hardwareDigestNewsletter}
                        onChange={(e) => setPrefs({ ...prefs, hardwareDigestNewsletter: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-purple-500 cursor-pointer"
                      />
                    </label>

                    {/* Item 3 */}
                    <label className="flex items-start justify-between gap-4 cursor-pointer group">
                      <div>
                        <span className="font-semibold text-white text-xs block group-hover:text-purple-300 transition-colors">
                          Developer API & Automated Supply Webhooks
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Receive notifications when new REST/GraphQL endpoints or warehouse telemetry feeds are published.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.developerApiUpdates}
                        onChange={(e) => setPrefs({ ...prefs, developerApiUpdates: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-purple-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Section D: VIP Drops & Digest Cadence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                    <h4 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      VIP Drops & Limited Editions
                    </h4>
                    <label className="flex items-start justify-between gap-3 cursor-pointer group pt-1">
                      <div>
                        <span className="font-semibold text-white text-xs block">
                          VIP Early Access Drops (Email)
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          Exclusive 24h preorder window for limited artisan hardware.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.exclusiveDropsEmail}
                        onChange={(e) => setPrefs({ ...prefs, exclusiveDropsEmail: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded-sm accent-emerald-500 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                    <h4 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      Summary Cadence
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Choose how non-urgent system alerts and digests are delivered:
                    </p>
                    <select
                      value={prefs.frequency}
                      onChange={(e) => setPrefs({ ...prefs, frequency: e.target.value as any })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="realtime">Real-Time (Instant Delivery per Event)</option>
                      <option value="daily_digest">Daily Studio Digest (Compiled at 08:00 AM)</option>
                      <option value="weekly_summary">Weekly Executive Summary (Mondays)</option>
                    </select>
                  </div>
                </div>

                {/* Save Preferences Button */}
                <div className="flex items-center justify-end pt-4 border-t border-neutral-800/80">
                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    disabled={isSavingPrefs}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isSavingPrefs ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                        <span>Updating Preferences...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Save Preferences</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: SECURITY & ACCOUNT ACTIVITY                                        */}
            {/* ========================================================================= */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Security, Verification & Account Activity
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Hardware key status, two-factor authentication, and connected storefront services.
                  </p>
                </div>

                {/* Quick Account Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
                    <span className="text-[11px] text-neutral-400 block font-medium">Total Orders</span>
                    <span className="text-2xl font-bold font-mono text-white mt-1 block">
                      {orders.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserProfileOpen(false);
                        setIsOrderHistoryOpen(true);
                      }}
                      className="text-[10px] text-sky-400 hover:underline mt-2 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View History</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
                    <span className="text-[11px] text-neutral-400 block font-medium">Saved Wishlist</span>
                    <span className="text-2xl font-bold font-mono text-rose-400 mt-1 block">
                      {wishlistProductIds.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserProfileOpen(false);
                        setOnlyWishlist(true);
                      }}
                      className="text-[10px] text-rose-400 hover:underline mt-2 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Show Saved</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
                    <span className="text-[11px] text-neutral-400 block font-medium">Price Watches</span>
                    <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
                      {inventoryAlerts.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserProfileOpen(false);
                        setIsInventoryAlertModalOpen(true);
                      }}
                      className="text-[10px] text-amber-400 hover:underline mt-2 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Manage Alerts</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
                    <span className="text-[11px] text-neutral-400 block font-medium">Saved Addresses</span>
                    <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                      {userProfile.savedAddresses.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('addresses')}
                      className="text-[10px] text-emerald-400 hover:underline mt-2 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Manage</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 2FA & Session Details */}
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm">
                          Two-Factor Authentication (2FA)
                        </h4>
                        <p className="text-xs text-neutral-400">
                          Hardware key and TOTP authenticator protection for order authorizations
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        updateUserProfile({ twoFactorEnabled: !userProfile.twoFactorEnabled });
                        addAlert(
                          'info',
                          userProfile.twoFactorEnabled ? '2FA Disabled' : '2FA Enabled',
                          userProfile.twoFactorEnabled
                            ? 'Two-factor protection disabled on your account.'
                            : 'Two-factor hardware authentication successfully enabled.'
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        userProfile.twoFactorEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700'
                      }`}
                    >
                      {userProfile.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80">
                      <span className="text-neutral-500 block text-[11px]">Primary Session</span>
                      <p className="font-semibold text-white mt-0.5">Desktop Browser • San Francisco, CA</p>
                      <p className="text-neutral-400 text-[11px] mt-0.5">Current IP: 198.51.100.44 (Encrypted TLS 1.3)</p>
                    </div>

                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80">
                      <span className="text-neutral-500 block text-[11px]">Account Created</span>
                      <p className="font-semibold text-white mt-0.5">{userProfile.memberSince}</p>
                      <p className="text-emerald-400 text-[11px] mt-0.5 font-medium">Enterprise VIP Tier Activated</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* NESTED MODAL: ADD / EDIT ADDRESS                                          */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {isAddressModalOpen && (
            <div
              className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md"
              onClick={() => setIsAddressModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-white text-base">
                      {editingAddressId ? 'Edit Saved Address' : 'Add New Saved Address'}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(false)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {addressFormError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{addressFormError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveAddress} className="space-y-3.5 text-xs">
                  {/* Label & Full Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">
                        Address Label <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={addressForm.label}
                        onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                        placeholder="e.g. SF Audio Lab (HQ)"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">
                        Recipient Full Name <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={addressForm.fullName}
                        onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                        placeholder="Alex Vance"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Company & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">
                        Company / Organization (Optional)
                      </label>
                      <input
                        type="text"
                        value={addressForm.company || ''}
                        onChange={(e) => setAddressForm({ ...addressForm, company: e.target.value })}
                        placeholder="AcousticLab Technologies"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">
                        Phone Number <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                        placeholder="+1 (415) 890-2134"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Street Address 1 */}
                  <div>
                    <label className="block text-neutral-300 font-medium mb-1">
                      Street Address <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addressForm.addressLine1}
                      onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                      placeholder="450 Mission Street"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  {/* Address 2 */}
                  <div>
                    <label className="block text-neutral-300 font-medium mb-1">
                      Apt, Suite, Floor, Dock (Optional)
                    </label>
                    <input
                      type="text"
                      value={addressForm.addressLine2 || ''}
                      onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                      placeholder="Suite 1200 / Loading Bay 3"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  {/* City, State, Postal */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">
                        City <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={addressForm.city}
                        onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                        placeholder="San Francisco"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">
                        State / Prov <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={addressForm.state}
                        onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                        placeholder="CA"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-medium mb-1">
                        ZIP / Postal <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={addressForm.postalCode}
                        onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                        placeholder="94105"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-neutral-300 font-medium mb-1">
                      Country
                    </label>
                    <select
                      value={addressForm.country}
                      onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="Japan">Japan</option>
                      <option value="Australia">Australia</option>
                    </select>
                  </div>

                  {/* Default Checkboxes */}
                  <div className="pt-2 space-y-2">
                    <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addressForm.isDefaultShipping}
                        onChange={(e) => setAddressForm({ ...addressForm, isDefaultShipping: e.target.checked })}
                        className="rounded-sm accent-emerald-500 cursor-pointer"
                      />
                      <span>Set as default shipping address</span>
                    </label>

                    <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addressForm.isDefaultBilling}
                        onChange={(e) => setAddressForm({ ...addressForm, isDefaultBilling: e.target.checked })}
                        className="rounded-sm accent-sky-500 cursor-pointer"
                      />
                      <span>Set as default billing address</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setIsAddressModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      {editingAddressId ? 'Update Address' : 'Save Address'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};

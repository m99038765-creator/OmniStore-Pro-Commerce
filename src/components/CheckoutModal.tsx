import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShieldCheck,
  Lock,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Printer,
  ChevronRight,
  Copy,
  ExternalLink,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ShippingDetails, PaymentFormState, Order } from '../types';

export const CheckoutModal: React.FC = () => {
  const { isCheckoutOpen, setIsCheckoutOpen, cart, processCheckout, activeOrder, setActiveOrder, setIsTrackingOpen } = useStore();

  const [step, setStep] = useState<'shipping' | 'payment' | 'threed_secure' | 'success'>('shipping');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Shipping State
  const [shipping, setShipping] = useState<ShippingDetails>({
    fullName: 'Alex Vance',
    email: 'alex.vance@workstation-pro.io',
    phone: '+1 (415) 890-2134',
    addressLine1: '450 Mission Street, Suite 1200',
    addressLine2: '',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    country: 'United States',
    shippingSpeed: 'standard',
  });

  // Payment Form State
  const [payment, setPayment] = useState<PaymentFormState>({
    method: 'card',
    cardNumber: '4242 4242 4242 4242',
    cardHolder: 'ALEX VANCE',
    expiryMonth: '12',
    expiryYear: '28',
    cvv: '882',
    saveCard: true,
    billingSameAsShipping: true,
  });

  const [discountCode, setDiscountCode] = useState('');
  const [threeDSecureCode, setThreeDSecureCode] = useState('774912');
  const [is3DSProcessing, setIs3DSProcessing] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

  if (!isCheckoutOpen) return null;

  const subtotal = cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);
  let discount = 0;
  if (discountCode.toUpperCase() === 'PRO15') discount = subtotal * 0.15;
  else if (discountCode.toUpperCase() === 'VIP50') discount = 50;

  const shippingCost = shipping.shippingSpeed === 'overnight' ? 45 : shipping.shippingSpeed === 'express' ? 25 : (subtotal >= 500 ? 0 : 15);
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = taxableAmount * 0.0825;
  const totalAmount = taxableAmount + shippingCost + tax;

  // Luhn Check & Card Brand Detection
  const cleanCardNumber = payment.cardNumber.replace(/\s+/g, '');
  let cardBrand: 'visa' | 'mastercard' | 'amex' | 'generic' = 'generic';
  if (cleanCardNumber.startsWith('4')) cardBrand = 'visa';
  else if (/^5[1-5]/.test(cleanCardNumber)) cardBrand = 'mastercard';
  else if (/^3[47]/.test(cleanCardNumber)) cardBrand = 'amex';

  const handleCardNumberChange = (val: string) => {
    // Format in blocks of 4
    const digitsOnly = val.replace(/\D/g, '').slice(0, 16);
    const formatted = digitsOnly.match(/.{1,4}/g)?.join(' ') || digitsOnly;
    setPayment(prev => ({ ...prev, cardNumber: formatted }));
  };

  const handleFillTestCard = (type: 'visa' | 'mastercard' | 'amex') => {
    if (type === 'visa') {
      setPayment(prev => ({
        ...prev,
        method: 'card',
        cardNumber: '4242 4242 4242 4242',
        cardHolder: 'ALEX VANCE',
        expiryMonth: '08',
        expiryYear: '28',
        cvv: '912'
      }));
    } else if (type === 'mastercard') {
      setPayment(prev => ({
        ...prev,
        method: 'card',
        cardNumber: '5555 4444 3333 2222',
        cardHolder: 'JORDAN REED',
        expiryMonth: '11',
        expiryYear: '29',
        cvv: '456'
      }));
    } else {
      setPayment(prev => ({
        ...prev,
        method: 'card',
        cardNumber: '3782 8224 6310 005',
        cardHolder: 'VANGUARD ENTERPRISE',
        expiryMonth: '05',
        expiryYear: '30',
        cvv: '8492'
      }));
    }
  };

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipping.fullName || !shipping.email || !shipping.addressLine1 || !shipping.city || !shipping.postalCode) {
      setErrorMessage('Please fill in all mandatory shipping fields.');
      return;
    }
    setErrorMessage(null);
    setStep('payment');
  };

  const handlePaymentInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // If card payment and total > $1000, trigger simulated 3D-Secure authorization modal
    if (payment.method === 'card' && totalAmount > 1000) {
      setStep('threed_secure');
      return;
    }

    executeCheckout();
  };

  const executeCheckout = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await processCheckout({
      shippingDetails: shipping,
      paymentDetails: payment,
      discountCode: discountCode || undefined,
    });

    setIsSubmitting(false);

    if (result.success && result.order) {
      setStep('success');
    } else {
      setErrorMessage(result.error || 'Payment gateway declined authorization.');
      // return to payment step if failed from 3DS
      if (step === 'threed_secure') setStep('payment');
    }
  };

  const handle3DSecureVerify = () => {
    setIs3DSProcessing(true);
    setTimeout(async () => {
      setIs3DSProcessing(false);
      await executeCheckout();
    }, 1200);
  };

  const copyTrackingNumber = (trk: string) => {
    navigator.clipboard.writeText(trk);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  return (
    <AnimatePresence>
      <div
        id="checkout-modal-backdrop"
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      >
        <motion.div
          id="checkout-modal-content"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative bg-neutral-950 border border-neutral-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-auto"
        >
          {/* Header Bar */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Lock className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>OmniPay Secure Gateway</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                    TLS 1.3 / AES-256
                  </span>
                </h3>
                <span className="text-[11px] text-neutral-400">
                  Real-time inventory reservation verified
                </span>
              </div>
            </div>

            <button
              id="close-checkout-modal-button"
              onClick={() => setIsCheckoutOpen(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Header (if not on success) */}
          {step !== 'success' && (
            <div className="flex items-center border-b border-neutral-800 text-xs px-6 py-3 bg-neutral-950 gap-4 select-none">
              <div
                className={`flex items-center gap-2 cursor-pointer ${
                  step === 'shipping' ? 'text-emerald-400 font-semibold' : 'text-neutral-400'
                }`}
                onClick={() => setStep('shipping')}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                  step === 'shipping' ? 'bg-emerald-500 text-neutral-950 font-bold' : 'bg-neutral-800 text-neutral-300'
                }`}>
                  1
                </span>
                <span>Shipping & Delivery</span>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />

              <div
                className={`flex items-center gap-2 cursor-pointer ${
                  step === 'payment' || step === 'threed_secure' ? 'text-emerald-400 font-semibold' : 'text-neutral-500'
                }`}
                onClick={() => setStep('payment')}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                  step === 'payment' || step === 'threed_secure' ? 'bg-emerald-500 text-neutral-950 font-bold' : 'bg-neutral-800 text-neutral-500'
                }`}>
                  2
                </span>
                <span>Payment Authorization</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="m-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Authorization Notice:</span>
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Main Body */}
          <div className="p-5 sm:p-7 max-h-[75vh] overflow-y-auto">
            {/* STEP 1: SHIPPING */}
            {step === 'shipping' && (
              <form onSubmit={handleShippingSubmit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Recipient Logistics & Delivery Point
                  </h4>
                  <span className="text-[11px] text-neutral-500">All fields required for carrier manifest</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      required
                      value={shipping.fullName}
                      onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Email (Digital Tracking & Receipt)</label>
                    <input
                      type="email"
                      required
                      value={shipping.email}
                      onChange={(e) => setShipping({ ...shipping, email: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-neutral-400 mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      value={shipping.addressLine1}
                      onChange={(e) => setShipping({ ...shipping, addressLine1: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Apt / Suite / Unit</label>
                    <input
                      type="text"
                      value={shipping.addressLine2 || ''}
                      onChange={(e) => setShipping({ ...shipping, addressLine2: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={shipping.city}
                      onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">State / Province</label>
                    <input
                      type="text"
                      required
                      value={shipping.state}
                      onChange={(e) => setShipping({ ...shipping, state: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Postal / ZIP Code</label>
                    <input
                      type="text"
                      required
                      value={shipping.postalCode}
                      onChange={(e) => setShipping({ ...shipping, postalCode: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Carrier Speed Tier */}
                <div className="pt-2">
                  <label className="block text-xs text-neutral-300 font-semibold mb-2">
                    Fulfillment Speed & Carrier Level
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        id: 'standard',
                        title: 'Tracked Ground',
                        time: '3–4 Business Days',
                        price: subtotal >= 500 ? 'FREE' : '$15.00'
                      },
                      {
                        id: 'express',
                        title: 'Priority Air Express',
                        time: '2 Business Days',
                        price: '$25.00'
                      },
                      {
                        id: 'overnight',
                        title: 'Dedicated Overnight',
                        time: 'Next Morning Priority',
                        price: '$45.00'
                      },
                    ].map((tier) => (
                      <div
                        key={tier.id}
                        onClick={() => setShipping({ ...shipping, shippingSpeed: tier.id as any })}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          shipping.shippingSpeed === tier.id
                            ? 'bg-emerald-950/40 border-emerald-500/80 text-white shadow-sm'
                            : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className={shipping.shippingSpeed === tier.id ? 'text-emerald-400' : 'text-neutral-200'}>
                            {tier.title}
                          </span>
                          <span className="font-mono">{tier.price}</span>
                        </div>
                        <span className="text-[11px] text-neutral-500 block mt-1">
                          {tier.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Continue button */}
                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    id="continue-to-payment-button"
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    <span>Proceed to Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: PAYMENT GATEWAY */}
            {step === 'payment' && (
              <form onSubmit={handlePaymentInitiate} className="space-y-5">
                
                {/* Payment Method Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                      Payment Authorization Method
                    </label>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Zero-Knowledge Card Tokenization
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPayment({ ...payment, method: 'card' })}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                        payment.method === 'card'
                          ? 'bg-neutral-900 border-emerald-500 text-white shadow-sm'
                          : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-emerald-400" />
                      <span className="text-xs font-medium">Credit / Debit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPayment({ ...payment, method: 'apple_pay' })}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                        payment.method === 'apple_pay'
                          ? 'bg-neutral-900 border-emerald-500 text-white shadow-sm'
                          : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <Smartphone className="w-5 h-5 text-white" />
                      <span className="text-xs font-medium">Apple / Google Pay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPayment({ ...payment, method: 'instant_vault' })}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                        payment.method === 'instant_vault'
                          ? 'bg-neutral-900 border-emerald-500 text-white shadow-sm'
                          : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <span className="text-xs font-medium">Instant Vault Pass</span>
                    </button>
                  </div>
                </div>

                {/* Quick Test Cards Palette (Convenient Testing for User) */}
                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-neutral-400 font-mono text-[11px]">Instant Sandbox Test Credentials:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleFillTestCard('visa')}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-[11px] border border-neutral-700 transition-colors"
                    >
                      Visa (4242)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFillTestCard('mastercard')}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-[11px] border border-neutral-700 transition-colors"
                    >
                      Mastercard (5555)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFillTestCard('amex')}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-[11px] border border-neutral-700 transition-colors"
                    >
                      Amex (3782)
                    </button>
                  </div>
                </div>

                {/* Card Fields Form */}
                {payment.method === 'card' && (
                  <div className="space-y-3.5 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-neutral-400">Card Number</label>
                        <span className="text-[11px] font-mono text-emerald-400 uppercase">
                          {cardBrand}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={payment.cardNumber}
                          onChange={(e) => handleCardNumberChange(e.target.value)}
                          placeholder="0000 0000 0000 0000"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono tracking-wider focus:outline-none focus:border-emerald-500"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <CreditCard className="w-4 h-4 text-neutral-500" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Cardholder Legal Name</label>
                      <input
                        type="text"
                        required
                        value={payment.cardHolder}
                        onChange={(e) => setPayment({ ...payment, cardHolder: e.target.value.toUpperCase() })}
                        placeholder="ALEX VANCE"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white uppercase focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Exp Month</label>
                        <input
                          type="text"
                          required
                          maxLength={2}
                          value={payment.expiryMonth}
                          onChange={(e) => setPayment({ ...payment, expiryMonth: e.target.value })}
                          placeholder="MM"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Exp Year</label>
                        <input
                          type="text"
                          required
                          maxLength={2}
                          value={payment.expiryYear}
                          onChange={(e) => setPayment({ ...payment, expiryYear: e.target.value })}
                          placeholder="YY"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">CVV Code</label>
                        <input
                          type="password"
                          required
                          maxLength={4}
                          value={payment.cvv}
                          onChange={(e) => setPayment({ ...payment, cvv: e.target.value })}
                          placeholder="CVV"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 1-Click Digital Wallet Notice */}
                {payment.method === 'apple_pay' && (
                  <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 text-center space-y-2">
                    <Smartphone className="w-8 h-8 text-white mx-auto" />
                    <p className="font-semibold text-white">Biometric Device Authorization Ready</p>
                    <p className="text-neutral-400 text-[11px]">
                      Your authenticated pass on this device will tokenize the payment instantly with zero card exposure.
                    </p>
                  </div>
                )}

                {/* Instant Vault Pass Notice */}
                {payment.method === 'instant_vault' && (
                  <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 text-center space-y-2">
                    <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="font-semibold text-white">Encrypted Direct Vault Settlement</p>
                    <p className="text-neutral-400 text-[11px]">
                      Instant pre-cleared checkout with automated inventory priority routing.
                    </p>
                  </div>
                )}

                {/* Financial Summary Box */}
                <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>Subtotal ({cart.reduce((a, b) => a + b.quantity, 0)} items)</span>
                    <span className="font-mono text-neutral-200">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Insured Shipping ({shipping.shippingSpeed})</span>
                    <span className="font-mono text-neutral-200">
                      {shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Estimated Sales Tax (8.25%)</span>
                    <span className="font-mono text-neutral-200">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-neutral-800">
                    <span>Authorized Charge Total</span>
                    <span className="font-mono text-emerald-400">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('shipping')}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    ← Back to Shipping
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    id="submit-payment-button"
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                        <span>Locking Inventory & Authorizing...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Authorize & Pay ${totalAmount.toFixed(2)}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: 3D SECURE 2.0 AUTHENTICATION CHALLENGE */}
            {step === 'threed_secure' && (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Bank 3D-Secure 2.0 Verification</h4>
                  <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                    To protect against fraud on high-value pro hardware, your issuing bank requires step-up authentication.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 max-w-sm mx-auto space-y-3">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Merchant:</span>
                    <span className="text-white font-medium">OmniStore Pro Master Hub</span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Amount:</span>
                    <span className="text-emerald-400 font-mono font-bold">${totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Card:</span>
                    <span className="font-mono text-white">•••• {cleanCardNumber.slice(-4)}</span>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[11px] text-neutral-400 mb-1 text-left">
                      Enter 6-Digit One-Time Passcode (OTP)
                    </label>
                    <input
                      type="text"
                      value={threeDSecureCode}
                      onChange={(e) => setThreeDSecureCode(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-neutral-500 block mt-1">
                      (Test simulation code pre-filled)
                    </span>
                  </div>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('payment')}
                    className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handle3DSecureVerify}
                    disabled={is3DSProcessing}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {is3DSProcessing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                        <span>Verifying with Issuer...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Complete Order</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: SUCCESS & FULFILLMENT RECEIPT */}
            {step === 'success' && activeOrder && (
              <div className="space-y-6">
                {/* Header confirmation */}
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Payment Secured & Order Dispatched!</h3>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto">
                    Stock has been atomically deducted on the live server and synchronized across all distribution centers.
                  </p>
                </div>

                {/* Key identifiers banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-mono block">Order Reference</span>
                    <span className="font-mono font-bold text-white text-sm">{activeOrder.orderNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-mono block">Tracking Barcode</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-sky-400">{activeOrder.trackingNumber}</span>
                      <button
                        onClick={() => copyTrackingNumber(activeOrder.trackingNumber)}
                        className="text-neutral-500 hover:text-white p-0.5"
                        title="Copy tracking"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {copiedTracking && <span className="text-[10px] text-emerald-400">Copied!</span>}
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-mono block">Delivery Target</span>
                    <span className="font-semibold text-white">{activeOrder.estimatedDeliveryDate}</span>
                  </div>
                </div>

                {/* Live Order Timeline */}
                <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Autonomous Fulfillment Protocol
                  </h4>
                  <div className="space-y-3">
                    {activeOrder.timeline.map((event, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xs">
                        <div className="mt-0.5">
                          {event.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : event.current ? (
                            <span className="flex h-4 w-4 items-center justify-center">
                              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                          ) : (
                            <Clock className="w-4 h-4 text-neutral-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className={`font-medium ${event.completed || event.current ? 'text-white' : 'text-neutral-500'}`}>
                              {event.status}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">{event.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Purchased Items List */}
                <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                    Package Contents
                  </h4>
                  <div className="space-y-2">
                    {activeOrder.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-neutral-800/60 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <img src={item.image} alt="" className="w-8 h-8 rounded object-cover bg-neutral-950" />
                          <div>
                            <span className="font-medium text-white block">{item.name}</span>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              SKU: {item.sku} • Qty: {item.quantity}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-white">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Formal Invoice</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsCheckoutOpen(false);
                        setIsTrackingOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors"
                    >
                      Track Package
                    </button>
                    <button
                      onClick={() => {
                        setIsCheckoutOpen(false);
                        setStep('shipping');
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition-all shadow-md"
                    >
                      Back to Store
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

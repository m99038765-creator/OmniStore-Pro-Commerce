import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Star,
  ShoppingBag,
  ShieldCheck,
  MapPin,
  Truck,
  ArrowRight,
  Check,
  AlertTriangle,
  Scale,
  Heart,
  QrCode,
  BellRing,
  Sparkles,
  TrendingDown,
  Zap,
  Trash2,
  Tag,
  Barcode,
  ClipboardList,
  ThumbsUp,
  CheckCircle2,
  MessageSquare,
  PenSquare,
  User,
  Filter,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { Product, ProductReview } from '../types';
import { useStore } from '../context/StoreContext';
import { SkuAuditLogModal } from './SkuAuditLogModal';

export const ProductDetailModal: React.FC = () => {
  const {
    quickViewProduct,
    setQuickViewProduct,
    setQrCodeProduct,
    addToCart,
    setIsCartOpen,
    setIsCheckoutOpen,
    comparedProductIds,
    toggleCompareProduct,
    setIsCompareModalOpen,
    toggleWishlist,
    wishlistProductIds,
    inventoryAlerts,
    setInventoryAlert,
    removeInventoryAlert,
    simulatePriceDrop,
    setActiveInventoryAlertProduct,
    setSkuSearchQuery,
    addReview,
    voteReviewHelpful
  } = useStore();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [isAlertFormOpen, setIsAlertFormOpen] = useState(false);
  const [customTargetPrice, setCustomTargetPrice] = useState<string>('');
  const [alertEmail, setAlertEmail] = useState<string>('');
  const [isSimulatingDrop, setIsSimulatingDrop] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Customer Reviews & Feedback state
  const [isWritingReview, setIsWritingReview] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewerLocation, setReviewerLocation] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewFilterStar, setReviewFilterStar] = useState<number | 'all'>('all');
  const [reviewSort, setReviewSort] = useState<'newest' | 'highest' | 'lowest' | 'helpful'>('newest');
  const [votedReviewIds, setVotedReviewIds] = useState<string[]>([]);
  const [reviewFormError, setReviewFormError] = useState<string | null>(null);

  const existingAlert = quickViewProduct
    ? inventoryAlerts.find(a => a.productId === quickViewProduct.id)
    : undefined;

  useEffect(() => {
    if (!quickViewProduct) return;

    if (existingAlert) {
      setCustomTargetPrice(existingAlert.targetPrice.toFixed(2));
      setAlertEmail(existingAlert.notificationEmail || '');
    } else {
      setCustomTargetPrice((quickViewProduct.price * 0.9).toFixed(2));
    }
    setSelectedImageIndex(0);
    setQuantity(1);
  }, [existingAlert, quickViewProduct?.id, quickViewProduct?.price]);

  if (!quickViewProduct) return null;

  const product = quickViewProduct;
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;
  const isCompared = comparedProductIds.includes(product.id);
  const isWishlisted = product.isWishlisted ?? product.wishlist ?? wishlistProductIds.includes(product.id);

  const handleSaveAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customTargetPrice);
    if (isNaN(val) || val <= 0) return;
    setInventoryAlert(product, val, alertEmail);
    setIsAlertFormOpen(false);
  };

  const handleQuickDropTest = async () => {
    setIsSimulatingDrop(true);
    await simulatePriceDrop(product.id, 15);
    setIsSimulatingDrop(false);
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    const res = addToCart(product, quantity);
    if (res.success) {
      setAddedAnimation(true);
      setTimeout(() => setAddedAnimation(false), 1400);
    }
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    addToCart(product, quantity);
    setQuickViewProduct(null);
    setIsCheckoutOpen(true);
  };

  const productReviews: ProductReview[] = product.reviews || [];

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewFormError(null);

    if (!authorName.trim()) {
      setReviewFormError('Please enter your name or handle.');
      return;
    }
    if (!reviewComment.trim() || reviewComment.trim().length < 10) {
      setReviewFormError('Please write a detailed review (at least 10 characters).');
      return;
    }

    setIsSubmittingReview(true);
    const res = await addReview(product.id, {
      authorName: authorName.trim(),
      rating: newRating,
      title: reviewTitle.trim() || undefined,
      comment: reviewComment.trim(),
      location: reviewerLocation.trim() || undefined
    });
    setIsSubmittingReview(false);

    if (res.success) {
      setIsWritingReview(false);
      setReviewTitle('');
      setReviewComment('');
      setAuthorName('');
      setReviewerLocation('');
      setNewRating(5);
    } else {
      setReviewFormError(res.error || 'Failed to submit review');
    }
  };

  const handleHelpfulVote = (reviewId: string) => {
    if (votedReviewIds.includes(reviewId)) return;
    setVotedReviewIds(prev => [...prev, reviewId]);
    voteReviewHelpful(product.id, reviewId);
  };

  // Filter & sort reviews
  const filteredReviews = productReviews.filter(r => {
    if (reviewFilterStar === 'all') return true;
    return r.rating === reviewFilterStar;
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    if (reviewSort === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (reviewSort === 'highest') {
      return b.rating - a.rating;
    }
    if (reviewSort === 'lowest') {
      return a.rating - b.rating;
    }
    if (reviewSort === 'helpful') {
      return (b.helpfulCount || 0) - (a.helpfulCount || 0);
    }
    return 0;
  });

  const totalReviewsCount = productReviews.length;
  const ratingCounts = {
    5: productReviews.filter(r => r.rating === 5).length,
    4: productReviews.filter(r => r.rating === 4).length,
    3: productReviews.filter(r => r.rating === 3).length,
    2: productReviews.filter(r => r.rating === 2).length,
    1: productReviews.filter(r => r.rating === 1).length,
  };

  const positivePercent = totalReviewsCount > 0
    ? Math.round(((ratingCounts[5] + ratingCounts[4]) / totalReviewsCount) * 100)
    : 100;

  const formatReviewDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Recently';
    }
  };

  const ratingLabels: Record<number, string> = {
    5: '5 Stars — Exceptional Studio Grade',
    4: '4 Stars — Very Good & Reliable',
    3: '3 Stars — Average / Standard Specs',
    2: '2 Stars — Below Expectations',
    1: '1 Star — Poor Performance'
  };

  return (
    <AnimatePresence>
      <div
        id="product-detail-modal-backdrop"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={() => setQuickViewProduct(null)}
      >
        <motion.div
          id="product-detail-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-neutral-900 border border-neutral-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl max-h-[92vh] flex flex-col my-auto"
        >
          {/* Header Close button */}
          <button
            id="close-product-detail-button"
            onClick={() => setQuickViewProduct(null)}
            className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-neutral-950/70 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="overflow-y-auto p-5 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              
              {/* Media Gallery */}
              <div className="flex flex-col gap-3">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800">
                  <img
                    src={product.images[selectedImageIndex] || product.images[0]}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {/* Realtime stock badge */}
                  <div className="absolute top-3 left-3">
                    {isOutOfStock ? (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-neutral-950/90 text-neutral-400 border border-neutral-800 backdrop-blur-md">
                        Sold Out
                      </span>
                    ) : isLowStock ? (
                      <span
                        id={`modal-low-stock-badge-${product.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-amber-950/95 text-amber-300 border border-amber-500/80 backdrop-blur-md shadow-lg"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Low Stock • Only {product.stock} Remaining (Threshold: {product.lowStockThreshold})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-neutral-950/80 text-emerald-400 border border-neutral-800 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {product.stock} Units In Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Thumbnail selector */}
                {product.images.length > 1 && (
                  <div className="flex items-center gap-3">
                    {product.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImageIndex === idx ? 'border-emerald-500 scale-105' : 'border-neutral-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Warehouse Location Info */}
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 text-xs text-neutral-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Fulfillment Center:</span>
                  </span>
                  <span className="font-mono text-neutral-200">{product.warehouse}</span>
                </div>
              </div>

              {/* Product Dossier & Buying Controls */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      id={`modal-sku-search-btn-${product.id}`}
                      onClick={() => {
                        setSkuSearchQuery(product.sku);
                        setQuickViewProduct(null);
                      }}
                      className="inline-flex items-center gap-1 font-mono text-xs text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 rounded-lg border border-sky-500/30 transition-colors cursor-pointer"
                      title="Search and filter warehouse catalog specifically by this SKU"
                    >
                      <Barcode className="w-3 h-3 text-sky-400" />
                      <span>{product.sku}</span>
                    </button>
                    <button
                      id={`modal-view-qr-btn-${product.id}`}
                      onClick={() => setQrCodeProduct(product)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30 transition-colors shadow-xs cursor-pointer"
                      title={`View scannable QR code for SKU: ${product.sku}`}
                    >
                      <QrCode className="w-3 h-3" />
                      <span>View QR</span>
                    </button>
                    <button
                      id={`modal-audit-btn-${product.id}`}
                      onClick={() => setIsAuditModalOpen(true)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 transition-colors shadow-xs cursor-pointer"
                      title={`View stock adjustment audit log for SKU: ${product.sku}`}
                    >
                      <ClipboardList className="w-3 h-3" />
                      <span>Audit</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('product-reviews-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 text-amber-400 font-medium hover:text-amber-300 transition-colors cursor-pointer group"
                    title="Click to view customer ratings and reviews"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold">{product.rating.toFixed(1)}</span>
                    <span className="text-neutral-500 underline decoration-neutral-700 underline-offset-2 group-hover:text-neutral-300 transition-colors">
                      ({productReviews.length} {productReviews.length === 1 ? 'review' : 'reviews'})
                    </span>
                  </button>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1.5 leading-snug">
                  {product.name}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed">
                  {product.description}
                </p>

                {/* Price Display */}
                <div className="mt-4 p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-neutral-400 block">Unit Price (USD)</span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-bold text-white font-mono">
                        ${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      {product.originalPrice && (
                        <span className="text-sm text-neutral-500 line-through font-mono">
                          ${product.originalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-emerald-400 block font-medium">
                      Encrypted Checkout
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Fast Dispatch Guaranteed
                    </span>
                  </div>
                </div>

                {/* Target Track Product Box */}
                <div className="mt-3 p-3.5 rounded-xl border bg-neutral-950/60 transition-all border-neutral-800">
                  {existingAlert ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                            existingAlert.status === 'triggered' || product.price <= existingAlert.targetPrice
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            <BellRing className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              Tracking Active
                              {existingAlert.status === 'triggered' || product.price <= existingAlert.targetPrice ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  Target Met!
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Radar On
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-neutral-400 block font-mono">
                              Target: <strong className="text-amber-300">${existingAlert.targetPrice.toFixed(2)}</strong> (Current: ${product.price.toFixed(2)})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleQuickDropTest}
                            disabled={isSimulatingDrop}
                            className="px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center gap-1 transition-colors"
                            title="Simulate 15% price drop to test notification chime and alert toast"
                          >
                            <Zap className="w-3 h-3" />
                            <span>{isSimulatingDrop ? 'Dropping...' : 'Test Drop'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAlertFormOpen(!isAlertFormOpen)}
                            className="px-2 py-1 text-[11px] font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                          >
                            Adjust
                          </button>
                          <button
                            type="button"
                            onClick={() => removeInventoryAlert(product.id)}
                            className="p-1 text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-neutral-800 transition-colors"
                            title="Remove alert"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                          <BellRing className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-white">Automated Price Drop Alert</span>
                          <span className="text-[11px] text-neutral-400 block">
                            Set your target price and receive instant notification when it drops
                          </span>
                        </div>
                      </div>

                      <button
                        id="open-product-price-alert-btn"
                        onClick={() => setIsAlertFormOpen(!isAlertFormOpen)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1.5"
                      >
                        <Tag className="w-3 h-3" />
                        <span>Set Target</span>
                      </button>
                    </div>
                  )}

                  {/* Expandable Form */}
                  {isAlertFormOpen && (
                    <form onSubmit={handleSaveAlert} className="mt-3 pt-3 border-t border-neutral-800/80 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="text-neutral-300 font-medium">Quick Target Discount:</span>
                          <span className="text-neutral-400 font-mono">
                            Current: ${product.price.toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 mb-2">
                          {[5, 10, 15, 20].map((pct) => {
                            const val = (product.price * (1 - pct / 100)).toFixed(2);
                            const isSelected = customTargetPrice === val;
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => setCustomTargetPrice(val)}
                                className={`py-1 px-1.5 rounded-lg text-[10px] font-mono border transition-all ${
                                  isSelected
                                    ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
                                }`}
                              >
                                -{pct}% (${val})
                              </button>
                            );
                          })}
                        </div>

                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400 font-mono text-xs">
                            $
                          </span>
                          <input
                            id="modal-custom-target-price-input"
                            type="number"
                            step="0.01"
                            min="1"
                            max={product.price}
                            value={customTargetPrice}
                            onChange={(e) => setCustomTargetPrice(e.target.value)}
                            placeholder="Enter custom target threshold"
                            required
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-6 pr-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAlertFormOpen(false)}
                          className="px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-200"
                        >
                          Cancel
                        </button>
                        <button
                          id="save-product-price-alert-btn"
                          type="submit"
                          className="px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <BellRing className="w-3 h-3 stroke-[2.5]" />
                          <span>{existingAlert ? 'Update Alert' : 'Save Price Watch'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Key Features */}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                    Key Innovations
                  </h4>
                  <ul className="space-y-1.5">
                    {product.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-neutral-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Technical Specifications */}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                    Technical Specifications
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(product.specs).map(([key, value]) => (
                      <div key={key} className="p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/60">
                        <span className="text-[10px] text-neutral-500 uppercase block font-mono">{key}</span>
                        <span className="text-neutral-200 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Purchase Action Buttons */}
                <div className="mt-6 pt-5 border-t border-neutral-800 space-y-3">
                  {/* Quantity selector */}
                  {!isOutOfStock && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-300 font-medium">Quantity:</span>
                      <div className="flex items-center border border-neutral-700 bg-neutral-950 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="px-3 py-1.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800"
                        >
                          -
                        </button>
                        <span className="px-4 py-1.5 text-xs font-mono font-bold text-white min-w-10 text-center">
                          {quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                          disabled={quantity >= product.stock}
                          className="px-3 py-1.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        id="modal-toggle-wishlist-button"
                        onClick={() => toggleWishlist(product.id)}
                        className={`text-xs font-semibold py-2 px-3.5 rounded-xl border flex items-center gap-2 transition-all ${
                          isWishlisted
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
                        <span>{isWishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
                      </button>

                      <button
                        id="modal-toggle-compare-button"
                        onClick={() => toggleCompareProduct(product.id)}
                        className={`text-xs font-semibold py-2 px-3.5 rounded-xl border flex items-center gap-2 transition-all ${
                          isCompared
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>{isCompared ? 'In Comparison' : 'Compare'}</span>
                      </button>

                      <button
                        id="modal-scan-qr-button"
                        onClick={() => setQrCodeProduct(product)}
                        className="text-xs font-semibold py-2 px-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 flex items-center gap-2 transition-all shadow-sm"
                        title="Generate QR code to scan from physical device screen"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Scan to Phone</span>
                      </button>

                      <button
                        id="modal-price-alert-button"
                        onClick={() => setActiveInventoryAlertProduct(product)}
                        className={`text-xs font-semibold py-2 px-3.5 rounded-xl border flex items-center gap-2 transition-all shadow-sm ${
                          existingAlert
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}
                        title="Track inventory & price"
                      >
                        <BellRing className={`w-3.5 h-3.5 ${existingAlert ? 'text-amber-400 fill-amber-500/20' : ''}`} />
                        <span>{existingAlert ? `Target: $${existingAlert.targetPrice.toFixed(2)}` : 'Track Product'}</span>
                      </button>

                      <button
                        id="modal-sku-audit-button"
                        onClick={() => setIsAuditModalOpen(true)}
                        className="text-xs font-semibold py-2 px-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                        title={`View stock adjustment audit log and operator IDs for SKU: ${product.sku}`}
                      >
                        <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
                        <span>Audit</span>
                      </button>
                    </div>

                    {comparedProductIds.length > 0 && (
                      <button
                        onClick={() => {
                          setQuickViewProduct(null);
                          setIsCompareModalOpen(true);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
                      >
                        Open Comparison ({comparedProductIds.length})
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="modal-add-to-cart-button"
                      onClick={handleAddToCart}
                      disabled={isOutOfStock}
                      className={`py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isOutOfStock
                          ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                          : addedAnimation
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 active:scale-95'
                      }`}
                    >
                      {addedAnimation ? (
                        <>
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Reserved in Cart!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          <span>Add to Cart</span>
                        </>
                      )}
                    </button>

                    <button
                      id="modal-buy-now-button"
                      onClick={handleBuyNow}
                      disabled={isOutOfStock}
                      className={`py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isOutOfStock
                          ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/20 active:scale-95'
                      }`}
                    >
                      <span>Secure Checkout</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-400 pt-2">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {product.warranty}
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-sky-400" />
                      Signature Insured Delivery
                    </span>
                  </div>
                </div>

              </div>

            </div>

            {/* Customer Reviews & Feedback Section */}
            <div
              id="product-reviews-section"
              className="mt-12 pt-10 border-t border-neutral-800"
            >
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Star className="w-5 h-5 fill-amber-400" />
                    </span>
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      Customer Reviews & Ratings
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {productReviews.length} {productReviews.length === 1 ? 'Review' : 'Reviews'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    Verified creator impressions, studio benchmarks, and real-world feedback
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWritingReview(prev => !prev)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm cursor-pointer bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold active:scale-95"
                >
                  <PenSquare className="w-4 h-4" />
                  <span>{isWritingReview ? 'Close Review Form' : 'Write a Review'}</span>
                </button>
              </div>

              {/* Rating Overview & Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-8 p-5 sm:p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-xs">
                {/* Left Column: Big Score */}
                <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-neutral-800/80">
                  <div className="text-5xl font-black text-white tracking-tight flex items-baseline gap-1">
                    <span>{product.rating.toFixed(1)}</span>
                    <span className="text-lg font-normal text-neutral-500">/ 5.0</span>
                  </div>
                  <div className="flex items-center gap-1 my-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(product.rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-neutral-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-neutral-400">
                    Based on {productReviews.length} verified ratings
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{positivePercent}% Recommend this equipment</span>
                  </div>
                </div>

                {/* Center Column: Star Distribution Bars */}
                <div className="md:col-span-5 flex flex-col justify-center space-y-2 py-2">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const count = ratingCounts[stars as keyof typeof ratingCounts] || 0;
                    const pct = totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;
                    const isSelected = reviewFilterStar === stars;

                    return (
                      <button
                        key={stars}
                        type="button"
                        onClick={() => setReviewFilterStar(isSelected ? 'all' : stars)}
                        className={`group flex items-center gap-3 text-xs w-full text-left py-0.5 px-1.5 rounded-lg transition-colors cursor-pointer ${
                          isSelected ? 'bg-amber-500/15 text-amber-300' : 'hover:bg-neutral-800/60 text-neutral-400'
                        }`}
                      >
                        <span className="w-12 font-medium flex items-center gap-1 text-neutral-300">
                          {stars} <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-16 text-right font-mono text-[11px] text-neutral-400 group-hover:text-white">
                          {count} ({pct}%)
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Column: CTA & Summary */}
                <div className="md:col-span-3 flex flex-col justify-center items-start md:items-end text-left md:text-right border-t md:border-t-0 md:border-l border-neutral-800/80 pt-4 md:pt-0 md:pl-5">
                  <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Community Quality
                  </span>
                  <p className="text-xs text-neutral-400 mt-1 mb-3">
                    Share your hands-on experience to help fellow audio engineers and creators.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsWritingReview(true)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 underline underline-offset-4 cursor-pointer"
                  >
                    <span>Share your feedback</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* "Write a Review" Slide-Down Form */}
              <AnimatePresence>
                {isWritingReview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-8"
                  >
                    <form
                      onSubmit={handleReviewSubmit}
                      className="p-6 rounded-2xl bg-neutral-900 border border-amber-500/30 shadow-xl shadow-amber-500/5 relative"
                    >
                      <div className="flex items-center justify-between pb-4 mb-5 border-b border-neutral-800">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                            <PenSquare className="w-4 h-4" />
                          </span>
                          <h4 className="font-semibold text-white text-base">
                            Write a Customer Review
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsWritingReview(false)}
                          className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {reviewFormError && (
                        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{reviewFormError}</span>
                        </div>
                      )}

                      {/* Interactive Star Rating Selector */}
                      <div className="mb-6">
                        <label className="block text-xs font-medium text-neutral-300 mb-2">
                          Overall Rating <span className="text-amber-400">*</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 bg-neutral-950 p-2 rounded-xl border border-neutral-800">
                            {[1, 2, 3, 4, 5].map(star => {
                              const activeStar = hoverRating || newRating;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setNewRating(star)}
                                  onMouseEnter={() => setHoverRating(star)}
                                  onMouseLeave={() => setHoverRating(0)}
                                  className="p-1 rounded-lg transition-transform hover:scale-125 focus:outline-hidden cursor-pointer"
                                >
                                  <Star
                                    className={`w-6 h-6 transition-colors ${
                                      star <= activeStar
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-neutral-700'
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-xs font-semibold text-amber-300">
                            {ratingLabels[hoverRating || newRating]}
                          </span>
                        </div>
                      </div>

                      {/* Author & Location Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                            Your Name / Alias <span className="text-amber-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={authorName}
                            onChange={e => setAuthorName(e.target.value)}
                            placeholder="e.g. Liam Vance (Sound Designer)"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500/60 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                            Location (Optional)
                          </label>
                          <input
                            type="text"
                            value={reviewerLocation}
                            onChange={e => setReviewerLocation(e.target.value)}
                            placeholder="e.g. Austin, TX"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500/60 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Review Headline / Title */}
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                          Headline / Review Title (Optional)
                        </label>
                        <input
                          type="text"
                          value={reviewTitle}
                          onChange={e => setReviewTitle(e.target.value)}
                          placeholder="e.g. Unrivaled frequency response and pristine build"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500/60 transition-colors"
                        />
                      </div>

                      {/* Written Comments Textarea */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-neutral-300">
                            Written Comment <span className="text-amber-400">*</span>
                          </label>
                          <span className="text-[11px] text-neutral-500">
                            {reviewComment.length} characters (min 10)
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          required
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          placeholder="What do you think of this product? How does it perform in your daily workflow?"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-amber-500/60 transition-colors resize-y min-h-[90px]"
                        />
                      </div>

                      {/* Form Footer */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Submitted reviews receive Verified Creator badge</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsWritingReview(false)}
                            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmittingReview}
                            className="px-5 py-2 rounded-xl text-xs font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                          >
                            {isSubmittingReview ? (
                              <>
                                <div className="w-3 h-3 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                                <span>Posting...</span>
                              </>
                            ) : (
                              <>
                                <Star className="w-3.5 h-3.5 fill-neutral-950" />
                                <span>Publish Review</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Filters & Sorting Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-neutral-800">
                {/* Star Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-neutral-400 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-neutral-500" />
                    Filter:
                  </span>
                  <button
                    type="button"
                    onClick={() => setReviewFilterStar('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      reviewFilterStar === 'all'
                        ? 'bg-amber-500 text-neutral-950 font-semibold'
                        : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    All ({totalReviewsCount})
                  </button>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = ratingCounts[star as keyof typeof ratingCounts] || 0;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewFilterStar(star)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                          reviewFilterStar === star
                            ? 'bg-amber-500 text-neutral-950 font-semibold'
                            : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        <span>{star}</span>
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-[10px] opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400 flex items-center gap-1">
                    <SlidersHorizontal className="w-3 h-3 text-neutral-500" />
                    Sort:
                  </span>
                  <select
                    value={reviewSort}
                    onChange={e => setReviewSort(e.target.value as any)}
                    aria-label="Sort customer reviews"
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-hidden focus:border-amber-500/60 cursor-pointer"
                  >
                    <option value="newest">Most Recent</option>
                    <option value="highest">Highest Rating</option>
                    <option value="lowest">Lowest Rating</option>
                    <option value="helpful">Most Helpful</option>
                  </select>
                </div>
              </div>

              {/* Reviews List */}
              <div className="space-y-4">
                {sortedReviews.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-2xl bg-neutral-900/40 border border-dashed border-neutral-800">
                    <MessageSquare className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-neutral-300">
                      {reviewFilterStar === 'all'
                        ? 'No reviews yet for this product'
                        : `No ${reviewFilterStar}-star reviews yet`}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                      Be the first to share your thoughts on the build quality, specs, and real-world audio/visual performance.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setReviewFilterStar('all');
                        setIsWritingReview(true);
                      }}
                      className="mt-4 px-4 py-2 rounded-xl text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <PenSquare className="w-3.5 h-3.5" />
                      <span>Write First Review</span>
                    </button>
                  </div>
                ) : (
                  sortedReviews.map(review => {
                    const isVoted = votedReviewIds.includes(review.id);
                    const authorInitials = review.authorName
                      ? review.authorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                      : 'CR';

                    return (
                      <div
                        key={review.id}
                        className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700/80 transition-all shadow-sm"
                      >
                        {/* Top Row: Reviewer Details & Rating */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/20 to-neutral-800 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300">
                              {authorInitials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-white">
                                  {review.authorName}
                                </span>
                                {review.verifiedPurchase !== false && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Verified Buyer
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                                {review.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-neutral-500" />
                                    {review.location}
                                  </span>
                                )}
                                <span>•</span>
                                <span>{formatReviewDate(review.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Stars */}
                          <div className="flex items-center gap-1 bg-neutral-950/80 px-2.5 py-1 rounded-lg border border-neutral-800/80 self-start sm:self-auto">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= review.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-neutral-700'
                                }`}
                              />
                            ))}
                            <span className="ml-1 text-xs font-bold text-neutral-300">
                              {review.rating}.0
                            </span>
                          </div>
                        </div>

                        {/* Review Title */}
                        {review.title && (
                          <h4 className="text-sm font-bold text-white mb-2 leading-snug">
                            {review.title}
                          </h4>
                        )}

                        {/* Review Comment */}
                        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                          {review.comment}
                        </p>

                        {/* Bottom Row: Helpful Vote */}
                        <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-500">
                          <span className="text-[11px]">
                            Was this review helpful to your workflow?
                          </span>
                          <button
                            type="button"
                            onClick={() => handleHelpfulVote(review.id)}
                            disabled={isVoted}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                              isVoted
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700/50'
                            }`}
                          >
                            <ThumbsUp className={`w-3 h-3 ${isVoted ? 'fill-emerald-400' : ''}`} />
                            <span>{isVoted ? 'Helpful' : 'Helpful'}</span>
                            <span className="font-mono text-[11px] opacity-80">
                              ({review.helpfulCount || 0})
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* SKU Stock Adjustment Audit Log Modal */}
      <SkuAuditLogModal
        product={product}
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />
    </AnimatePresence>
  );
};

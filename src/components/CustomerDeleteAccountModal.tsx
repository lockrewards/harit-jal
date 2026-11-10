import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Lock, Eye, EyeOff, ShieldAlert, Clock } from 'lucide-react';
import { CustomerAccount } from '../types';
import { CustomerAuthService } from '../services/customerAuth';
import { soundPlayer } from '../services/sound';

interface CustomerDeleteAccountModalProps {
  isOpen: boolean;
  customer: CustomerAccount;
  onClose: () => void;
  onDeletionScheduled: (dueAt: string) => void;
}

export const CustomerDeleteAccountModal: React.FC<CustomerDeleteAccountModalProps> = ({
  isOpen,
  customer,
  onClose,
  onDeletionScheduled,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('अकाउंट डिलीट करने के लिए अपना पासवर्ड दर्ज करना अनिवार्य है। (Please enter your password to confirm).');
      soundPlayer.playBubblePop();
      return;
    }

    setIsSubmitting(true);
    soundPlayer.playWaterDrop();

    try {
      const res = await CustomerAuthService.scheduleAccountDeletion(password.trim());
      if (res.success && res.deletionDueAt) {
        soundPlayer.playSuccessChime();
        onDeletionScheduled(res.deletionDueAt);
      } else {
        soundPlayer.playBubblePop();
        setError(res.error || 'अकाउंट डिलीट करने में समस्या आई। कृपया पासवर्ड पुनः जाँचें।');
      }
    } catch (err: unknown) {
      soundPlayer.playBubblePop();
      setError(err instanceof Error ? err.message : 'Deletion request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102C47]/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-[#FFF9EF] border border-red-300 rounded-3xl shadow-2xl overflow-hidden font-manrope text-[#102C47]">
        
        {/* Header */}
        <div className="p-5 bg-red-50 border-b border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-playfair text-red-950">
                Delete Account (अकाउंट डिलीट करें)
              </h2>
              <p className="text-[11px] text-red-700">
                {customer.restaurantName} ({customer.email})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-900 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleConfirmDelete} className="p-5 space-y-4">
          
          {error && (
            <div className="p-3 rounded-xl bg-red-100/80 border border-red-300 text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 24-HOUR GRACE PERIOD NOTICE BOX */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-[#102C47] space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>24 घंटे की सुरक्षा अवधि (24-Hour Grace Period)</span>
            </div>
            
            <p className="text-[11.5px] leading-relaxed text-[#4B5563]">
              आपका अकाउंट तुरंत नहीं मिटेगा। रिक्वेस्ट दर्ज होने के बाद आपका अकाउंट <strong>24 घंटे के लिए डि-एक्टिवेट</strong> हो जाएगा।
            </p>

            <div className="p-2.5 rounded-xl bg-white/80 border border-amber-200 text-[11px] space-y-1">
              <p className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <span>💡</span> अगर आप अकाउंट डिलीट नहीं करना चाहते:
              </p>
              <p className="text-[#374151] pl-5 leading-snug">
                बस अगले <strong>24 घंटे के अंदर कभी भी अपना अकाउंट दोबारा लॉगिन कर लें</strong>। लॉगिन करते ही आपकी डिलीट रिक्वेस्ट अपने आप रद्द हो जाएगी और अकाउंट चालू रहेगा।
              </p>
            </div>

            <p className="text-[10.5px] text-red-700 pt-1 font-medium">
              * यदि आप 24 घंटे तक लॉगिन नहीं करते हैं, तो 24 घंटे बाद आपका अकाउंट और सारा डेटा हमेशा के लिए स्थायी रूप से मिटा दिया जाएगा।
            </p>
          </div>

          {/* PASSWORD CONFIRMATION */}
          <div>
            <label className="block text-xs font-bold text-[#102C47] mb-1">
              कन्फर्म करने के लिए अपना पासवर्ड दर्ज करें *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="अपना करंट पासवर्ड दर्ज करें..."
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white border border-red-200 text-xs text-[#102C47] font-medium focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-1/2 py-2.5 rounded-full bg-white hover:bg-gray-100 text-[#102C47] font-bold text-xs border border-gray-300 transition cursor-pointer"
            >
              वापस जाएं (Keep Account)
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !password.trim()}
              className="w-full sm:w-1/2 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'प्रोसेसिंग...' : '24 घंटे में डिलीट करें'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};


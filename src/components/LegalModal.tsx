import React, { useState } from 'react';
import { X, Shield, FileText, Truck, RefreshCw, Phone, CheckCircle2, Cookie } from 'lucide-react';
import { soundPlayer } from '../services/sound';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'privacy' | 'shipping' | 'refund' | 'contact';
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, defaultTab = 'terms' }) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'shipping' | 'refund' | 'contact'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#102B46]/60 backdrop-blur-md animate-fadeIn font-manrope">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#FFF9EF] border border-[#C99B43]/40 rounded-3xl shadow-[0_25px_60px_rgba(16,43,70,0.25)] flex flex-col overflow-hidden text-[#102B46]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#C99B43]/20 bg-[#F8F3E9]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#102B46] text-[#C99B43] flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-playfair text-[#102B46]">Harit Jal Statutory & Legal Hub</h2>
              <p className="text-xs text-[#77766F]">Transparent hospitality compliance, terms, and regulatory documentation</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundPlayer.playBubblePop();
              onClose();
            }}
            className="p-2 rounded-full hover:bg-[#102B46]/10 text-[#77766F] hover:text-[#102B46] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#FFF9EF] border-b border-[#C99B43]/20 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'terms', label: 'Terms & Conditions', icon: FileText },
            { id: 'privacy', label: 'Privacy Policy', icon: Shield },
            { id: 'shipping', label: 'Delivery & Logistics', icon: Truck },
            { id: 'refund', label: 'Returns & Buyback', icon: RefreshCw },
            { id: 'contact', label: 'Contact & Support', icon: Phone },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab(t.id as typeof activeTab);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#102B46] text-[#FFF9EF] shadow-sm'
                    : 'text-[#77766F] hover:text-[#102B46] hover:bg-[#102B46]/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 text-sm leading-relaxed text-[#102B46]/90 space-y-4">
          
          {/* Tab 1: Terms & Conditions */}
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold font-playfair text-[#102B46]">Bespoke Bottling Partnership Terms</h3>
              <p>
                Harit Jal (हरित जल) provides customized packaged drinking water bottling services exclusively to registered food businesses, hotels, restaurants, cafes, and highway dhabas across India.
              </p>
              
              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/30 space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#455C22]">1. Exclusive Branding Rights</h4>
                <p className="text-xs text-[#77766F]">
                  Custom labels created with your establishment's name, logo, and artwork remain exclusively associated with your orders. Harit Jal will never sell, transfer, or distribute your custom branded bottles to any third-party business.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/30 space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#455C22]">2. Regulatory Compliance</h4>
                <p className="text-xs text-[#77766F]">
                  All bottled water is produced in compliance with the Bureau of Indian Standards (BIS IS:14543) and Food Safety and Standards Authority of India (FSSAI) specifications. Every bottle label displays mandatory food safety information, statutory consumer helpline numbers, net quantity, and manufacturing details.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/30 space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#455C22]">3. Minimum Order Quantity (MOQ)</h4>
                <p className="text-xs text-[#77766F]">
                  As an emerging hospitality brand, our initial batch sizes are structured to support independent restaurants and dhabas with flexible minimum order tiers starting from 25 to 50 crates.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Privacy Policy */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold font-playfair text-[#102B46]">Restaurant Partner Privacy Policy</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#455C22]/10 text-[#455C22] text-[10px] font-mono font-bold">
                  DPDPA 2023 COMPLIANT
                </span>
              </div>
              <p>
                We respect your business privacy and process digital personal data in strict compliance with India&apos;s <strong>Digital Personal Data Protection Act, 2023 (DPDP Act 2023)</strong>.
              </p>

              <ul className="space-y-2 text-xs text-[#77766F]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0 mt-0.5" />
                  <span><strong>Lawful Purpose Limitation:</strong> We collect business contact information (store name, owner/manager name, email, phone number, delivery address) strictly to coordinate sample delivery, label artwork proofing, logistics replenishment, and statutory billing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0 mt-0.5" />
                  <span><strong>Notice & Affirmative Consent:</strong> Data is collected only following explicit affirmative action through our consent checkboxes on lead and registration forms.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0 mt-0.5" />
                  <span><strong>Zero Commercial Resale or Cross-Sharing:</strong> Your restaurant&apos;s contact information, bespoke logo artwork, and commercial order volumes will never be sold, rented, or shared with advertising networks, third-party brokers, or competitors.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0 mt-0.5" />
                  <span><strong>AES-256 Storage & Security Safeguards:</strong> All partner records are maintained with bank-grade AES-256 encryption at rest and TLS 1.3 encryption in transit with restricted role-based internal authorization.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0 mt-0.5" />
                  <span><strong>Data Principal Statutory Rights:</strong> As a Data Principal, you hold the legal right to access summary reports of your stored data, request rectification or erasure of obsolete records, and withdraw consent at any time.</span>
                </li>
              </ul>

              {/* DPDP Grievance Officer Box */}
              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/30 space-y-1.5 text-xs">
                <span className="font-bold text-[#102B46] block uppercase tracking-wider text-[11px] text-[#455C22]">
                  Data Protection & Grievance Redressal Officer (DPDP Act 2023)
                </span>
                <p className="text-[#77766F]">
                  For data access inquiries, consent revocations, or grievance filings, contact our compliance desk directly at <strong className="text-[#102B46] font-mono">info@haritjal.in</strong>. All queries receive formal redressal within 48 business hours.
                </p>
              </div>

              <div className="pt-1 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-[#77766F]">Need to adjust your local storage & cookie consent?</span>
                <button
                  type="button"
                  onClick={() => {
                    soundPlayer.playBubblePop();
                    onClose();
                    window.dispatchEvent(new CustomEvent('harit_jal_open_cookie_preferences'));
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-[#102B46] text-[#FFF9EF] text-xs font-bold hover:bg-[#183C60] transition cursor-pointer flex items-center gap-1.5"
                >
                  <Cookie className="w-3.5 h-3.5 text-[#C99B43]" />
                  <span>Adjust Cookie Preferences</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Shipping & Logistics */}
          {activeTab === 'shipping' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold font-playfair text-[#102B46]">Dispatch, Transportation & Delivery</h3>
              <p>
                Harit Jal manages direct-to-cellar deliveries to ensure seamless replenishment without disrupting your restaurant service.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20 space-y-1.5">
                  <span className="font-bold text-[#102B46] block">Direct Doorstep Unloading</span>
                  <p className="text-[#77766F]">Cases are securely delivered directly to your restaurant storage area or bar counter with complete consignment verification.</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20 space-y-1.5">
                  <span className="font-bold text-[#102B46] block">Scheduled Replenishment</span>
                  <p className="text-[#77766F]">Partners can set up recurring weekly or fortnightly deliveries based on dining table turnover rates.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Refund & Returns */}
          {activeTab === 'refund' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold font-playfair text-[#102B46]">Quality Assurance & Empty Bottle Recycling</h3>
              <p>
                We stand behind the physical condition and statutory compliance of every case delivered to your tables.
              </p>

              <div className="space-y-2 text-xs text-[#77766F]">
                <p><strong>Damaged or Defective Bottles:</strong> Any case showing transit damage, leakage, or defective seal upon delivery will be replaced immediately at zero extra cost.</p>
                <p><strong>EPR Plastic Buyback:</strong> Under our Extended Producer Responsibility initiative, empty PET bottles returned by your restaurant are collected for accredited eco-recycling, earning recycling credit rebates on subsequent orders.</p>
              </div>
            </div>
          )}

          {/* Tab 5: Contact & Support */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold font-playfair text-[#102B46]">Hospitality Desk & Communications</h3>
              <p>
                Reach out directly to our dedicated hospitality team for sample requests, label proof revisions, or scheduling inquiries.
              </p>

              <div className="p-5 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/30 space-y-3 text-xs">
                <div>
                  <span className="font-bold text-[#102B46] block">Brand Name:</span>
                  <span className="text-[#77766F]">Harit Jal (हरित जल) — Bespoke Dining Hydration</span>
                </div>
                <div>
                  <span className="font-bold text-[#102B46] block">Hospitality Hotline:</span>
                  <a href="tel:+916299293497" className="text-[#102B46] font-mono hover:text-[#C99B43] transition">
                    +91 62992 93497
                  </a>
                </div>
                <div>
                  <span className="font-bold text-[#102B46] block">Official Email:</span>
                  <a href="mailto:info@haritjal.in" className="text-[#102B46] font-mono hover:text-[#C99B43] transition">
                    info@haritjal.in
                  </a>
                </div>
                <div>
                  <span className="font-bold text-[#102B46] block">Operational Focus:</span>
                  <span className="text-[#77766F]">B2B packaged drinking water customization for hospitality establishments across India</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#F8F3E9] border-t border-[#C99B43]/20 flex items-center justify-between">
          <span className="text-xs text-[#77766F]">Harit Jal • Bespoke Dining Hydration</span>
          <button
            onClick={() => {
              soundPlayer.playBubblePop();
              onClose();
            }}
            className="px-5 py-2 rounded-full bg-[#102B46] text-[#FFF9EF] text-xs font-bold hover:bg-[#183C60] transition cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};


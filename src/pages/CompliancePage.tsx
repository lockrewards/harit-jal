import React, { useState } from 'react';
import { ShieldCheck, Award, CheckCircle2, Lock, UserCheck, Shield, Building2 } from 'lucide-react';
import { soundPlayer } from '../services/sound';

export const CompliancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'standards' | 'dpdp'>('standards');

  return (
    <div className="pt-20 sm:pt-22 pb-12 md:pb-14 bg-[#F8F3E9] text-[#102C47] font-manrope min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B42]/40 text-[#52652D] text-xs font-bold mb-2.5 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#52652D]" />
            <span>STATUTORY & REGULATORY COMPLIANCE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[44px] font-bold font-playfair text-[#102C47] tracking-tight leading-tight">
            Statutory Licensing & <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B42]">
              Hospitality Food Safety Compliance.
            </span>
          </h1>
          <p className="mt-2 text-[#77766F] text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
            Every bottle supplied adheres strictly to FSSAI food safety regulations, GST commercial tax invoicing, MSME enterprise standards, and DPDP Act 2023 privacy governance.
          </p>

          {/* Tab Navigation */}
          <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                setActiveTab('standards');
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'standards'
                  ? 'btn-gold-luxury shadow-xs'
                  : 'bg-[#FFF9EF] text-[#102C47] hover:bg-white border border-[#C99B42]/30'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Statutory Licenses & Registrations</span>
            </button>

            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                setActiveTab('dpdp');
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'dpdp'
                  ? 'btn-gold-luxury shadow-xs'
                  : 'bg-[#FFF9EF] text-[#102C47] hover:bg-white border border-[#C99B42]/30'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>DPDP Act 2023 (Data Privacy)</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Statutory Frameworks & Registrations */}
        {activeTab === 'standards' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              
              {/* Card 1: FSSAI Food Safety */}
              <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#52652D]/10 text-[#52652D] text-[10.5px] font-mono font-bold border border-[#52652D]/30">
                    FOOD SAFETY NORMS
                  </span>
                  <span className="text-xs text-[#C99B42] font-mono font-bold">FSSAI ACT 2006</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47]">FSSAI Hygiene & Labeling</h3>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Adherence to Food Safety and Standards (Packaging and Labelling) Regulations. Every bottle carries transparent manufacturer details, nutritional info, and consumer helpline.
                </p>
                <div className="space-y-1.5 pt-2 border-t border-[#C99B42]/15 text-xs">
                  <div className="flex items-center gap-2 text-[#102C47]">
                    <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                    <span>Schedule 4 GMP & GHP cleanroom practices</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#102C47]">
                    <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                    <span>Clear statutory label declarations for dining venues</span>
                  </div>
                </div>
              </div>

              {/* Card 2: GST Registration */}
              <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#52652D]/10 text-[#52652D] text-[10.5px] font-mono font-bold border border-[#52652D]/30">
                    TAXATION COMPLIANCE
                  </span>
                  <span className="text-xs text-[#C99B42] font-mono font-bold">GSTIN COMPLIANT</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47]">GST Registration</h3>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Officially registered under Goods and Services Tax (GST), Government of India. Full commercial transparency with formal B2B GST tax invoices, HSN classification, and legal tax compliance.
                </p>
                <div className="space-y-1.5 pt-2 border-t border-[#C99B42]/15 text-xs">
                  <div className="flex items-center gap-2 text-[#102C47]">
                    <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                    <span>Compliant B2B tax invoicing for hospitality partners</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#102C47]">
                    <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                    <span>Input Tax Credit (ITC) eligibility for businesses</span>
                  </div>
                </div>
              </div>

              {/* Card 3: MSME / Udyam Registration */}
              <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#52652D]/10 text-[#52652D] text-[10.5px] font-mono font-bold border border-[#52652D]/30">
                    GOVT OF INDIA
                  </span>
                  <span className="text-xs text-[#C99B42] font-mono font-bold">UDYAM REGISTERED</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47]">MSME Registration</h3>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Formally registered Micro, Small & Medium Enterprise under the Ministry of MSME, Government of India. Committed to responsible regional commerce, ethical trade, and verified operations.
                </p>
                <div className="space-y-1.5 pt-2 border-t border-[#C99B42]/15 text-xs">
                  <div className="flex items-center gap-2 text-[#102C47]">
                    <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                    <span>Certified enterprise under Ministry of MSME</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#102C47]">
                    <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                    <span>Verified local supply chains & ethical partnerships</span>
                  </div>
                </div>
              </div>

              {/* Card 4: DPDP Act 2023 */}
              <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#52652D]/10 text-[#52652D] text-[10.5px] font-mono font-bold border border-[#52652D]/30">
                    DATA PRIVACY LAW
                  </span>
                  <span className="text-xs text-[#C99B42] font-mono font-bold">DPDP ACT 2023</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47]">Digital Personal Data Protection</h3>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Full statutory adherence to India&apos;s DPDP Act 2023. Restaurant partner records, account credentials, and artwork files are secured under strict Data Fiduciary duties with AES-256 encryption.
                </p>
                <div className="space-y-1.5 pt-2 border-t border-[#C99B42]/15 text-xs">
                  <div className="flex items-center gap-2 text-[#102C47]">
                    <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                    <span>Notice & affirmative consent on every consultation form</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#102C47]">
                    <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                    <span>Zero commercial third-party sharing & Grievance Officer</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Sourcing & Hospitality Co-Packing Transparency Banner */}
            <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 shadow-xs space-y-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-[#102C47] font-bold font-playfair text-base sm:text-lg">
                <Building2 className="w-5 h-5 text-[#C99B42]" />
                <span>Transparent Hospitality Sourcing & Co-Packing Architecture</span>
              </div>
              <p className="text-[#77766F] leading-relaxed">
                Harit Jal works with appropriately licensed drinking water manufacturers and verified packaging suppliers to deliver quality drinking water in customized bottles for restaurants, hotels and hospitality businesses. We focus on bespoke branding, premium packaging, food-grade containers and scheduled deliveries tailored to each business&apos;s requirements.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/20">
                  <span className="font-bold text-[#102C47] block mb-0.5">1. Sourced Water</span>
                  <span className="text-[#77766F]">Drinking water sourced from appropriately licensed manufacturing partners.</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/20">
                  <span className="font-bold text-[#102C47] block mb-0.5">2. Quality Packaging</span>
                  <span className="text-[#77766F]">Food-grade glass and approved PET bottles with suitable packaging documentation.</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/20">
                  <span className="font-bold text-[#102C47] block mb-0.5">3. Custom Branding & Logistics</span>
                  <span className="text-[#77766F]">Customized restaurant and hotel labels with scheduled business deliveries.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: DPDP Act 2023 Compliance & Data Governance */}
        {activeTab === 'dpdp' && (
          <div className="rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 p-5 sm:p-7 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#C99B42]/20">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#52652D]/10 text-[#52652D] text-[10.5px] font-mono font-bold border border-[#52652D]/30">
                  STATUTORY PRIVACY COMPLIANCE
                </span>
                <h3 className="text-xl sm:text-2xl font-bold font-playfair text-[#102C47] mt-1">
                  Digital Personal Data Protection Act, 2023 (DPDP Act)
                </h3>
              </div>
              <span className="px-3.5 py-1.5 rounded-full bg-[#102C47] text-[#FFF9EF] text-xs font-bold self-start sm:self-auto flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#C99B42]" />
                <span>100% Compliant Fiduciary</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed max-w-3xl">
              Harit Jal (हरित जल) processes digital personal data in strict compliance with India&apos;s <strong>Digital Personal Data Protection Act, 2023 (DPDPA 2023)</strong>. As a responsible <em>Data Fiduciary</em>, we guarantee that all information provided by hospitality partners is managed with lawful consent, strict purpose limitation, and uncompromising security.
            </p>

            {/* 4 Pillars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="p-4.5 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/25 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#102C47] text-[#C99B42] flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h4 className="font-bold text-sm text-[#102C47]">Notice & Explicit Consent (Section 5)</h4>
                </div>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Before collecting any personal data (such as restaurant manager name, contact number, email, or dining location), we present an unambiguous notice specifying the exact purpose of data collection. Consent is affirmative, unbundled, and voluntary.
                </p>
              </div>

              <div className="p-4.5 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/25 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#102C47] text-[#C99B42] flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h4 className="font-bold text-sm text-[#102C47]">Purpose Limitation & Minimisation (Section 4)</h4>
                </div>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Collected contact data is used strictly for bottle sample delivery, personalized label design proofing, logistics coordination, and statutory GST invoicing. We never monetize, sell, or cross-share partner databases with external marketing networks.
                </p>
              </div>

              <div className="p-4.5 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/25 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#102C47] text-[#C99B42] flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h4 className="font-bold text-sm text-[#102C47]">AES-256 Storage & Reasonable Security (Section 8)</h4>
                </div>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  All digital records, account credentials, and custom vector logos are protected with AES-256 encryption at rest and TLS 1.3 encryption in transit. Strict role-based access control prevents any unauthorized employee access or data leakage.
                </p>
              </div>

              <div className="p-4.5 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/25 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#102C47] text-[#C99B42] flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <h4 className="font-bold text-sm text-[#102C47]">Data Principal Rights & Redressal (Section 11-14)</h4>
                </div>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Every restaurant partner acts as a <em>Data Principal</em> and enjoys the fundamental right to access a summary of their personal data, request correction or complete erasure, and withdraw previously granted consent at any time without penalty.
                </p>
              </div>

            </div>

            {/* Statutory Grievance Redressal Desk */}
            <div className="p-5 rounded-2xl sm:rounded-3xl bg-[#102C47] text-[#FFF9EF] border border-[#C99B42]/35 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#C99B42]" />
                  <h4 className="font-bold font-playfair text-base text-[#FFF9EF]">
                    Designated Data Protection & Grievance Redressal Officer
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-[#C99B42] font-semibold">
                  Rule 13, DPDPA 2023
                </span>
              </div>
              <p className="text-xs text-[#FFF9EF]/80 leading-relaxed">
                If you have inquiries regarding your personal data, want to request an export or erasure of your records, or need to lodge a grievance under the DPDP Act 2023, please reach out directly to our designated compliance desk:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-[#FFF9EF]/10 border border-[#C99B42]/25">
                  <span className="text-[10px] text-[#C99B42] uppercase font-bold block">Grievance Desk Email</span>
                  <a href="mailto:info@haritjal.in" className="font-mono font-medium text-[#FFF9EF] hover:text-[#C99B42] transition">
                    info@haritjal.in
                  </a>
                </div>
                <div className="p-3 rounded-xl bg-[#FFF9EF]/10 border border-[#C99B42]/25">
                  <span className="text-[10px] text-[#C99B42] uppercase font-bold block">Statutory Turnaround</span>
                  <span className="font-medium text-[#FFF9EF]">Within 48 Business Hours</span>
                </div>
                <div className="p-3 rounded-xl bg-[#FFF9EF]/10 border border-[#C99B42]/25">
                  <span className="text-[10px] text-[#C99B42] uppercase font-bold block">Legal Jurisdiction</span>
                  <span className="font-medium text-[#FFF9EF]">Banuchhapar, Bettiah, Bihar India</span>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

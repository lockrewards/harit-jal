import React from 'react';
import { ShieldCheck, CheckCircle2, Building2 } from 'lucide-react';

export const ComplianceHub: React.FC = () => {
  return (
    <section id="compliance-section" className="relative py-14 md:py-18 bg-[#F8F3E9] text-[#102B46] overflow-hidden border-t border-[#C99B43]/20">
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B43]/40 text-[#455C22] text-xs font-bold mb-3 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-[#455C22]" />
            <span className="font-manrope">REGULATORY & STATUTORY COMPLIANCE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-playfair text-[#102B46] tracking-tight">
            Built Strictly In Adherence To <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B43]">
              Government Safety Standards.
            </span>
          </h2>
          <p className="mt-3 text-[#77766F] text-sm sm:text-base leading-relaxed font-manrope">
            Every bottle produced adheres to FSSAI food safety packaging rules, GST commercial invoicing, MSME standards, and DPDP Act 2023 data privacy governance.
          </p>
        </div>

        {/* 4-Column Statutory Frameworks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 font-manrope">
          
          {/* FSSAI */}
          <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-[#455C22]/10 text-[#455C22] text-[10.5px] font-mono font-bold border border-[#455C22]/30">
                FOOD SAFETY NORMS
              </span>
              <span className="text-xs text-[#C99B43] font-mono font-bold">FSSAI ACT 2006</span>
            </div>
            <h3 className="text-lg font-bold font-playfair text-[#102B46]">FSSAI Hygiene & Labeling</h3>
            <p className="text-xs text-[#77766F] leading-relaxed">
              Adherence to Food Safety and Standards (Packaging and Labelling) Regulations. Every bottle carries transparent manufacturer details, nutritional info, and consumer helpline.
            </p>
            <div className="space-y-1.5 pt-2 border-t border-[#C99B43]/20 text-xs">
              <div className="flex items-center gap-2 text-[#102C47]">
                <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                <span>Schedule 4 GMP & GHP cleanroom practices</span>
              </div>
              <div className="flex items-center gap-2 text-[#102C47]">
                <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                <span>Clear statutory label declarations for dining venues</span>
              </div>
            </div>
          </div>

          {/* GST Registration */}
          <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-[#455C22]/10 text-[#455C22] text-[10.5px] font-mono font-bold border border-[#455C22]/30">
                TAXATION COMPLIANCE
              </span>
              <span className="text-xs text-[#C99B43] font-mono font-bold">GSTIN COMPLIANT</span>
            </div>
            <h3 className="text-lg font-bold font-playfair text-[#102B46]">GST Registration</h3>
            <p className="text-xs text-[#77766F] leading-relaxed">
              Officially registered under Goods and Services Tax, Government of India. Full commercial transparency with formal B2B GST tax invoices, HSN classification, and Input Tax Credit (ITC) eligibility.
            </p>
            <div className="space-y-1.5 pt-2 border-t border-[#C99B43]/20 text-xs">
              <div className="flex items-center gap-2 text-[#102C47]">
                <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                <span>Compliant B2B tax invoicing for dining venues</span>
              </div>
              <div className="flex items-center gap-2 text-[#102C47]">
                <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                <span>Input Tax Credit (ITC) reconciliation for businesses</span>
              </div>
            </div>
          </div>

          {/* MSME Registration */}
          <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-[#455C22]/10 text-[#455C22] text-[10.5px] font-mono font-bold border border-[#455C22]/30">
                GOVT OF INDIA
              </span>
              <span className="text-xs text-[#C99B43] font-mono font-bold">UDYAM REGISTERED</span>
            </div>
            <h3 className="text-lg font-bold font-playfair text-[#102B46]">MSME Registration</h3>
            <p className="text-xs text-[#77766F] leading-relaxed">
              Formally registered Micro, Small & Medium Enterprise under the Ministry of MSME, Government of India. Committed to responsible regional commerce, ethical trade, and verified operations.
            </p>
            <div className="space-y-1.5 pt-2 border-t border-[#C99B43]/20 text-xs">
              <div className="flex items-center gap-2 text-[#102C47]">
                <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                <span>Certified enterprise under Ministry of MSME</span>
              </div>
              <div className="flex items-center gap-2 text-[#102C47]">
                <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                <span>Verified local supply chains & ethical partnerships</span>
              </div>
            </div>
          </div>

          {/* DPDP Act 2023 */}
          <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md bg-[#455C22]/10 text-[#455C22] text-[10.5px] font-mono font-bold border border-[#455C22]/30">
                DATA PRIVACY LAW
              </span>
              <span className="text-xs text-[#C99B43] font-mono font-bold">DPDP ACT 2023</span>
            </div>
            <h3 className="text-lg font-bold font-playfair text-[#102B46]">Digital Personal Data Protection</h3>
            <p className="text-xs text-[#77766F] leading-relaxed">
              Full statutory adherence to India&apos;s DPDP Act 2023. Restaurant partner records and artwork files are secured under strict Data Fiduciary duties with AES-256 encryption.
            </p>
            <div className="space-y-1.5 pt-2 border-t border-[#C99B43]/20 text-xs">
              <div className="flex items-center gap-2 text-[#102C47]">
                <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                <span>Notice & affirmative consent on every consultation form</span>
              </div>
              <div className="flex items-center gap-2 text-[#102C47]">
                <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                <span>Zero commercial third-party sharing & Grievance Officer</span>
              </div>
            </div>
          </div>

        </div>

        {/* Sourcing & Hospitality Co-Packing Transparency Banner */}
        <div className="mt-6 p-6 sm:p-7 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 shadow-sm space-y-2.5 font-manrope text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-[#102B46] font-bold font-playfair text-base sm:text-lg">
            <Building2 className="w-5 h-5 text-[#C99B43]" />
            <span>Transparent Hospitality Sourcing & Co-Packing Architecture</span>
          </div>
          <p className="text-[#77766F] leading-relaxed">
            Harit Jal works with appropriately licensed drinking water manufacturers and verified packaging suppliers to deliver quality drinking water in customized bottles for restaurants, hotels and hospitality businesses. We focus on bespoke branding, premium packaging, food-grade containers and scheduled deliveries tailored to each business&apos;s requirements.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20">
              <span className="font-bold text-[#102B46] block mb-0.5">1. Sourced Water</span>
              <span className="text-[#77766F]">Drinking water sourced from appropriately licensed manufacturing partners.</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20">
              <span className="font-bold text-[#102B46] block mb-0.5">2. Quality Packaging</span>
              <span className="text-[#77766F]">Food-grade glass and approved PET bottles with suitable packaging documentation.</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20">
              <span className="font-bold text-[#102B46] block mb-0.5">3. Custom Branding & Logistics</span>
              <span className="text-[#77766F]">Customized restaurant and hotel labels with scheduled business deliveries.</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

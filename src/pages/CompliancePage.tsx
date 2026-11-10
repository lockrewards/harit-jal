import React, { useState } from 'react';
import { ShieldCheck, Award, FileText, CheckCircle2, Scale, Lock, UserCheck, Shield } from 'lucide-react';
import { soundPlayer } from '../services/sound';

export const CompliancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'standards' | 'quality_specs' | 'recycling' | 'dpdp'>('standards');

  return (
    <div className="pt-20 sm:pt-22 pb-12 md:pb-14 bg-[#F8F3E9] text-[#102C47] font-manrope min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B42]/40 text-[#52652D] text-xs font-bold mb-2.5 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#52652D]" />
            <span>STATUTORY & REGULATORY STANDARDS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[44px] font-bold font-playfair text-[#102C47] tracking-tight leading-tight">
            Government Safety Standards & <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B42]">
              Statutory Food Hygiene Compliance.
            </span>
          </h1>
          <p className="mt-2 text-[#77766F] text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
            Every bottle produced adheres strictly to the Bureau of Indian Standards (BIS IS:14543), FSSAI food safety packaging rules, Legal Metrology packaged commodity guidelines, and CPCB plastic recycling norms.
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
              <span>Statutory Frameworks</span>
            </button>

            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                setActiveTab('quality_specs');
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'quality_specs'
                  ? 'btn-gold-luxury shadow-xs'
                  : 'bg-[#FFF9EF] text-[#102C47] hover:bg-white border border-[#C99B42]/30'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>IS:14543 Water Quality Specs</span>
            </button>

            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                setActiveTab('recycling');
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'recycling'
                  ? 'btn-gold-luxury shadow-xs'
                  : 'bg-[#FFF9EF] text-[#102C47] hover:bg-white border border-[#C99B43]/30'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>CPCB EPR & Eco Recycling</span>
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

        {/* Tab 1: Statutory Frameworks */}
        {activeTab === 'standards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            
            <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-[#52652D]/10 text-[#52652D] text-[10.5px] font-mono font-bold border border-[#52652D]/30">
                  STATUTORY STANDARD
                </span>
                <span className="text-xs text-[#C99B42] font-mono font-bold">IS 14543:2004</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47]">Bureau of Indian Standards (ISI)</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Mandatory national specification for packaged drinking water. Governs automated bottle sanitation, multi-barrier filtration, ozone treatment, and physical quality verification.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-[#C99B42]/15 text-xs">
                <div className="flex items-center gap-2 text-[#102C47]">
                  <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                  <span>Packaged strictly under BIS-approved processing setups</span>
                </div>
                <div className="flex items-center gap-2 text-[#102C47]">
                  <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                  <span>Mandatory microbiological safety & mineral norms</span>
                </div>
              </div>
            </div>

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

            <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-[#52652D]/10 text-[#52652D] text-[10.5px] font-mono font-bold border border-[#52652D]/30">
                  CONSUMER PROTECTION
                </span>
                <span className="text-xs text-[#C99B42] font-mono font-bold">PCR 2011</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47]">Legal Metrology Packaged Rules</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Full compliance with weights & measures rules. Every bottle displays clearly marked net quantity, manufacture month/year, customer care helpline, and restaurant-specific MRP.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-[#C99B42]/15 text-xs">
                <div className="flex items-center gap-2 text-[#102C47]">
                  <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                  <span>Standardized font sizes & declaration geometry</span>
                </div>
                <div className="flex items-center gap-2 text-[#102C47]">
                  <CheckCircle2 className="w-4 h-4 text-[#52652D] shrink-0" />
                  <span>Transparent dining menu MRP alignment</span>
                </div>
              </div>
            </div>

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
        )}

        {/* Tab 2: Quality Specs Table */}
        {activeTab === 'quality_specs' && (
          <div className="rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#C99B42]/20">
              <div>
                <span className="text-xs font-mono font-bold text-[#52652D]">
                  OFFICIAL BIS SPECIFICATION REFERENCE
                </span>
                <h3 className="text-xl font-bold font-playfair text-[#102C47]">
                  IS:14543 Packaged Drinking Water Quality Limits
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#52652D]/10 text-[#52652D] text-xs font-bold border border-[#52652D]/30 self-start sm:self-auto">
                Adheres to BIS Standard
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F3E9] text-[#102C47] uppercase font-bold text-[10.5px]">
                  <tr>
                    <th className="py-3 px-3 rounded-l-lg">Parameter</th>
                    <th className="py-3 px-3">BIS IS:14543 Limit</th>
                    <th className="py-3 px-3">Harit Jal Specification</th>
                    <th className="py-3 px-3 rounded-r-lg">Standard Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C99B42]/15 text-[#102C47]/90">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">Total Dissolved Solids (TDS)</td>
                    <td className="py-2.5 px-3">Max 500 mg/L</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#52652D]">120 – 150 mg/L (Sweet Taste)</td>
                    <td className="py-2.5 px-3 text-[#52652D] font-bold">✓ Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">pH Value (at 25°C)</td>
                    <td className="py-2.5 px-3">6.5 to 8.5</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#52652D]">7.1 – 7.4 (Naturally Balanced)</td>
                    <td className="py-2.5 px-3 text-[#52652D] font-bold">✓ Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">Turbidity</td>
                    <td className="py-2.5 px-3">Max 2 NTU</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#52652D]">&lt; 0.2 NTU (Crystal Clear)</td>
                    <td className="py-2.5 px-3 text-[#52652D] font-bold">✓ Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">Escherichia coli (E. coli)</td>
                    <td className="py-2.5 px-3">Absent in 250 ml</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#52652D]">Zero / Absent</td>
                    <td className="py-2.5 px-3 text-[#52652D] font-bold">✓ Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">Coliform Bacteria</td>
                    <td className="py-2.5 px-3">Absent in 250 ml</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#52652D]">Zero / Absent</td>
                    <td className="py-2.5 px-3 text-[#52652D] font-bold">✓ Compliant</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Recycling Policy */}
        {activeTab === 'recycling' && (
          <div className="rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 p-5 sm:p-6 space-y-3.5 shadow-xs">
            <h3 className="text-xl font-bold font-playfair text-[#102C47]">
              Extended Producer Responsibility (EPR) & Circularity
            </h3>
            <p className="text-xs text-[#77766F] leading-relaxed max-w-2xl">
              Under our Extended Producer Responsibility commitment, all empty bottles are collected back from our partner restaurants and transferred to accredited recyclers.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/20 space-y-1.5">
                <span className="font-bold text-xs uppercase text-[#52652D] block">1. Doorstep Collection</span>
                <p className="text-xs text-[#77766F]">Empty crates and bottles retrieved on delivery rounds.</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/20 space-y-1.5">
                <span className="font-bold text-xs uppercase text-[#52652D] block">2. Accredited Reprocessing</span>
                <p className="text-xs text-[#77766F]">PET converted into recycled fibers and clean secondary resin.</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/20 space-y-1.5">
                <span className="font-bold text-xs uppercase text-[#52652D] block">3. Green Dining Badge</span>
                <p className="text-xs text-[#77766F]">Participating venues receive verified sustainability certificates.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: DPDP Act 2023 Compliance & Data Governance */}
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


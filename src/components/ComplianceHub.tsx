import React, { useState } from 'react';
import { ShieldCheck, Award, FileText, CheckCircle2, Scale } from 'lucide-react';
import { soundPlayer } from '../services/sound';

export const ComplianceHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'standards' | 'lab_report' | 'epr'>('standards');

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
            Every bottle produced adheres to the Bureau of Indian Standards (BIS IS:14543), FSSAI food safety regulations, Legal Metrology packaged commodity rules, and CPCB plastic recycling norms.
          </p>

          {/* Navigation Tabs */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                setActiveTab('standards');
              }}
              className={`px-5 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 font-manrope cursor-pointer ${
                activeTab === 'standards'
                  ? 'btn-gold-luxury shadow-md ring-2 ring-[#C99B43]/40'
                  : 'bg-[#FFF9EF] text-[#102B46] hover:bg-[#F8F3E9] border border-[#C99B43]/30'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Statutory Frameworks & Standards</span>
            </button>

            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                setActiveTab('lab_report');
              }}
              className={`px-5 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 font-manrope cursor-pointer ${
                activeTab === 'lab_report'
                  ? 'btn-gold-luxury shadow-md ring-2 ring-[#C99B43]/40'
                  : 'bg-[#FFF9EF] text-[#102B46] hover:bg-[#F8F3E9] border border-[#C99B43]/30'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>IS:14543 Quality Parameters</span>
            </button>

            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                setActiveTab('epr');
              }}
              className={`px-5 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 font-manrope cursor-pointer ${
                activeTab === 'epr'
                  ? 'btn-gold-luxury shadow-md ring-2 ring-[#C99B43]/40'
                  : 'bg-[#FFF9EF] text-[#102B46] hover:bg-[#F8F3E9] border border-[#C99B43]/30'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>CPCB EPR & Eco Recycling</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Government Standards */}
        {activeTab === 'standards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 font-manrope">
            
            {/* BIS IS 14543 */}
            <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-[#455C22]/10 text-[#455C22] text-[10.5px] font-mono font-bold border border-[#455C22]/30">
                  STATUTORY STANDARD
                </span>
                <span className="text-xs text-[#C99B43] font-mono font-bold">IS 14543:2004</span>
              </div>
              <h3 className="text-lg font-bold font-playfair text-[#102B46]">Bureau of Indian Standards (ISI)</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Mandatory national specification for packaged drinking water. Governs automated bottle sanitation, multi-barrier filtration, ozone treatment, and physical quality verification.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-[#C99B43]/20 text-xs">
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Packaged strictly under BIS-approved processing setups</span>
                </div>
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Mandatory microbiological safety & mineral norms</span>
                </div>
              </div>
            </div>

            {/* FSSAI Central Food Safety */}
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
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Schedule 4 GMP & GHP cleanroom practices</span>
                </div>
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Clear statutory label declarations for dining venues</span>
                </div>
              </div>
            </div>

            {/* Legal Metrology */}
            <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-[#455C22]/10 text-[#455C22] text-[10.5px] font-mono font-bold border border-[#455C22]/30">
                  CONSUMER PROTECTION
                </span>
                <span className="text-xs text-[#C99B43] font-mono font-bold">PCR 2011</span>
              </div>
              <h3 className="text-lg font-bold font-playfair text-[#102B46]">Legal Metrology Packaged Rules</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Full compliance with weights & measures rules. Every bottle displays clearly marked net quantity, manufacture month/year, customer care helpline, and restaurant-specific MRP.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-[#C99B43]/20 text-xs">
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Standardized font sizes & declaration geometry</span>
                </div>
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Transparent dining menu MRP alignment</span>
                </div>
              </div>
            </div>

            {/* Ground Water & Environmental Guidelines */}
            <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-[#455C22]/10 text-[#455C22] text-[10.5px] font-mono font-bold border border-[#455C22]/30">
                  RESOURCE MANAGEMENT
                </span>
                <span className="text-xs text-[#C99B43] font-mono font-bold">CGWA & SPCB</span>
              </div>
              <h3 className="text-lg font-bold font-playfair text-[#102B46]">Environmental Clearances</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Bottling plants operate with authorized water extraction permissions, flow measurement monitoring, and rainwater replenishment practices to safeguard local aquifers.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-[#C99B43]/20 text-xs">
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Water recharge and conservation support</span>
                </div>
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>State Pollution Control Board compliance</span>
                </div>
              </div>
            </div>

            {/* GST Invoicing */}
            <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-[#455C22]/10 text-[#455C22] text-[10.5px] font-mono font-bold border border-[#455C22]/30">
                  TAX COMPLIANCE
                </span>
                <span className="text-xs text-[#C99B43] font-mono font-bold">HSN 2201</span>
              </div>
              <h3 className="text-lg font-bold font-playfair text-[#102B46]">Transparent B2B Invoicing</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Standard B2B tax invoices provided with every case consignment. Enables seamless claim of Input Tax Credit (ITC) for your registered hospitality establishment.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-[#C99B43]/20 text-xs">
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Formal delivery challans with itemized GST</span>
                </div>
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Digital records preserved for partner audits</span>
                </div>
              </div>
            </div>

            {/* Plastic Waste Rules */}
            <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-[#455C22]/10 text-[#455C22] text-[10.5px] font-mono font-bold border border-[#455C22]/30">
                  PLASTIC MANAGEMENT
                </span>
                <span className="text-xs text-[#C99B43] font-mono font-bold">PWM RULES</span>
              </div>
              <h3 className="text-lg font-bold font-playfair text-[#102B46]">Single-Use Ban Exemption</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Bottles exceed minimum wall thickness standards and are fully exempt from municipal single-use plastic bans across Indian states. 100% recyclable food-grade resin.
              </p>
              <div className="space-y-1.5 pt-2 border-t border-[#C99B43]/20 text-xs">
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Food-grade virgin and recyclable resin</span>
                </div>
                <div className="flex items-center gap-2 text-[#102B46]">
                  <CheckCircle2 className="w-4 h-4 text-[#455C22] shrink-0" />
                  <span>Permitted for dine-in tables, takeout & banquets</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: IS:14543 Laboratory Quality Parameters */}
        {activeTab === 'lab_report' && (
          <div className="rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 p-5 md:p-7 space-y-5 shadow-sm font-manrope">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#C99B43]/20">
              <div>
                <span className="text-xs font-mono font-bold text-[#455C22]">
                  OFFICIAL BIS SPECIFICATION REFERENCE
                </span>
                <h3 className="text-xl font-bold font-playfair text-[#102B46]">
                  IS:14543 Packaged Drinking Water Quality Limits
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#455C22]/10 text-[#455C22] text-xs font-bold border border-[#455C22]/30 self-start sm:self-auto">
                Adheres to BIS Standard
              </span>
            </div>

            {/* Parameters Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead className="bg-[#F8F3E9] text-[#102B46] uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg">Parameter</th>
                    <th className="py-2.5 px-3">BIS IS:14543 Limit</th>
                    <th className="py-2.5 px-3">Harit Jal Specification</th>
                    <th className="py-2.5 px-3 rounded-r-lg">Standard Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C99B43]/15 text-[#102B46]/90">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">Total Dissolved Solids (TDS)</td>
                    <td className="py-2.5 px-3">Max 500 mg/L</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#455C22]">120 – 150 mg/L (Sweet Taste)</td>
                    <td className="py-2.5 px-3 text-[#455C22] font-bold">✓ Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">pH Value (at 25°C)</td>
                    <td className="py-2.5 px-3">6.5 to 8.5</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#455C22]">7.1 – 7.4 (Naturally Balanced)</td>
                    <td className="py-2.5 px-3 text-[#455C22] font-bold">✓ Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">Turbidity</td>
                    <td className="py-2.5 px-3">Max 2 NTU</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#455C22]">&lt; 0.2 NTU (Crystal Clear)</td>
                    <td className="py-2.5 px-3 text-[#455C22] font-bold">✓ Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">Escherichia coli (E. coli)</td>
                    <td className="py-2.5 px-3">Absent in 250 ml</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#455C22]">Zero / Absent</td>
                    <td className="py-2.5 px-3 text-[#455C22] font-bold">✓ Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">Coliform Bacteria</td>
                    <td className="py-2.5 px-3">Absent in 250 ml</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#455C22]">Zero / Absent</td>
                    <td className="py-2.5 px-3 text-[#455C22] font-bold">✓ Compliant</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold">Heavy Metals (Lead, Mercury, Arsenic)</td>
                    <td className="py-2.5 px-3">Below Limit of Detection</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#455C22]">Non-detectable</td>
                    <td className="py-2.5 px-3 text-[#455C22] font-bold">✓ Compliant</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-[#77766F] pt-2">
              Note: Standards shown reflect mandatory thresholds defined under Bureau of Indian Standards IS 14543:2004 for packaged drinking water.
            </p>
          </div>
        )}

        {/* Tab 3: CPCB EPR Policy */}
        {activeTab === 'epr' && (
          <div className="rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/35 p-6 md:p-8 space-y-5 shadow-sm font-manrope">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#455C22]/10 border border-[#455C22]/30 flex items-center justify-center text-[#455C22]">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-playfair text-[#102B46]">
                  Extended Producer Responsibility (EPR) & Circularity
                </h3>
                <span className="text-xs text-[#77766F]">
                  Responsible collection, recycling credit, and certified circular bottle recycling
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20 space-y-2">
                <h4 className="font-bold text-xs uppercase text-[#455C22]">1. Doorstep Bottle Collection</h4>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  During weekly replenishment deliveries, our logistics team collects crushed empty PET cases from your restaurant cellar.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20 space-y-2">
                <h4 className="font-bold text-xs uppercase text-[#455C22]">2. Certified Recycling</h4>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Collected bottles are sent to accredited plastic recyclers to be converted into secondary textile fibers and rPET pellets.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20 space-y-2">
                <h4 className="font-bold text-xs uppercase text-[#455C22]">3. Restaurant Green Badge</h4>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Partner restaurants receive an eco-certificate to proudly display in dining halls, showing diners your commitment to sustainability.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

    </section>
  );
};

import { KnowledgeItem } from '../types/neer';

const STORAGE_KEY = 'harit_jal_neer_knowledge_v1';

export const INITIAL_KNOWLEDGE_BASE: KnowledgeItem[] = [
  // Products & Sizing
  {
    id: 'kb-prod-500ml-glass',
    category: 'product',
    title: '500ml Classic Dining Glass Bottle',
    keywords: ['500ml', 'glass', 'dine-in', 'classic', 'table', 'flint', 'luxury'],
    content: 'The 500ml Classic Dining Glass Bottle is crafted from crystal-clear Flint Glass with chilled condensation beads. Designed for luxury restaurants, boutique bistros, and banquet dining. Features a polished champagne gold or emerald green cap. Wholesale rate: ₹14.00, Recommended menu MRP: ₹40.00. Table margin: ~65%. 100% reusable and recyclable.',
    source: 'Harit Jal Product Catalogue v2.4',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-prod-750ml-decanter',
    category: 'product',
    title: '750ml Grand Reserve Decanter',
    keywords: ['750ml', 'decanter', 'fluted', 'palace', 'vip', 'fine dining', 'gold stopper'],
    content: 'The 750ml Grand Reserve Decanter is made from heavy fluted flint glass with a royal gold stopper cap. Designed for palace dining, high-end fine dining establishments, VIP banquets, and presidential suites. Wholesale rate: ₹24.00, Recommended menu MRP: ₹70.00. Table margin: ~66%. Gives the table an opulent international feel.',
    source: 'Harit Jal Luxury Series Documentation',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-prod-250ml-cafe',
    category: 'product',
    title: '250ml Artisanal Cafe Edition',
    keywords: ['250ml', 'cafe', 'small', 'compact', 'quick dining', 'pet', 'rpet', 'single serve'],
    content: 'The 250ml Artisanal Cafe Edition is a lightweight food-grade rPET bottle with modern minimalist geometry. Perfect for specialty coffee shops, patisseries, quick service restaurants (QSR), and conference meeting tables. Wholesale rate: ₹7.00, Recommended menu MRP: ₹20.00. Table margin: ~65%. High turnover per table.',
    source: 'Harit Jal QSR & Cafe Guidelines',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-prod-1000ml-dhaba',
    category: 'product',
    title: '1000ml Highway Dhaba & Family Dining Edition',
    keywords: ['1000ml', '1 litre', 'dhaba', 'highway', 'family', 'large', 'kulhad', 'murthal', 'pet'],
    content: 'The 1000ml Highway Dhaba Edition is built with an ergonomic ribbed grip designed specifically for high-turnover family dining tables, highway resorts, and dhabas (like Karan The Dhaba, Murthal). Sturdy food-grade recyclable rPET with Forest Olive or Royal Gold cap. Wholesale rate: ₹11.00, Recommended menu MRP: ₹25.00. Table margin: ~56%.',
    source: 'Harit Jal Highway Hospitality Division',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-prod-500ml-executive',
    category: 'product',
    title: '500ml Executive Hotel Dining Edition',
    keywords: ['500ml', 'hotel', 'executive', 'resort', 'room service', 'silver cap'],
    content: 'The 500ml Executive Hotel Dining Edition features a cylindrical silhouette with a deep navy label, brushed silver cap, and linen texture feel. Designed for boutique hotels, business executive lounges, and premier resorts. Wholesale rate: ₹14.00, Recommended menu MRP: ₹45.00. Elevates guest room minibar and conference dining.',
    source: 'Harit Jal Hotel Division',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-prod-750ml-banquet',
    category: 'product',
    title: '750ml Grand Banquet Celebration Bottle',
    keywords: ['750ml', 'banquet', 'wedding', 'event', 'ballroom', 'celebration', 'caterer'],
    content: 'The 750ml Grand Banquet Celebration Bottle is sculpted from fluted glass with Champagne Gold cap and wedding floral accent label design. Perfect for grand weddings, luxury reception ballrooms, and corporate galas. Wholesale rate: ₹24.00, Recommended menu MRP: ₹65.00. Custom couple or banquet branding available.',
    source: 'Harit Jal Events & Banquets Portfolio',
    verified: true,
    lastUpdated: '2026-11-07',
  },

  // Pricing & Margins
  {
    id: 'kb-pricing-overview',
    category: 'pricing',
    title: 'Wholesale Pricing & Restaurant Margins',
    keywords: ['price', 'pricing', 'rate', 'cost', 'kitne', 'margin', 'profit', 'discount', 'wholesale'],
    content: 'Harit Jal wholesale rates range between ₹7.00 to ₹24.00 per bottle depending on bottle size (250ml, 500ml, 750ml, 1000ml) and material (Food-grade rPET vs Flint Glass). Most partner restaurants earn a 60%–70% gross profit margin per table when selling at standard menu MRPs (₹20 to ₹70). Volume discounts apply for orders exceeding 200 cases per month.',
    source: 'Harit Jal B2B Commercial Tariff 2026',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-moq-volumes',
    category: 'pricing',
    title: 'Minimum Order Quantities (MOQ)',
    keywords: ['moq', 'minimum order', 'kitna mangwa sakte', 'cases', 'crate', 'trial'],
    content: 'For initial restaurant trials and sample validation, minimum order starts at just 10 to 25 cases (240 to 600 bottles for 500ml). For regular scheduled weekly cellar replenishment, standard dispatch batches are 50 cases (1,200 bottles), packed securely in moisture-sealed crates.',
    source: 'Harit Jal Supply Chain Logistics Policy',
    verified: true,
    lastUpdated: '2026-11-07',
  },

  // Customization & 3D Studio
  {
    id: 'kb-custom-branding',
    category: 'customization',
    title: 'Restaurant Custom Branding & Labels',
    keywords: ['custom', 'branding', 'logo', 'name', 'apna naam', 'label', 'design', 'qr code', 'menu'],
    content: 'Harit Jal prints 100% custom-branded labels with your restaurant’s official name, emblem, Devanagari font, contact info, and an optional digital QR code directing guests to your live food menu or Google reviews. Available in 4 designer themes: Dhaba Heritage, Classic Luxury, Bistro Minimalist, and Regal Crest. Store owners can explore all bottle silhouettes in the Bottle Gallery.',
    source: 'Harit Jal Studio Specifications',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-cap-options',
    category: 'customization',
    title: 'Metallic Cap Finishes & Security Seals',
    keywords: ['cap', 'dhakkan', 'color', 'gold cap', 'seal', 'tamper evident'],
    content: 'Every Harit Jal bottle features a food-safe, leakproof, tamper-evident cap available in 4 signature hospitality finishes: Polished Champagne Gold, Forest Olive Green, Deep Royal Navy, and Soft Pearl Cream. High-barrier liner prevents atmospheric contamination and preserves crisp mountain-like taste.',
    source: 'Harit Jal Packaging QA Standards',
    verified: true,
    lastUpdated: '2026-11-07',
  },

  // Supply Process & Delivery
  {
    id: 'kb-supply-process',
    category: 'supply',
    title: '6-Stage Transparent Supply Journey',
    keywords: ['process', 'how it works', 'supply', 'delivery', 'journey', 'steps', 'cellar'],
    content: 'The Harit Jal supply journey operates in 6 transparent stages: 1. Digital Proofing (instant digital proof with your restaurant logo), 2. Physical Sample Verification (feel and test bottles at your dining tables), 3. High-Speed Robotic Bottling & Nitrogen Dosing, 4. NABL & BIS Quality Certification (batch-level microbiological testing), 5. Scheduled Cellar Delivery (direct to your cellar by temperature-controlled trucks), 6. CPCB Certified Circular Recycling (empty bottle pickup).',
    source: 'Harit Jal Operational SOP v4',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-delivery-coverage',
    category: 'supply',
    title: 'Delivery Coverage & Express Corridors',
    keywords: ['delivery', 'where', 'bihar', 'delhi', 'haryana', 'punjab', 'pan-india', 'location', 'city', 'transport'],
    content: 'Harit Jal delivers pan-India with dedicated express regional fleets along high-density hospitality corridors: Delhi NCR, GT Karnal Road / Murthal, Chandigarh, Punjab, Jaipur, Lucknow, Agra, Patna & Bihar highway circuits, Mumbai, and Bengaluru. Delivery to restaurant cellars is executed within 24 to 48 hours of automated re-order scheduling.',
    source: 'Harit Jal Fleet & Logistics Desk',
    verified: true,
    lastUpdated: '2026-11-07',
  },

  // Compliance & Quality Certifications
  {
    id: 'kb-bis-standard',
    category: 'compliance',
    title: 'BIS IS:14543 Packaged Drinking Water Certification',
    keywords: ['bis', 'is 14543', 'isi', 'standard', 'certification', 'license', 'quality', 'safe'],
    content: 'Harit Jal complies fully with Bureau of Indian Standards (BIS) IS:14543 for Packaged Drinking Water (Other Than Packaged Natural Mineral Water). Every production lot undergoes rigorous 8-stage multi-barrier purification: micron filtration, activated carbon absorption, dual RO membrane filtration, UV sterilisation, ozonation, and essential remineralisation with balanced calcium and magnesium for crisp palate neutrality.',
    source: 'BIS Bureau of Indian Standards Official Norms',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-fssai-compliance',
    category: 'compliance',
    title: 'FSSAI Food Safety Standards Compliance',
    keywords: ['fssai', 'food safety', 'license', 'authority', 'legal'],
    content: 'Certified under the Food Safety and Standards Authority of India (FSSAI) regulations for packaged drinking water. Each bottle clearly displays mandatory FSSAI license numbers, nutritional info (neutral zero cal, essential minerals), batch number, manufacturing date, and best before timeline.',
    source: 'FSSAI Food Safety Norms 2026',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-epr-recycling',
    category: 'compliance',
    title: 'CPCB Extended Producer Responsibility (EPR) & Circularity',
    keywords: ['epr', 'plastic', 'recycling', 'cpcb', 'eco-friendly', 'environment', 'green'],
    content: 'Harit Jal is 100% compliant with Ministry of Environment, Forest & Climate Change (MoEFCC) Plastic Waste Management Rules. Our bottles are 100% recyclable (rPET Category 1 and infinitely recyclable Flint Glass). Partner restaurants benefit from our reverse logistics buy-back program where empty used bottles are collected for certified recycling.',
    source: 'Central Pollution Control Board (CPCB) EPR Guidelines',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-dpdp-compliance',
    category: 'compliance',
    title: 'Digital Personal Data Protection Act (DPDP Act 2023) Compliance',
    keywords: ['dpdp', 'dpdpa', 'privacy', 'data protection', 'personal data', 'security', 'consent', 'encryption', 'share data', 'data principal', 'data fiduciary'],
    content: 'Harit Jal complies fully with India\'s Digital Personal Data Protection Act, 2023 (DPDP Act 2023). As a responsible Data Fiduciary: 1. Strict Purpose Limitation: Contact details (restaurant name, phone, email, location) are gathered solely for sample dispatch, order logistics, and custom branding quotes with affirmative consent. 2. Zero Third-Party Resale: We never sell, lease, or cross-share partner records with external marketing networks. 3. Bank-Grade Security: Data is encrypted using AES-256. 4. Data Principal Rights: You have the right to access, rectify, or withdraw consent at any time by contacting our Data Grievance Redressal Officer at info@haritjal.in.',
    source: 'Digital Personal Data Protection Act (DPDPA 2023) & Harit Jal Legal Desk',
    verified: true,
    lastUpdated: '2026-11-08',
  },
  {
    id: 'kb-cookie-policy',
    category: 'compliance',
    title: 'Cookie & Local Storage Policy',
    keywords: ['cookie', 'cookies', 'cookie policy', 'cookie permission', 'local storage', 'cache', 'tracking', 'privacy'],
    content: 'Harit Jal uses cookies and browser local storage to power your bottle gallery preview, remember your custom restaurant label drafts, and manage secure partner authentication at /track. Under India\'s DPDP Act 2023, we never sell your data or use intrusive third-party advertising cookies. Customers can accept all, choose essential only, or customize their cookie preferences at any time from the website footer or compliance hub.',
    source: 'Harit Jal Cookie & Data Governance Policy 2026',
    verified: true,
    lastUpdated: '2026-11-08',
  },

  // Order Tracking & Partner Portal
  {
    id: 'kb-order-tracking',
    category: 'supply',
    title: 'How to Track Orders & Partner Portal',
    keywords: ['track', 'order', 'status', 'kahan pahuncha', 'driver', 'portal', 'login'],
    content: 'Store owners can track live consignments at `/track`. Simply log in with your restaurant email or enter your Order ID (e.g., ORD-HJ-8910). The tracking portal displays the exact 4-stage lifecycle: 1. Order Confirmed, 2. Bottling & BIS Testing, 3. Dispatched (with assigned vehicle number and driver phone), 4. Delivered to Restaurant Cellar.',
    source: 'Harit Jal Customer Portal Documentation',
    verified: true,
    lastUpdated: '2026-11-07',
  },

  // General Water & Hospitality Science
  {
    id: 'kb-general-glass-vs-pet',
    category: 'general',
    title: 'Glass Bottles vs PET Bottles: Which to Choose?',
    keywords: ['glass vs pet', 'difference', 'which is better', 'plastic vs glass', 'finedining', 'dhabas'],
    content: 'Glass bottles offer maximum luxury, zero chemical leaching, and are best for fine dining, boutique bistros, banquet dinner tables, and VIP lounges. Food-grade recyclable rPET bottles are lighter, shatterproof, more cost-effective, and ideal for fast-casual cafes, high-turnover dhabas, takeaway dining, and room service.',
    source: 'Hospitality Beverage Advisory Panel',
    verified: true,
    lastUpdated: '2026-11-07',
  },
  {
    id: 'kb-contact-details',
    category: 'general',
    title: 'Official Harit Jal Contact & Hospitality Hotline',
    keywords: ['contact', 'phone', 'number', 'email', 'address', 'office', 'whatsapp', 'customer care'],
    content: 'Harit Jal Hospitality Partner Desk:\n• Phone/WhatsApp: +91 62992 93497 (Mon–Sat, 9:00 AM – 8:00 PM IST)\n• Official Email: info@haritjal.in\n• Office / Registered Address: Banuchhapar, Bettiah, Bihar India\n• Consultation: Click "Book a Call" on the website for a free 15-minute discovery consultation and sample request.',
    source: 'Harit Jal Official Corporate Profile',
    verified: true,
    lastUpdated: '2026-11-07',
  },
];

export class KnowledgeBaseService {
  private static getStoredKnowledge(): KnowledgeItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return INITIAL_KNOWLEDGE_BASE;
  }

  public static getAllKnowledge(): KnowledgeItem[] {
    return this.getStoredKnowledge();
  }

  public static saveKnowledge(items: KnowledgeItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save knowledge base', e);
    }
  }

  public static addKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'lastUpdated'>): KnowledgeItem {
    const items = this.getStoredKnowledge();
    const newItem: KnowledgeItem = {
      ...item,
      id: `kb-custom-${Date.now()}`,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    items.unshift(newItem);
    this.saveKnowledge(items);
    return newItem;
  }

  public static updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): KnowledgeItem | null {
    const items = this.getStoredKnowledge();
    const index = items.findIndex((k) => k.id === id);
    if (index === -1) return null;

    items[index] = {
      ...items[index],
      ...updates,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    this.saveKnowledge(items);
    return items[index];
  }

  public static deleteKnowledgeItem(id: string): boolean {
    const items = this.getStoredKnowledge();
    const filtered = items.filter((k) => k.id !== id);
    if (filtered.length !== items.length) {
      this.saveKnowledge(filtered);
      return true;
    }
    return false;
  }

  public static resetToDefault(): KnowledgeItem[] {
    this.saveKnowledge(INITIAL_KNOWLEDGE_BASE);
    return INITIAL_KNOWLEDGE_BASE;
  }

  /**
   * Semantic & Keyword RAG Retrieval:
   * Matches customer queries against title, keywords, content, and category.
   * Returns ranked matching knowledge snippets with confidence score and citation.
   */
  public static searchKnowledge(query: string, maxResults = 3): { item: KnowledgeItem; score: number }[] {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return [];

    const stopWords = new Set([
      'com', 'in', 'org', 'net', 'gmail', 'yahoo', 'email', 'mail', 
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'to', 'for', 
      'of', 'or', 'by', 'with', 'hai', 'ka', 'ki', 'ke', 'ko', 'se', 'me'
    ]);

    const queryTokens = cleanQuery
      .replace(/[^\w\s\u0900-\u097F]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopWords.has(t));

    if (queryTokens.length === 0) return [];

    const items = this.getStoredKnowledge();

    const scored = items.map((item) => {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const contentLower = item.content.toLowerCase();

      // Exact phrase match
      if (titleLower.includes(cleanQuery)) score += 25;
      if (contentLower.includes(cleanQuery)) score += 15;

      // Keyword matches
      for (const kw of item.keywords) {
        const kwLower = kw.toLowerCase();
        if (cleanQuery.includes(kwLower)) {
          score += 12;
        }
        for (const token of queryTokens) {
          if (kwLower === token) {
            score += 8;
          }
        }
      }

      // Token matches in title & content
      for (const token of queryTokens) {
        if (titleLower.includes(token)) score += 5;
        if (contentLower.includes(token)) score += 2;
      }

      return { item, score };
    });

    return scored
      .filter((res) => res.score > 4)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }
}


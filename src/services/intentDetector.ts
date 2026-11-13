import { 
  ConversationContext, 
  ExtractedEntities, 
  IntentResult 
} from '../types/neer';

export class IntentDetector {
  /**
   * Clean and normalize raw email input
   */
  public static extractEmail(text: string): string | null {
    // Strips markdown links: [atal@gmail.com](mailto:atal@gmail.com) -> atal@gmail.com
    const cleanText = text.replace(/\[([^\]]+)\]\(mailto:[^)]+\)/gi, '$1');
    const emailMatch = cleanText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    return emailMatch ? emailMatch[0].toLowerCase().trim() : null;
  }

  /**
   * Clean and normalize raw phone number input
   * Detects 10-digit Indian mobile numbers (starting with 6, 7, 8, or 9)
   * with or without +91, 91, 0, spaces, dashes, or within sentences.
   */
  public static extractPhone(text: string): string | null {
    // Strips markdown links: [6299293497](tel:6299293497) -> 6299293497
    const cleanText = text.replace(/\[([^\]]+)\]\(tel:[^)]+\)/gi, '$1').trim();

    // 1. Matches Indian 10-digit starting with 6, 7, 8, 9 with optional country code (+91, 91, 0) and optional spaces/dashes
    const indianRegex = /(?:(?:\+|0{0,2})91[\s-]?)?([6-9]\d{4}[\s-]?\d{5}|[6-9]\d{9})\b/;
    const indianMatch = cleanText.match(indianRegex);
    if (indianMatch) {
      const digitsOnly = indianMatch[0].replace(/\D/g, '');
      const tenDigits = digitsOnly.slice(-10);
      if (tenDigits.length === 10 && /^[6-9]/.test(tenDigits)) {
        return tenDigits;
      }
    }

    // 2. Direct 10 digits starting with 6-9
    const standalone10 = cleanText.match(/\b([6-9]\d{9})\b/);
    if (standalone10) {
      return standalone10[1];
    }

    // 3. Fallback for any 10 consecutive digits
    const any10 = cleanText.match(/\b\d{10}\b/);
    if (any10) {
      return any10[0];
    }

    // 4. International format e.g. +1 (555) 123-4567
    const intlMatch = cleanText.match(/(?:\+?1[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b/);
    if (intlMatch) {
      return intlMatch[0].trim();
    }

    return null;
  }

  /**
   * Extract customer name from text, handling both explicit intro statements
   * and clean standalone/prompted name submissions (e.g. "samrat kumar", "samrat", "Atal Pandey").
   * Strictly prevents corrupting names (e.g., never removes 'mr' from inside 'samrat').
   */
  public static extractCustomerName(text: string, context?: ConversationContext): string | null {
    const raw = text.trim();
    if (!raw) return null;

    // Comprehensive non-name vocabulary: greetings, products, sizes, questions, actions, etc.
    const nonNameWords = new Set([
      'admin', 'user', 'customer', 'restaurant', 'hotel', 'dhaba', 'cafe', 'banquet', 'bistro', 'bar', 'lounge', 'kitchen', 'dining',
      'bottle', 'bottles', 'water', 'flint', 'glass', 'kaanch', 'pet', 'rpet', 'cap', 'caps', 'dhakkan', 'decanter', 'carafe',
      'price', 'pricing', 'rate', 'rates', 'cost', 'wholesale', 'mrp', 'discount', 'margin', 'profit', 'paisa', 'paise', 'kharcha',
      'kitne', 'kitna', 'kitni', 'kya', 'kaise', 'kyu', 'kaun', 'kahan', 'kab', 'what', 'why', 'when', 'where', 'how', 'who', 'which',
      'hi', 'hello', 'hey', 'namaste', 'namaskar', 'hola', 'good', 'morning', 'evening', 'afternoon',
      'yes', 'no', 'ok', 'okay', 'haan', 'haanji', 'nahi', 'na', 'sure', 'done', 'thik', 'theek', 'accha', 'sahi',
      'call', 'callback', 'booking', 'book', 'order', 'tracking', 'track', 'delivery', 'deliver', 'supply', 'sample', 'samples', 'trial',
      'details', 'jankari', 'info', 'information', 'enquiry', 'query', 'question', 'sawal', 'help', 'madad', 'login', 'signin', 'portal',
      'website', 'menu', 'qr', 'code', 'please', 'kripya', 'available', 'uplabdh', 'pash', 'pass', 'hai', 'hain', 'hoon', 'tha', 'thi',
      '250ml', '500ml', '750ml', '1000ml', '1liter', '1litre', '1l', '1ltr', 'liter', 'litre', 'ltr', 'ml'
    ]);

    // 1. Explicit intro statements: e.g. "My name is Samrat Kumar", "Mera naam Samrat hai", "I am Samrat"
    const explicitMatch = raw.match(/(?:^|\b)(?:my\s*name\s*is|i\s*am|i'm|call\s*me|mera\s*naam\s*(?:hai)?|naam\s*(?:hai)?|this\s*is|name\s*[:-])\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})(?:\s+(?:hai|hoon|here))?/i);
    if (explicitMatch && explicitMatch[1]) {
      const candidate = explicitMatch[1].trim();
      const parts = candidate.split(/\s+/).filter(Boolean);
      const isClean = parts.every(p => p.length >= 2 && !nonNameWords.has(p.toLowerCase()));
      if (isClean && parts.length >= 1 && parts.length <= 3) {
        return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }

    // 2. Standalone or Contextual Name Extraction:
    // Strip phone and email if combined (e.g. "Samrat Kumar 9876543210")
    let filtered = raw;
    const phone = this.extractPhone(raw);
    if (phone) filtered = filtered.replace(phone, ' ');
    const email = this.extractEmail(raw);
    if (email) filtered = filtered.replace(email, ' ');

    // Strip common conversational wrapper phrases (using word boundaries \b so we NEVER touch internal letters)
    filtered = filtered
      .replace(/\b(?:my\s*name\s*is|mera\s*naam\s*(?:hai)?|naam\s*(?:hai)?|i\s*am|this\s*is|call\s*me|i'm)\b/gi, ' ')
      .replace(/\b(?:hai|hoon|bol\s*raha\s*hoon|here)\b/gi, ' ')
      // Strip honorifics ONLY if they appear as standalone words at the very beginning or end
      .replace(/^\s*(?:mr\.?|mrs\.?|ms\.?|shri|shree|dr\.?)\s+/i, ' ')
      .replace(/\s+(?:ji|bhai|sir)\s*$/i, ' ')
      .replace(/[^\w\s]/g, ' ')
      .trim();

    const words = filtered.split(/\s+/).filter(Boolean);

    // A valid name consists of 1 to 3 words
    if (words.length >= 1 && words.length <= 3) {
      const allWordsAlphabetic = words.every(w => /^[A-Za-z]+$/.test(w) && w.length >= 2 && w.length <= 25);
      const noneInBlacklist = words.every(w => !nonNameWords.has(w.toLowerCase()));

      if (allWordsAlphabetic && noneInBlacklist) {
        // Condition: Either prompted (lastQuestionAsked was name/phone), or pure 1-2 word standalone name
        const isPrompted = Boolean(context && (
          context.lastQuestionAsked === 'customer_name' || 
          context.lastQuestionAsked === 'name' || 
          context.lastQuestionAsked === 'name_and_phone' ||
          context.lastQuestionAsked === 'phone' ||
          context.lastQuestionAsked === 'contact_info'
        ));

        // Or unprompted standalone person name (e.g. "samrat kumar", "samrat", "Atal Pandey")
        const isStandalone = !context?.customerName && (
          words.length >= 2 ||
          isPrompted ||
          (raw.length >= 3 && raw.length <= 20)
        );

        if (isPrompted || isStandalone) {
          return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
      }
    }

    return null;
  }

  /**
   * Extract quantity from text
   */
  public static extractQuantity(text: string): number | null {
    const qtyRegex = /\b(\d+)\s*(?:bottles?|units?|cases?|crates?|piece?s?|per\s*day|daily|monthly|har\s*din|roz)?\b/i;
    const match = text.match(qtyRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0 && num < 1000000) {
        return num;
      }
    }
    return null;
  }

  /**
   * Main Intent & Entity Analyzer (Alias)
   */
  public static detectIntent(
    text: string, 
    context: ConversationContext = { language: 'english', currentPage: '/gallery', turnsCount: 0 }
  ): IntentResult {
    return this.analyze(text, context);
  }

  /**
   * Main Intent & Entity Analyzer
   */
  public static analyze(
    text: string, 
    context: ConversationContext = { language: 'english', currentPage: '/gallery', turnsCount: 0 }
  ): IntentResult {
    const raw = text.trim();
    const lower = raw.toLowerCase();
    const entities: ExtractedEntities = {};

    // 1. Email Extraction
    const extractedEmail = this.extractEmail(raw);
    if (extractedEmail) {
      entities.email = extractedEmail;
    }

    // 2. Phone Extraction
    const extractedPhone = this.extractPhone(raw);
    if (extractedPhone) {
      entities.phone = extractedPhone;
    }

    // 3. Size Extraction (handles 250ml, 500ml, 750ml, 1000ml, 1liter, 1litre, 1l, 1ltr)
    if (/\b(?:250ml|250\s*ml)\b/i.test(lower)) entities.bottleSize = '250ml';
    else if (/\b(?:500ml|500\s*ml)\b/i.test(lower)) entities.bottleSize = '500ml';
    else if (/\b(?:750ml|750\s*ml|decanter)\b/i.test(lower)) entities.bottleSize = '750ml_glass';
    else if (/\b(?:1000ml|1000\s*ml|1\s*litre|1\s*liter|1liter|1litre|1\s*l\b|1\s*ltr|1ltr)\b/i.test(lower)) entities.bottleSize = '1000ml';

    // 4. Material Extraction
    if (/\b(?:glass|flint\s*glass|kaanch|sheesha)\b/i.test(lower)) entities.bottleMaterial = 'glass';
    else if (/\b(?:pet|rpet|plastic|recyclable)\b/i.test(lower)) entities.bottleMaterial = 'rpet';

    // 5. Business Category Extraction
    if (/\b(?:dhaba|highway)\b/i.test(lower)) entities.businessCategory = 'dhaba';
    else if (/\b(?:cafe|coffee|patisserie)\b/i.test(lower)) entities.businessCategory = 'cafe';
    else if (/\b(?:hotel|resort|lodge)\b/i.test(lower)) entities.businessCategory = 'hotel';
    else if (/\b(?:banquet|wedding|marriage|lawn|party)\b/i.test(lower)) entities.businessCategory = 'banquet';
    else if (/\b(?:restaurant|dining|bistro|diner)\b/i.test(lower)) entities.businessCategory = 'restaurant';

    // 6. Quantity Extraction
    const qty = this.extractQuantity(raw);
    if (qty && (qty >= 10 || context.lastQuestionAsked === 'quantity')) {
      entities.estimatedQuantity = qty;
    }

    // 7. Customer / Business Name Extraction
    const extractedName = this.extractCustomerName(raw, context);
    if (extractedName) {
      entities.customerName = extractedName;
    }

    const businessMatch = raw.match(/(?:for|at|restaurant|hotel|dhaba|cafe|called|named)\s+([A-Z][A-Za-z0-9&'\s]+(?:Restaurant|Dhaba|Cafe|Hotel|Banquets?|Bistro|Kitchen|Lounge))/i);
    if (businessMatch) {
      entities.businessName = businessMatch[1].trim();
    } else if (context.lastQuestionAsked === 'restaurant_name' && raw.length > 2 && !extractedEmail && !extractedPhone && !extractedName) {
      // If the assistant just asked for restaurant name and user replied e.g. "Royal Restaurant"
      entities.businessName = raw.replace(/[!.?]+$/, '').trim();
    }

    // 8. Specific Sub-Topic Identification for Targeted Answers
    if (/(?:shelf\s*life|expiry|expire|kab\s*tak\s*chalega|kharab\s*hoga|life\s*span)/i.test(lower)) {
      entities.specificTopic = 'shelf_life';
    } else if (/(?:tds|ph|mineral|minerals|calcium|magnesium|ro\s*water|purification|filter|nabl|test\s*report)/i.test(lower)) {
      entities.specificTopic = 'tds_quality';
    } else if (/(?:cap\s*color|dhakkan|golden\s*cap|metallic\s*cap|cap\s*options|tamper\s*seal)/i.test(lower)) {
      entities.specificTopic = 'cap_colors';
    } else if (/(?:qr|qr\s*code|smart\s*qr|digital\s*menu|barcode|scan\s*menu)/i.test(lower)) {
      entities.specificTopic = 'qr_code';
    } else if (/(?:moq|minimum\s*order|kam\s*se\s*kam\s*kitni|choti\s*order|min\s*order)/i.test(lower)) {
      entities.specificTopic = 'moq';
    } else if (/(?:payment\s*terms|credit|advance|cod|cash\s*on\s*delivery|invoice\s*cycle|billing\s*terms)/i.test(lower)) {
      entities.specificTopic = 'payment_terms';
    } else if (/(?:sample\s*kit|free\s*sample|tasting\s*set|sample\s*bottle|check\s*sample)/i.test(lower)) {
      entities.specificTopic = 'sample_kit';
    } else if (/(?:khali\s*bottle|return|deposit|buy\s*back|recycling\s*credit|wapas\s*lete)/i.test(lower)) {
      entities.specificTopic = 'bottle_return';
    } else if (/(?:bihar|patna|murthal|delhi|haryana|punjab|jaipur|lucknow|mumbai|bengaluru|chandigarh)/i.test(lower)) {
      entities.specificTopic = 'city_delivery';
    }

    // --- Intent Detection Priority Engine ---

    // PRIORITY 1: Admin Panel / Internal Portal Security Guard (STRICT REFUSAL - DIRECT SORRY)
    if (
      /(?:admin\s*(?:panel|portal|dashboard|login|password|access|credentials|pin|page|key|secret|route|url|data|leads?|users?)|crm\s*(?:access|login|portal)|staff\s*(?:login|portal|panel|password)|internal\s*(?:panel|portal|system|database)|backend\s*login|admin@haritjal)/i.test(lower) ||
      /(?:admin\s*kaise\s*(?:khole|open|login)|admin\s*password|admin\s*login|admin\s*ko\s*data|admin\s*hu|i\s*am\s*admin)/i.test(lower)
    ) {
      return { primaryIntent: 'admin_probe', confidence: 0.99, entities };
    }

    // PRIORITY 2: Zero-Leakage Customer Privacy & Self-Data Guard (DIRECT SORRY - NEVER DISCLOSE ANY DATA)
    if (
      // Requesting someone else's data
      /(?:other|another|someone else'?s|list of|show me|give me|all|database).*?(?:email|customer|order|client|user|lead|record|phone|contact|data|number)/i.test(lower) ||
      /(?:user\s*details|customer\s*details|client\s*details|karan the dhaba ka (?:number|phone|email|data)|show users|users list|database dump|users details|lead list|all leads)/i.test(lower) ||
      /(?:who (?:else|all) has|kisi aur ka|dusre ka|dusro ka).*?(?:email|order|data|number|phone)/i.test(lower) ||
      // Requesting OWN data (Self-Data Probe: "what is my number", "mera number batao", "show my details")
      /(?:what\s*(?:is|was)\s*my\s*(?:number|phone|email|data|details|info)|show\s*my\s*(?:data|details|number|phone|email|info)|mera\s*(?:number|phone|email|data|details)\s*(?:kya|batao|dikhao|do)|meri\s*(?:details|jankari|information)\s*(?:batao|dikhao|do))/i.test(lower) ||
      /(?:tell\s*me\s*my\s*(?:number|phone|email|data|details)|kya\s*mera\s*data\s*(?:hai|milega))/i.test(lower)
    ) {
      return { primaryIntent: 'privacy_probe', confidence: 0.99, entities };
    }

    // PRIORITY 2.5: DPDP Act 2023 & Data Privacy Compliance Enquiry
    if (
      /(?:dpdp|dpdpa|data\s*protection\s*act|privacy\s*policy|data\s*privacy|data\s*protection|data\s*security|cookie|cookies|cookie\s*policy|cookie\s*permission|kya\s*(?:mera\s*)?data\s*safe\s*hai|kya\s*aap\s*data\s*share\s*karte|data\s*protection\s*policy)/i.test(lower)
    ) {
      return { primaryIntent: 'dpdp_compliance', confidence: 0.98, entities };
    }

    // PRIORITY 3: Out-of-Domain / Unknown Topics (Polite apology & ask contact details)
    if (
      /(?:weather|mausam|cricket|ipl|movie|film|song|recipe|khana kaise banaye|bitcoin|crypto|python|javascript|write code|who is the prime minister|modi|politics|stock market)/i.test(lower)
    ) {
      return { primaryIntent: 'unknown_topic', confidence: 0.95, entities };
    }

    // PRIORITY 4: Email Provided
    if (extractedEmail) {
      return {
        primaryIntent: 'email_provided',
        confidence: 0.98,
        entities,
      };
    }

    // PRIORITY 5: Mobile Number Provided (Handles 10-digit Indian formats & sentences)
    if (extractedPhone) {
      return {
        primaryIntent: 'phone_provided',
        confidence: 0.98,
        entities,
      };
    }

    // PRIORITY 6: Customer Name Provided
    if (entities.customerName && (
      context.lastQuestionAsked === 'customer_name' || 
      context.lastQuestionAsked === 'name' || 
      context.lastQuestionAsked === 'name_and_phone' ||
      context.lastQuestionAsked === 'phone' ||
      context.lastQuestionAsked === 'contact_info' ||
      !context.customerName
    )) {
      if (!/(?:price|pricing|cost|rate|margin|profit|order|track|login|portal|available|bottle|water|help|kaise|kya|kitne)/i.test(lower)) {
        return {
          primaryIntent: 'name_provided',
          confidence: 0.95,
          entities,
        };
      }
    }

    // PRIORITY 7: Business / Restaurant Name Provided in active lead context
    if (entities.businessName && (context.lastQuestionAsked === 'restaurant_name' || !entities.bottleSize)) {
      return {
        primaryIntent: 'business_name_provided',
        confidence: 0.92,
        entities,
      };
    }

    // PRIORITY 7: Dynamic Profit & Cost Calculation
    const isCalcQuery = /(?:kharcha|cost|profit|margin|bill|saving|calculate|monthly\s*bill|per\s*month)/i.test(lower);
    if (isCalcQuery && (qty || /\b\d+\b/.test(lower))) {
      const calcQty = qty || parseInt(lower.match(/\b\d+\b/)?.[0] || '200', 10);
      if (calcQty > 0) {
        entities.targetCalculation = {
          dailyQuantity: calcQty,
          bottleSize: entities.bottleSize || '500ml',
        };
        return { primaryIntent: 'profit_calculation', confidence: 0.95, entities };
      }
    }

    // PRIORITY 8: Quantity / Bulk Order Enquiry in Lead Context
    if (entities.estimatedQuantity && (context.lastQuestionAsked === 'quantity' || /(?:bottles|cases|daily|quantity|requirement)/i.test(lower))) {
      return {
        primaryIntent: 'bulk_order_enquiry',
        confidence: 0.90,
        entities,
      };
    }

    // PRIORITY 9: Login Assistance (Client /track portal ONLY)
    if (
      /(?:login|sign in|signin|log in|account|portal).*?(?:kaise|how|karein|karna|help|problem|password|access)/i.test(lower) ||
      /(?:kaise|how to).*?(?:login|sign in|portal)/i.test(lower) ||
      /^(?:login|sign in|signin)\s*$/i.test(lower)
    ) {
      return { primaryIntent: 'login_assistance', confidence: 0.95, entities };
    }

    // PRIORITY 10: Order Tracking
    if (
      /(?:track|order|status|kahan|where is|dispatch|consignment|vehicle).*?(?:kaise|how|karein|karna|my order|ord-hj)/i.test(lower) ||
      /\bord-hj-\d+\b/i.test(lower) ||
      /^(?:track|track order|order track)\s*$/i.test(lower)
    ) {
      return { primaryIntent: 'order_tracking', confidence: 0.95, entities };
    }

    // PRIORITY 11: Consultation Request
    if (
      /(?:please\s*contact|call\s*me|call\s*back|callback|contact\s*me|reach\s*out|baat\s*karni|phone\s*karo|schedule\s*a?\s*call|book\s*a?\s*call)/i.test(lower)
    ) {
      return { primaryIntent: 'consultation_request', confidence: 0.92, entities };
    }

    // PRIORITY 11.5: Product Availability & Sizing Enquiry (e.g. "ky aap ke pash 1liter ka bottle hai")
    const isProductAvailabilityQuery = 
      /(?:pash|pass|paas|available|uplabdh|mil\s*sakta|milegi|milega|hoti\s*hai|hai\s*kya|kya\s*hai|options|variants|types|sizes|dekhna\s*hai|show\s*me|do\s*you\s*have|which\s*bottles?|bottle\s*(?:hai|milegi|types?|options?)|kya\s*bottle|kaun\s*si\s*bottle)/i.test(lower);

    if (entities.bottleSize && isProductAvailabilityQuery) {
      return {
        primaryIntent: 'product_info',
        confidence: 0.95,
        entities,
      };
    }

    // PRIORITY 12: Pricing Enquiry
    const isQualityQuery = entities.specificTopic === 'tds_quality' || entities.specificTopic === 'shelf_life';
    if (
      !isQualityQuery &&
      /(?:price|pricing|rate|cost|margin|profit|wholesale|mrp|discount|paisa|quotation|quote|kitne\s*ka|kitne\s*ki|kitne\s*mein|kitna\s*padega|kitne\s*padenge|rate\s*kya|rates|\bkitne\b|\bkitna\b)/i.test(lower)
    ) {
      return { primaryIntent: 'pricing_enquiry', confidence: 0.88, entities };
    }

    // PRIORITY 10: Bottle Customization
    if (
      /(?:custom|customize|logo|name|naam|label|brand|theme|cap|dhakkan|color|design|studio|3d|qr|menu)/i.test(lower)
    ) {
      return { primaryIntent: 'bottle_customization', confidence: 0.87, entities };
    }

    // PRIORITY 11: Delivery & Coverage Enquiry
    if (
      /(?:deliver|delivery|supply|where|reach|transport|location|bihar|delhi|punjab|haryana|mumbai|jaipur|corridor|city)/i.test(lower)
    ) {
      return { primaryIntent: 'delivery_enquiry', confidence: 0.86, entities };
    }

    // PRIORITY 12: Business Enquiry (General)
    if (
      /(?:need|want|interested|chahiye|mangwana|bottles? for my|for our).*?(?:restaurant|dhaba|hotel|cafe|establishment|bottles)/i.test(lower)
    ) {
      return { primaryIntent: 'business_enquiry', confidence: 0.85, entities };
    }

    // PRIORITY 13: Greeting
    if (
      /^(?:hi|hello|namaste|hey|hola|good\s*morning|good\s*evening|kaise\s*ho)[!.?]*$/i.test(lower)
    ) {
      return { primaryIntent: 'greeting', confidence: 0.95, entities };
    }

    // PRIORITY 14: General Question / Fallback
    return {
      primaryIntent: 'general_question',
      confidence: 0.70,
      entities,
    };
  }
}

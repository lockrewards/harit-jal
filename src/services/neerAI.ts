import { 
  ChatMessage, 
  ConversationContext, 
  NeerLanguage, 
  NeerAction, 
  NeerSourceCitation,
  NeerAnalytics,
  NeerAIConfig
} from '../types/neer';
import { IntentDetector } from './intentDetector';
import { AutomationService } from './automationService';
import { KnowledgeBaseService } from './knowledgeBase';
import { CustomerAuthService } from './customerAuth';
import { StorageService } from './storage';
import { isSupabaseConfigured, SupabaseService } from './supabase';

const ANALYTICS_STORAGE_KEY = 'harit_jal_neer_analytics_v1';
const AI_CONFIG_KEY = 'harit_jal_neer_config_v1';

const DEFAULT_AI_CONFIG: NeerAIConfig = {
  provider: 'local',
  modelName: 'gemini-2.0-flash',
  temperature: 0.3,
  strictRAGOnly: false,
  allowGeneralQA: true,
};

export class NeerAIService {
  public static getAIConfig(): NeerAIConfig {
    try {
      const raw = localStorage.getItem(AI_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const clean: NeerAIConfig = {
          provider: parsed.provider === 'gemini' ? 'gemini' : 'local',
          modelName: typeof parsed.modelName === 'string' ? parsed.modelName : DEFAULT_AI_CONFIG.modelName,
          temperature: typeof parsed.temperature === 'number' ? parsed.temperature : DEFAULT_AI_CONFIG.temperature,
          strictRAGOnly: typeof parsed.strictRAGOnly === 'boolean' ? parsed.strictRAGOnly : DEFAULT_AI_CONFIG.strictRAGOnly,
          allowGeneralQA: typeof parsed.allowGeneralQA === 'boolean' ? parsed.allowGeneralQA : DEFAULT_AI_CONFIG.allowGeneralQA,
        };
        if ('geminiApiKey' in parsed) {
          localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(clean));
        }
        return clean;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_AI_CONFIG;
  }

  public static saveAIConfig(config: Partial<NeerAIConfig>): void {
    const current = this.getAIConfig();
    const updated: NeerAIConfig = {
      provider: config.provider === 'gemini' ? 'gemini' : current.provider,
      modelName: config.modelName ?? current.modelName,
      temperature: config.temperature ?? current.temperature,
      strictRAGOnly: config.strictRAGOnly ?? current.strictRAGOnly,
      allowGeneralQA: config.allowGeneralQA ?? current.allowGeneralQA,
    };
    if (config.provider === 'local') {
      updated.provider = 'local';
    }
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(updated));
  }

  public static getAnalytics(): NeerAnalytics {
    try {
      const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Fallback
    }
    return {
      totalSessions: 1,
      totalMessages: 0,
      frequentIntents: {
        pricing: 0,
        customization: 0,
        supply: 0,
        tracking: 0,
        compliance: 0,
        general: 0,
      },
      languageBreakdown: {
        english: 0,
        hindi: 0,
        hinglish: 0,
      },
      unansweredQueries: [],
      conversions: {
        studioClicks: 0,
        consultationClicks: 0,
        enquirySubmissions: 0,
        collectionsViewed: 0,
      },
    };
  }

  public static updateAnalytics(updater: (prev: NeerAnalytics) => NeerAnalytics): void {
    const current = this.getAnalytics();
    const updated = updater(current);
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(updated));
  }

  public static recordConversion(type: keyof NeerAnalytics['conversions']): void {
    this.updateAnalytics((prev) => ({
      ...prev,
      conversions: {
        ...prev.conversions,
        [type]: (prev.conversions[type] || 0) + 1,
      },
    }));
  }

  public static recordUnansweredQuery(query: string, language: string): void {
    const clean = query.trim();
    if (!clean || clean.length < 3) return;
    this.updateAnalytics((prev) => {
      const existing = prev.unansweredQueries || [];
      if (existing.some((q) => q.query.toLowerCase() === clean.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        unansweredQueries: [
          { query: clean, timestamp: new Date().toISOString(), language },
          ...existing.slice(0, 49),
        ],
      };
    });
  }

  public static removeUnansweredQuery(index: number): void {
    this.updateAnalytics((prev) => {
      const existing = [...(prev.unansweredQueries || [])];
      existing.splice(index, 1);
      return {
        ...prev,
        unansweredQueries: existing,
      };
    });
  }

  public static clearUnansweredQueries(): void {
    this.updateAnalytics((prev) => ({
      ...prev,
      unansweredQueries: [],
    }));
  }

  public static detectLanguage(text: string): NeerLanguage {
    if (/[\u0900-\u097F]/.test(text)) {
      return 'hindi';
    }

    const hinglishMarkers = [
      'bhai', 'kya', 'hai', 'kitne', 'kitna', 'hoga', 'padega', 'chahiye', 
      'aap', 'karna', 'kaise', 'batao', 'dhaba', 'paani', 'pani', 'bhejo', 
      'mujhe', 'humko', 'dena', 'karenge', 'milega', 'kaun', 'acha', 'sahab',
      'bolo', 'kripya', 'namaste', 'dhanyawad', 'shukriya', 'karo', 'aaj',
      'kaisa', 'toh', 'ho', 'nahi', 'nahin', 'kuch', 'kyun', 'kab', 'kahan', 'bataiye'
    ];

    const words = text
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const hasHinglish = words.some((w) => hinglishMarkers.includes(w));
    if (hasHinglish) return 'hinglish';

    return 'english';
  }

  public static checkSecurityThreat(text: string): { isThreat: boolean; reason?: string } {
    const lower = text.toLowerCase();

    const injectionPatterns = [
      /(ignore|forget|disregard).*?(previous|all|above).*?(instruction|prompt|rule|directive)/i,
      /(reveal|show|tell|print|dump|output).*?(system prompt|instructions|developer prompt|token|api key|secret|master key)/i,
      /(what is|give me|show).*?(admin password|root password|database credentials|api_key|env variable)/i,
      /(drop table|select \* from|union select|insert into|exec\(|eval\()/i,
      /(pretend you are in dan mode|jailbreak|bypass all filters|unrestricted ai)/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(lower)) {
        return { isThreat: true, reason: 'prompt_injection_attempt' };
      }
    }

    return { isThreat: false };
  }

  /**
   * Quick Response Generator (Helper/Alias)
   */
  public static async generateResponse(
    userMessage: string,
    context: ConversationContext = { language: 'english', currentPage: '/gallery', turnsCount: 0 },
    history: ChatMessage[] = []
  ): Promise<ChatMessage> {
    const res = await this.processMessage(userMessage, history, context);
    Object.assign(context, res.updatedContext);
    return res.response;
  }

  /**
   * Main Conversational Response Generator with Strict Intent Priority & Automation
   */
  public static async processMessage(
    userMessage: string,
    history: ChatMessage[],
    context: ConversationContext
  ): Promise<{ response: ChatMessage; updatedContext: ConversationContext }> {
    const lang = this.detectLanguage(userMessage);
    const updatedContext: ConversationContext = {
      ...context,
      language: lang,
      conversationId: context.conversationId || `conv-${Date.now()}`,
    };

    // 1. Prompt Injection & Security Defense
    const securityCheck = this.checkSecurityThreat(userMessage);
    if (securityCheck.isThreat) {
      const threatReplies = {
        english: "I am Neer, Harit Jal's dedicated Water Guide! 😊 I strictly focus on bespoke dining water bottles, custom restaurant branding, and supply logistics. How can I assist your establishment today?",
        hinglish: "Main Harit Jal ka water guide Neer hoon! 😊 Main sirf drinking water solutions, custom restaurant bottles aur supply logistics me help kar sakta hoon. Aapke dining establishment ke liye kya details chahiye?",
        hindi: "मैं हरित जल का जल साथी नीर हूँ! 😊 मैं विशेष रूप से रेस्तरां और होटलों के लिए ब्रांडेड पानी की बोतलों और सेवाओं में सहायता करता हूँ। मैं आपके प्रतिष्ठान के लिए क्या जानकारी प्रदान करूँ?",
      };

      return {
        response: {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: threatReplies[lang],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language: lang,
          suggestedActions: [
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'How It Works (Supply Process)', action: 'navigate', payload: '/how-it-works' },
            { label: 'Book a Consultation', action: 'book_call' },
          ],
        },
        updatedContext,
      };
    }

    // 2. Dedicated Intent Detection & Entity Extraction Layer
    const intentResult = IntentDetector.analyze(userMessage, updatedContext);
    const { primaryIntent, entities } = intentResult;

    // Merge discovered entities into context
    if (entities.email) updatedContext.userEmail = entities.email;
    if (entities.phone) updatedContext.phone = entities.phone;
    if (entities.bottleSize) updatedContext.preferredSize = entities.bottleSize;
    if (entities.bottleMaterial) updatedContext.preferredMaterial = entities.bottleMaterial;
    if (entities.businessCategory) updatedContext.businessType = entities.businessCategory;
    if (entities.businessName) updatedContext.restaurantName = entities.businessName;
    if (entities.estimatedQuantity) updatedContext.dailyVolume = entities.estimatedQuantity;
    if (entities.customerName) updatedContext.customerName = entities.customerName;

    // Track analytics
    this.updateAnalytics((prev) => ({
      ...prev,
      totalMessages: prev.totalMessages + 1,
      frequentIntents: {
        ...prev.frequentIntents,
        [primaryIntent]: (prev.frequentIntents[primaryIntent] || 0) + 1,
      },
      languageBreakdown: {
        ...prev.languageBreakdown,
        [lang]: (prev.languageBreakdown[lang] || 0) + 1,
      },
    }));

    // 3. Process Intents with Deterministic Business Automation
    const response = await this.routeIntent(
      userMessage,
      primaryIntent,
      entities,
      history,
      updatedContext
    );

    return { response, updatedContext };
  }

  /**
   * Deterministic Business Router
   */
  private static async routeIntent(
    userMessage: string,
    intent: string,
    entities: ReturnType<typeof IntentDetector.analyze>['entities'],
    history: ChatMessage[],
    context: ConversationContext
  ): Promise<ChatMessage> {
    const lang = context.language;
    const actions: NeerAction[] = [];
    let text = '';
    let citation: NeerSourceCitation | undefined = undefined;

    switch (intent) {
      // --- ADMIN PANEL RESTRICTION GUARD (NEVER DISCLOSED - DIRECT SORRY) ---
      case 'admin_probe':
        text = lang === 'hinglish' || lang === 'hindi'
          ? "Sorry! Main chat me kisi bhi customer ya admin ka data, internal records ya credentials share nahi kar sakta. Harit Jal ka administrative CRM strictly restricted hai aur chat interface par data access ya passwords share karna prohibited hai.\n\nAgar aap ek registered store partner hain, toh aap apne orders hamare secure Partner Portal (/track) par login karke dekh sakte hain."
          : "I am sorry! I cannot disclose any customer or administrative data, internal records, or credentials in the chat. Harit Jal's administrative system is strictly restricted and data access via this assistant is strictly prohibited.\n\nFor registered store partners, order tracking is securely accessible via the Partner Portal at /track.";
        actions.push(
          { label: 'Open Partner Portal (/track)', action: 'navigate', payload: '/track' },
          { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' }
        );
        break;

      // --- ZERO-LEAKAGE PRIVACY & USER / SELF-DATA PROBE (DIRECT SORRY) ---
      case 'privacy_probe':
        text = lang === 'hinglish'
          ? "Sorry! Harit Jal ki kadi zero-leakage privacy policy ke tehat, main chat window me kisi bhi customer ka data, phone number ya personal details share nahi kar sakta — chahe woh aapka khud ka data ho ya kisi aur ka.\n\nSabhi customer records hamare private backend me 100% encrypted aur surakshit hain. Aapke restaurant ke liye main custom bottles me kya sahayata kar sakta hoon?"
          : lang === 'hindi'
          ? "क्षमा करें! हरित जल की सख्त डेटा गोपनीयता नीति के तहत, मैं चैट में किसी भी ग्राहक का व्यक्तिगत डेटा, फोन नंबर या विवरण साझा नहीं कर सकता — चाहे वह आपका स्वयं का डेटा हो या किसी अन्य का। सभी विवरण सुरक्षित और एन्क्रिप्टेड हैं। मैं आपके रेस्तरां के लिए क्या सहायता कर सकता हूँ?"
          : "I am sorry! Under Harit Jal's strict zero-leakage privacy and confidentiality policy, customer contact records and personal details are never displayed or shared in the chat — whether it is your own data or another establishment's.\n\nAll records remain strictly encrypted in our private backend. How may I assist your dining room with bespoke water bottles?";
        actions.push(
          { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
          { label: 'Book Discovery Call', action: 'book_call' }
        );
        break;

      // --- DPDP ACT 2023 & DATA PRIVACY COMPLIANCE ---
      case 'dpdp_compliance':
        text = lang === 'hinglish'
          ? "Harit Jal Bharat ke **Digital Personal Data Protection Act, 2023 (DPDP Act 2023)** ka 100% kadi pabandi ke sath palan karta hai:\n\n" +
            "1. **Purpose Limitation:** Aapka contact data (Naam, Phone, Email, Location) sirf sample delivery, personalized label proofing aur logistics ke liye use hota hai.\n" +
            "2. **Zero Third-Party Sharing:** Hum kisi bhi restaurant ya customer ka data marketing agencies ya third-party ko na bechte hain aur na share karte hain.\n" +
            "3. **Bank-Grade Encryption:** Sabhi records AES-256 encryption ke sath private backend me surakshit hain.\n" +
            "4. **Data Principal Rights:** Aapko apne records ko access, update ya consent withdraw karne ka poora adhikar hai (Grievance Desk: info@haritjal.in)."
          : lang === 'hindi'
          ? "हरित जल भारत के **डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 (DPDP Act 2023)** का पूर्ण अनुपालन करता है:\n\n" +
            "1. **उद्देश्य सीमा (Purpose Limitation):** आपका संपर्क विवरण केवल मुफ़्त सैंपल डिलीवरी, लेबल प्रूफिंग और परामर्श के लिए उपयोग किया जाता है।\n" +
            "2. **शून्य तृतीय-पक्ष साझाकरण:** हम किसी भी ग्राहक का डेटा किसी मार्केटिंग एजेंसी या तीसरे पक्ष के साथ साझा या विक्रय नहीं करते हैं।\n" +
            "3. **AES-256 एन्क्रिप्शन:** सभी विवरण बैंक-स्तरीय सुरक्षा के साथ एन्क्रिप्टेड हैं।\n" +
            "4. **डेटा प्रधान अधिकार:** आपको अपने डेटा तक पहुँचने, संशोधन करने या सहमति वापस लेने का पूर्ण अधिकार है (ईमेल: info@haritjal.in)।"
          : "Harit Jal operates in full compliance with India's **Digital Personal Data Protection Act, 2023 (DPDP Act 2023)** as a responsible Data Fiduciary:\n\n" +
            "1. **Purpose Limitation:** Your details (establishment name, mobile number, email, address) are processed solely for sample dispatch, custom bottle proofing, and logistics scheduling.\n" +
            "2. **Zero Third-Party Resale:** We never sell, lease, or cross-share customer records with external advertisers or brokers.\n" +
            "3. **AES-256 Security:** All account records and design assets are encrypted with bank-grade security protocols.\n" +
            "4. **Data Principal Rights:** You hold the statutory right to access, rectify, or withdraw consent at any time via our Grievance Redressal Desk at info@haritjal.in.";
        actions.push(
          { label: 'View DPDP Compliance Hub', action: 'navigate', payload: '/compliance' },
          { label: 'Book a Consultation', action: 'book_call' },
          { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' }
        );
        break;

      // --- OUT OF SCOPE / UNKNOWN TOPIC (APOLOGIZE & ASK FOR CONTACT DETAILS) ---
      case 'unknown_topic':
        NeerAIService.recordUnansweredQuery(userMessage, lang);
        text = lang === 'hinglish'
          ? "Kshama karein, is vishay ki specific jankari mere paas filhal uplabdh nahi hai kyonki main packaged drinking water aur bespoke restaurant bottles me focused hoon.\n\nKripya apna **Naam** aur **Mobile Number** share karein, taaki hamari Harit Jal team aapse direct contact karke aapke sabhi sawalon ka sahi jawab aur poori sahayata de sake!"
          : lang === 'hindi'
          ? "क्षमा करें, इस विषय की सटीक जानकारी फिलहाल मेरे पास उपलब्ध नहीं है।\n\nकृपया अपना **नाम** और **मोबाइल नंबर** साझा करें, ताकि हमारी टीम आपसे सीधे संपर्क करके आपकी पूरी सहायता कर सके!"
          : "I apologize, I do not have this specific information available at the moment.\n\nPlease share your **Name** and **Mobile Number**, and our Harit Jal specialist team will get in touch with you directly to assist you with all your requirements!";
        context.lastQuestionAsked = 'name_and_phone';
        actions.push(
          { label: 'Request Callback', action: 'book_call' },
          { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
          { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
        );
        break;

      // --- DYNAMIC FINANCIAL INTELLIGENCE & PROFIT CALCULATION ---
      case 'profit_calculation':
        const calcQty = entities.targetCalculation?.dailyQuantity || entities.estimatedQuantity || 200;
        const calcSize = entities.bottleSize || context.preferredSize || '500ml';
        const isDhabaSize = calcSize === '1000ml';
        const isDecanter = calcSize === '750ml_glass';
        const isCafeSize = calcSize === '250ml';

        const unitCost = isCafeSize ? 7.0 : isDhabaSize ? 11.0 : isDecanter ? 24.0 : 14.0;
        const menuMRP = isCafeSize ? 20.0 : isDhabaSize ? 25.0 : isDecanter ? 70.0 : 40.0;
        
        const dailyCost = calcQty * unitCost;
        const monthlyCost = dailyCost * 30;
        const monthlyRevenue = calcQty * menuMRP * 30;
        const monthlyProfit = monthlyRevenue - monthlyCost;
        const marginPct = Math.round(((menuMRP - unitCost) / menuMRP) * 100);

        text = lang === 'hinglish' || lang === 'hindi'
          ? `Zaroor! Yahan aapka indicative financial estimate hai ${calcQty} bottles daily (${calcSize} format) ke liye:\n\n` +
            `• Daily Supply Cost (Indicative): ₹${dailyCost.toLocaleString('en-IN')} (${calcQty} × ₹${unitCost}/bottle)\n` +
            `• Monthly Investment (30 din): ₹${monthlyCost.toLocaleString('en-IN')}\n` +
            `• Expected Monthly Table Revenue (MRP ₹${menuMRP}): ₹${monthlyRevenue.toLocaleString('en-IN')}\n` +
            `• Net Monthly Restaurant Profit: ₹${monthlyProfit.toLocaleString('en-IN')} (Aapka gross profit margin: ~${marginPct}%)\n\n` +
            `*T&C Apply: Yeh anumaanit dar hai. Delivery aur logistics charges location aur distance ke anusar alag hoti hain (koi flat/fixed price ka wada nahi hai). Custom quote aur trial sample ke liye apna restaurant name aur location share karein!`
          : `Certainly! Here is your indicative financial breakdown for ${calcQty} bottles daily (${calcSize} format):\n\n` +
            `• Daily Supply Cost (Indicative): ₹${dailyCost.toLocaleString('en-IN')} (${calcQty} units @ ₹${unitCost}/bottle)\n` +
            `• Monthly Cellar Investment (30 days): ₹${monthlyCost.toLocaleString('en-IN')}\n` +
            `• Estimated Monthly Dining Sales (MRP ₹${menuMRP}): ₹${monthlyRevenue.toLocaleString('en-IN')}\n` +
            `• Net Monthly Establishment Profit: ₹${monthlyProfit.toLocaleString('en-IN')} (Gross Margin: ~${marginPct}%)\n\n` +
            `*T&C Apply: Rates are indicative wholesale estimates. Delivery and freight charges are billed separately and vary location-to-location based on transit distance and volume (no fixed flat price guarantee). Would you like to schedule trial samples for your tables?`;

        actions.push(
          { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
          { label: 'Book Discovery Call', action: 'book_call' },
          { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
        );
        break;

      // --- EMAIL PROVIDED: RECORD IMMEDIATELY & ASK FOR MANDATORY NAME + MOBILE ---
      case 'email_provided':
        const email = entities.email || context.userEmail!;
        context.userEmail = email;

        // Immediately save/update lead with email
        const partialLeadFromEmail = AutomationService.saveOrUpdateLead({
          conversationId: context.conversationId,
          email,
          phone: context.phone || 'Not provided',
          customerName: context.customerName || 'Valued Restaurant Partner',
          businessName: context.restaurantName || 'Pending Restaurant Name',
          sourcePage: 'Mascot (Neer AI Chat)',
          inquirySource: 'mascot',
          leadStatus: 'Incomplete',
          customerRequirements: 'Customer provided email address via Neer AI',
          conversationSummary: `Email captured: ${email}; awaiting Name and Mobile Number`,
        });
        context.currentLeadId = partialLeadFromEmail.id;

        // Check if both name and phone are already available in context
        const hasMobileAndName = !!(context.phone && context.customerName && context.customerName !== 'Valued Restaurant Partner');

        if (hasMobileAndName) {
          // Complete qualified lead! Persist to Supabase consultations first
          const consultationId = partialLeadFromEmail.id || `cons-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          let cloudSyncOk = true;
          if (isSupabaseConfigured()) {
            cloudSyncOk = await SupabaseService.syncConsultationLead({
              id: consultationId,
              restaurantName: context.restaurantName || 'Dining Establishment',
              ownerName: context.customerName || 'Valued Restaurant Partner',
              phone: context.phone!,
              email,
              city: context.location || 'India',
              preferredTime: 'Anytime (Neer AI Consultation)',
              bottleTypes: context.preferredSize ? [context.preferredSize] : [],
              notes: '[Source: Mascot (Neer AI Chat)] Qualified lead captured via Neer AI conversational flow',
              status: 'New',
            });
          }

          if (isSupabaseConfigured() && !cloudSyncOk) {
            return {
              id: `msg-${Date.now()}`,
              sender: 'assistant',
              text: lang === 'hinglish' || lang === 'hindi'
                ? `Dhanyawad **${context.customerName}** ji! Hamare cloud server par lead record karne me asuvidha hui hai. Kripya hamare helpline +91 62992 93497 par direct call karein.`
                : `Thank you **${context.customerName}**! We experienced a temporary issue saving your consultation to our cloud server. Please call our concierge directly at +91 62992 93497.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              language: lang,
              suggestedActions: [
                { label: 'Book a Consultation', action: 'book_call' },
                { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
              ],
            };
          }

          const mascotBooking1 = StorageService.addBooking({
            restaurantName: context.restaurantName || 'Dining Establishment',
            ownerName: context.customerName || 'Valued Restaurant Partner',
            phone: context.phone!,
            email,
            city: context.location || 'India',
            bottleSize: (context.preferredSize as any) || '500ml',
            bottleFormats: context.preferredSize ? [context.preferredSize] : ['500ml'],
            monthlyVolume: (context.dailyVolume || 100) * 30,
            capColor: 'royal_gold',
            labelStyle: 'classic_luxury',
            preferredDateTime: 'Anytime (Neer AI Consultation)',
            notes: '[Source: Mascot (Neer AI Chat)] Qualified lead captured via Neer AI conversational flow',
            source: 'mascot',
          });
          context.bookingId = mascotBooking1.id;

          const qualifiedLead = AutomationService.saveOrUpdateLead({
            id: consultationId,
            conversationId: context.conversationId,
            email,
            phone: context.phone,
            customerName: context.customerName,
            businessName: context.restaurantName || 'Dining Establishment',
            sourcePage: 'Mascot (Neer AI Chat)',
            inquirySource: 'mascot',
            leadStatus: 'New',
            conversationSummary: `Qualified lead with full contact details (Name, Phone, Email)`,
          });
          AutomationService.sendAdminNotification(qualifiedLead);
          AutomationService.sendCustomerConfirmation(qualifiedLead);
          this.recordConversion('enquirySubmissions');

          text = lang === 'hinglish' || lang === 'hindi'
            ? `Bahut bahut dhanyawad, **${context.customerName}** ji! 😊 Aapka email (**${email}**) aur mobile number (**${context.phone}**) surakshit roop se record ho gaya hai.\n\nHamari Harit Jal team aapse jald hi sampark karegi bespoke bottle samples aur quotation ke liye.\n\nAapke restaurant ya hotel ka kya naam hai?`
            : `Thank you, **${context.customerName}**! 😊 Your email (**${email}**) and mobile number (**${context.phone}**) have been securely recorded.\n\nOur hospitality team will connect with you shortly regarding bespoke bottle samples and pricing.\n\nWhat is your restaurant or hotel name?`;
          context.lastQuestionAsked = 'restaurant_name';
        } else {
          // Mandatory fields missing: Name & Mobile Number must be requested!
          context.lastQuestionAsked = 'name_and_phone';
          text = lang === 'hinglish'
            ? `Thank you! 😊 Aapka email address (**${email}**) receive ho gaya hai.\n\nAapki personalized bottle samples aur official quotation ke liye, kripya apna **Naam** aur **Mobile Number** share karein!`
            : lang === 'hindi'
            ? `धन्यवाद! 😊 आपका ईमेल पता (**${email}**) प्राप्त हो गया है।\n\nआपके प्रतिष्ठान के लिए सैंपल किट और कोटेशन तैयार करने हेतु, कृपया अपना **नाम** और **मोबाइल नंबर** साझा करें!`
            : `Thank you! 😊 I've received your email address: **${email}**.\n\nTo prepare your bespoke bottle sample presentation and quotation, could you please share your **Name** and **Mobile Number**?`;
        }

        actions.push(
          { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
          { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
        );
        break;

      // --- MOBILE NUMBER PROVIDED: RECORD & ASK FOR MANDATORY NAME ---
      case 'phone_provided':
        const phone = entities.phone || context.phone!;
        context.phone = phone;

        // If customer name was also in this message or in context
        const custName = entities.customerName || context.customerName;
        const hasValidName = !!(custName && custName !== 'Valued Restaurant Partner');

        if (hasValidName) {
          context.customerName = custName;
          // Both mandatory fields (Mobile Number + Name) are present!
          const consultationId = context.currentLeadId || `cons-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          let cloudSyncOk = true;
          if (isSupabaseConfigured()) {
            cloudSyncOk = await SupabaseService.syncConsultationLead({
              id: consultationId,
              restaurantName: context.restaurantName || 'Dining Establishment',
              ownerName: custName,
              phone,
              email: context.userEmail || 'inquiry@haritjal.in',
              city: context.location || 'India',
              preferredTime: 'Anytime (Neer AI Consultation)',
              bottleTypes: context.preferredSize ? [context.preferredSize] : [],
              notes: `[Source: Mascot (Neer AI Chat)] Mandatory contact details provided (Name: ${custName}, Phone: ${phone})`,
              status: 'New',
            });
          }

          if (isSupabaseConfigured() && !cloudSyncOk) {
            return {
              id: `msg-${Date.now()}`,
              sender: 'assistant',
              text: lang === 'hinglish' || lang === 'hindi'
                ? `Dhanyawad **${custName}** ji! Hamare cloud server par lead record karne me asuvidha hui hai. Kripya helpline +91 62992 93497 par sampark karein.`
                : `Thank you **${custName}**! We experienced a temporary issue saving your consultation to our cloud server. Please contact us directly at +91 62992 93497.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              language: lang,
              suggestedActions: [
                { label: 'Book a Consultation', action: 'book_call' },
                { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
              ],
            };
          }

          const mascotBooking2 = StorageService.addBooking({
            restaurantName: context.restaurantName || 'Dining Establishment',
            ownerName: custName,
            phone,
            email: context.userEmail || 'inquiry@haritjal.in',
            city: context.location || 'India',
            bottleSize: (context.preferredSize as any) || '500ml',
            bottleFormats: context.preferredSize ? [context.preferredSize] : ['500ml'],
            monthlyVolume: (context.dailyVolume || 100) * 30,
            capColor: 'royal_gold',
            labelStyle: 'classic_luxury',
            preferredDateTime: 'Anytime (Neer AI Consultation)',
            notes: `[Source: Mascot (Neer AI Chat)] Mandatory contact details provided (Name: ${custName}, Phone: ${phone})`,
            source: 'mascot',
          });
          context.bookingId = mascotBooking2.id;

          const lead = AutomationService.saveOrUpdateLead({
            id: consultationId,
            conversationId: context.conversationId,
            phone,
            customerName: custName,
            email: context.userEmail || 'Not provided',
            businessName: context.restaurantName || 'Dining Establishment',
            businessCategory: context.businessType || 'Restaurant',
            location: context.location || 'India',
            bottleSize: context.preferredSize || '500ml',
            bottleMaterial: context.preferredMaterial === 'glass' ? 'Flint Glass' : 'Recyclable rPET',
            estimatedQuantity: context.dailyVolume ? `${context.dailyVolume} bottles/day` : '200 bottles/day',
            customerRequirements: 'Customer provided mandatory contact details (Name + Phone) via Neer AI',
            conversationSummary: `Qualified lead captured: ${custName} (${phone})`,
            sourcePage: 'Mascot (Neer AI Chat)',
            inquirySource: 'mascot',
            leadStatus: 'New',
          });

          AutomationService.sendAdminNotification(lead);
          this.recordConversion('enquirySubmissions');
          context.currentLeadId = lead.id;
          context.leadStage = 'submitted';
          context.lastQuestionAsked = 'restaurant_name';

          text = lang === 'hinglish'
            ? `Bahut bahut dhanyawad, **${custName}** ji! 😊 Aapka mobile number (**${phone}**) aur naam surakshit roop se record kar liya gaya hai.\n\nHamari Harit Jal specialist team aapse jald hi direct call par connect karegi custom bottle samples aur pricing ke liye.\n\nAapke restaurant ya hotel ka kya naam hai?`
            : lang === 'hindi'
            ? `बहुत-बहुत धन्यवाद, **${custName}** जी! 😊 आपका मोबाइल नंबर (**${phone}**) और नाम सफलतापूर्वक दर्ज कर लिया गया है।\n\nहमारी टीम जल्द ही आपसे संपर्क करेगी। आपके रेस्तरां या होटल का क्या नाम है?`
            : `Thank you, **${custName}**! 😊 Your mobile number (**${phone}**) and name have been securely recorded.\n\nOur Harit Jal hospitality specialist will contact you shortly regarding custom bottle samples and cellar supply.\n\nCould you also share your restaurant or hotel's name?`;
        } else {
          // Mobile number captured, only NAME is needed!
          AutomationService.saveOrUpdateLead({
            conversationId: context.conversationId,
            phone,
            customerName: 'Valued Restaurant Partner',
            email: context.userEmail || 'Not provided',
            businessName: context.restaurantName || 'Pending Restaurant Name',
            sourcePage: 'Mascot (Neer AI Chat)',
            inquirySource: 'mascot',
            leadStatus: 'Incomplete',
            customerRequirements: 'Customer shared phone number via Neer AI',
            conversationSummary: `Phone number captured: ${phone}; awaiting Customer Name`,
          });

          context.lastQuestionAsked = 'customer_name';

          text = lang === 'hinglish'
            ? `Dhanyawad! 😊 Aapka mobile number (**${phone}**) receive ho gaya hai.\n\nKripya apna **Shubh Naam** batayein, taaki hamari hospitality team aapse sahi se connect kar sake aur sample kit dispatch kar sake!`
            : lang === 'hindi'
            ? `धन्यवाद! 😊 आपका मोबाइल नंबर (**${phone}**) प्राप्त हो गया है।\n\nकृपया अपना **शुभ नाम** बताएं, ताकि हमारी टीम आपसे संपर्क कर सके और सैंपल किट भेज सके!`
            : `Thank you! 😊 I've received your mobile number: **${phone}**.\n\nCould you please share your **Name** so our hospitality team knows who to address?`;
        }

        actions.push(
          { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
          { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
        );
        break;

      // --- CUSTOMER NAME PROVIDED: COMBINE WITH PHONE / EMAIL ---
      case 'name_provided':
        const nameProvided = entities.customerName || context.customerName || 'Valued Partner';
        context.customerName = nameProvided;

        if (context.phone && context.phone !== 'Not provided') {
          // Mobile number is already present! Both mandatory fields complete!
          const consultationId = context.currentLeadId || `cons-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          let cloudSyncOk = true;
          if (isSupabaseConfigured()) {
            cloudSyncOk = await SupabaseService.syncConsultationLead({
              id: consultationId,
              restaurantName: context.restaurantName || 'Dining Establishment',
              ownerName: nameProvided,
              phone: context.phone,
              email: context.userEmail || 'inquiry@haritjal.in',
              city: context.location || 'India',
              preferredTime: 'Anytime (Neer AI Consultation)',
              bottleTypes: context.preferredSize ? [context.preferredSize] : [],
              notes: `[Source: Mascot (Neer AI Chat)] Qualified lead captured: Name + Phone via Neer AI`,
              status: 'New',
            });
          }

          if (isSupabaseConfigured() && !cloudSyncOk) {
            return {
              id: `msg-${Date.now()}`,
              sender: 'assistant',
              text: lang === 'hinglish' || lang === 'hindi'
                ? `Dhanyawad **${nameProvided}** ji! Hamare cloud server par lead record karne me asuvidha hui hai. Kripya helpline +91 62992 93497 par call karein.`
                : `Thank you **${nameProvided}**! We experienced a temporary issue saving your consultation to our cloud server. Please call us at +91 62992 93497.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              language: lang,
              suggestedActions: [
                { label: 'Book a Consultation', action: 'book_call' },
                { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
              ],
            };
          }

          const mascotBooking3 = StorageService.addBooking({
            restaurantName: context.restaurantName || 'Dining Establishment',
            ownerName: nameProvided,
            phone: context.phone,
            email: context.userEmail || 'inquiry@haritjal.in',
            city: context.location || 'India',
            bottleSize: (context.preferredSize as any) || '500ml',
            bottleFormats: context.preferredSize ? [context.preferredSize] : ['500ml'],
            monthlyVolume: (context.dailyVolume || 100) * 30,
            capColor: 'royal_gold',
            labelStyle: 'classic_luxury',
            preferredDateTime: 'Anytime (Neer AI Consultation)',
            notes: `[Source: Mascot (Neer AI Chat)] Qualified lead captured: Name + Phone via Neer AI`,
            source: 'mascot',
          });
          context.bookingId = mascotBooking3.id;

          const lead = AutomationService.saveOrUpdateLead({
            id: consultationId,
            conversationId: context.conversationId,
            phone: context.phone,
            customerName: nameProvided,
            email: context.userEmail || 'Not provided',
            businessName: context.restaurantName || 'Dining Establishment',
            sourcePage: 'Mascot (Neer AI Chat)',
            inquirySource: 'mascot',
            leadStatus: 'New',
            conversationSummary: `Qualified lead captured: ${nameProvided} (${context.phone})`,
          });

          AutomationService.sendAdminNotification(lead);
          this.recordConversion('enquirySubmissions');
          context.currentLeadId = lead.id;
          context.lastQuestionAsked = 'restaurant_name';

          text = lang === 'hinglish'
            ? `Bahut bahut dhanyawad, **${nameProvided}** ji! 😊 Aapka mobile number (**${context.phone}**) aur naam record ho gaya hai.\n\nHamari Harit Jal team aapse jald hi direct call karke custom bottle designs aur complimentary table samples deliver karegi.\n\nAapke restaurant ya hotel ka kya naam hai?`
            : lang === 'hindi'
            ? `बहुत धन्यवाद, **${nameProvided}** जी! 😊 आपका मोबाइल नंबर (**${context.phone}**) और नाम दर्ज कर लिया गया है।\n\nहमारी टीम जल्द ही आपसे संपर्क करेगी। आपके रेस्तरां या होटल का क्या नाम है?`
            : `Thank you, **${nameProvided}**! 😊 Your contact details (Mobile: **${context.phone}**) have been securely recorded.\n\nOur hospitality team will connect with you directly to arrange complimentary table samples. What is the name of your restaurant or hotel?`;
        } else if (context.userEmail && context.userEmail !== 'Not provided') {
          // Email is present, but mobile number is mandatory!
          context.lastQuestionAsked = 'phone';
          text = lang === 'hinglish'
            ? `Aapse baat karke achha laga, **${nameProvided}** ji! 😊 Kripya apna **Mobile Number** bhi share karein, taaki hamari team sample delivery aur tracking update ke liye aapse direct sampark kar sake.`
            : lang === 'hindi'
            ? `आपसे बात करके अच्छा लगा, **${nameProvided}** जी! 😊 कृपया अपना **मोबाइल नंबर** भी साझा करें, ताकि हमारी टीम सीधे आपसे संपर्क कर सके।`
            : `Nice to meet you, **${nameProvided}**! 😊 Could you please share your **Mobile Number** as well so our team can follow up with sample tracking and direct delivery updates?`;
        } else {
          // Just name provided, need mobile number!
          context.lastQuestionAsked = 'phone';
          text = lang === 'hinglish'
            ? `Namaste, **${nameProvided}** ji! 😊 Harit Jal me aapka swagat hai. Kripya apna **Mobile Number** share karein, taaki hum aapke restaurant ke liye custom bottle samples arrange kar sakein.`
            : lang === 'hindi'
            ? `नमस्ते, **${nameProvided}** जी! 😊 हरित जल में आपका स्वागत है। कृपया अपना **मोबाइल नंबर** साझा करें, ताकि हम आपके रेस्तरां के लिए कस्टम बॉटल सैंपल तैयार कर सकें।`
            : `Welcome, **${nameProvided}**! 😊 Could you please share your **Mobile Number** so our team can arrange bespoke bottle samples for your tables?`;
        }

        actions.push(
          { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
          { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
        );
        break;

      // --- TEST 4: BUSINESS NAME PROVIDED ---
      case 'business_name_provided':
        const bizName = entities.businessName || context.restaurantName || 'your restaurant';
        context.restaurantName = bizName;

        if (context.currentLeadId) {
          AutomationService.saveOrUpdateLead({
            id: context.currentLeadId,
            businessName: bizName,
          });
        }
        if (context.bookingId) {
          StorageService.updateBookingDetails(context.bookingId, {
            restaurantName: bizName,
          });
        }

        if (!context.dailyVolume) {
          context.lastQuestionAsked = 'quantity';
          text = `Thanks! ${bizName} is noted. What is your approximate daily bottle requirement?`;
        } else if (!context.userEmail) {
          context.lastQuestionAsked = 'email';
          text = `Great! Could you share your email address so our team can follow up with verified quotation and sample delivery details for ${bizName}?`;
        } else {
          // Both business name and email present!
          return this.routeIntent(userMessage, 'email_provided', entities, history, context);
        }
        break;

      // --- TEST 5: BULK ORDER ENQUIRY / QUANTITY PROVIDED ---
      case 'bulk_order_enquiry':
        const quantity = entities.estimatedQuantity || context.dailyVolume || 200;
        context.dailyVolume = quantity;

        if (!context.restaurantName) {
          context.lastQuestionAsked = 'restaurant_name';
          text = `Got it, approximately ${quantity} bottles daily! What is the name of your restaurant, dhaba, or hotel?`;
        } else if (!context.userEmail) {
          context.lastQuestionAsked = 'email';
          text = `Got it, approximately ${quantity} bottles daily for ${context.restaurantName}! Could you share your email address so our team can follow up with quotation and sample delivery details?`;
        } else {
          return this.routeIntent(userMessage, 'email_provided', entities, history, context);
        }
        break;

      // --- TEST 3: BUSINESS ENQUIRY (e.g. "I want customized 500ml bottles") ---
      case 'business_enquiry':
        if (entities.bottleSize && !context.preferredMaterial) {
          context.lastQuestionAsked = 'material';
          text = `Certainly! We can customize ${entities.bottleSize} bottles with your brand name, logo and custom caps. Are you looking for crystal Flint Glass or food-grade recyclable rPET bottles?`;
          actions.push(
            { label: 'Flint Glass', action: 'query', payload: 'Glass' },
            { label: 'Recyclable rPET', action: 'query', payload: 'rPET' }
          );
        } else if (!context.restaurantName) {
          context.lastQuestionAsked = 'restaurant_name';
          text = `Wonderful! We craft bespoke branded bottles exclusively for dining tables. Could you share your restaurant or hotel's name?`;
        } else {
          context.lastQuestionAsked = 'quantity';
          text = `Perfect! What is your approximate daily bottle requirement for ${context.restaurantName}?`;
        }
        break;

      // --- TEST 6: CONSULTATION REQUEST ("Please contact me") ---
      case 'consultation_request':
        if (!context.userEmail && !context.phone) {
          context.lastQuestionAsked = 'contact_info';
          text = lang === 'hinglish'
            ? "Bilkul! Hamari hospitality team aapse connect karna chahegi. Kripya apna email address ya phone number share karein, sath hi apne restaurant ka naam aur city batayein."
            : "I'd be delighted to have our team connect with you! Could you please share your email address or phone number, along with your restaurant name?";
          actions.push(
            { label: 'Schedule a Consultation Call', action: 'book_call' },
            { label: 'Submit Online Enquiry', action: 'navigate', payload: '/contact' }
          );
        } else {
          text = `Thank you! Our hospitality team has your details on file (${context.userEmail || context.phone}). A specialist will reach out to discuss custom bottle samples and cellar supply schedules.`;
          actions.push({ label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' });
        }
        break;

      // --- TEST 7: LOGIN ASSISTANCE ("login kaise karu") ---
      case 'login_assistance':
        text = lang === 'hinglish' || lang === 'hindi'
          ? `Aap hamare Partner Portal (/track) par jaakar login kar sakte hain:\n\n1. Website ke top menu ya footer me 'Partner Portal & Tracking' par click karein (ya seedhe /track route open karein).\n2. Apna registered restaurant email aur password enter karein.\n3. Agar aapka account abhi tak nahi hai, toh wahi 'Create New Store Account' par click karke turant account bana sakte hain ya enquiry submit karne par account automatically create ho jata hai.\n\nNote: Security ke liye hum chat me kabhi password ya OTP nahi maangte.`
          : `You can access your account via our secure Partner Portal at /track:\n\n1. Navigate to the Partner Portal & Tracking link in the header or footer (or go directly to /track).\n2. Enter your registered establishment email address and password.\n3. If you do not have an account yet, click 'Create New Store Account' on that page or submit an inquiry to get auto-registered.\n\nSecurity Notice: For your protection, Neer never asks for passwords or OTPs in chat.`;
        actions.push(
          { label: 'Open Partner Portal (/track)', action: 'navigate', payload: '/track' },
          { label: 'Contact Support Desk', action: 'navigate', payload: '/contact' }
        );
        break;

      // --- ORDER TRACKING ---
      case 'order_tracking':
        const orderSnippet = userMessage.match(/ord-hj-\d+/i);
        if (orderSnippet) {
          const ordId = orderSnippet[0].toUpperCase();
          const found = CustomerAuthService.getOrderById(ordId);
          if (found) {
            text = `Found Order ${found.id} for ${found.restaurantName}!\n\n• Current Status: ${found.status}\n• Bottle Format: ${found.bottleSize} (${found.bottlesTotal} units)\n• Assigned Fleet: ${found.driverName || 'Regional Dispatch Truck'}\n• Dispatch Hotline: ${found.driverPhone || '+91 62992 93497'}\n• Estimated Delivery: ${found.expectedDelivery}`;
            actions.push({ label: 'Open Full Tracking Portal', action: 'navigate', payload: '/track' });
            break;
          }
        }

        text = lang === 'hinglish'
          ? `Aap apna live order track karne ke liye:\n\n1. Hamare Partner Portal (/track) par jaayein.\n2. Apna Order ID (format: ORD-HJ-xxxx) enter karein ya restaurant email se login karein.\n3. Wahan aapko 4-stage live tracking dikhegi: Order Confirmed ➔ Bottling & BIS Testing ➔ Dispatched (with truck vehicle number & driver phone) ➔ Delivered to Cellar.`
          : `You can track your live order anytime via our Partner Portal at /track:\n\n1. Visit the Partner Portal (/track).\n2. Enter your Order ID (format: ORD-HJ-xxxx) or log in with your restaurant email.\n3. You will see live 4-stage tracking: Order Confirmed ➔ Bottling & BIS Testing ➔ Dispatched (with assigned truck vehicle number and driver phone) ➔ Delivered to Cellar.`;
        actions.push(
          { label: 'Go to Order Tracking Portal', action: 'navigate', payload: '/track' },
          { label: 'Contact Dispatch Desk', action: 'navigate', payload: '/contact' }
        );
        break;

      // --- PRODUCT AVAILABILITY & SIZING INFORMATION ---
      case 'product_info':
        const targetBottleSize = entities.bottleSize || context.preferredSize;

        if (targetBottleSize === '1000ml') {
          text = lang === 'hinglish'
            ? `Haanji! Harit Jal ke paas **1000ml (1 Litre)** ke 2 popular options available hain:\n\n` +
              `1. **1000ml Heritage Dhaba & Family Bottle (Food-Grade Recyclable PET):**\n` +
              `   • Sturdy ergonomic ribbed grip, Forest Olive / Royal Gold tamper-evident cap.\n` +
              `   • Highway dhabas, family dining tables aur resorts ke liye sabse best format.\n` +
              `   • Wholesale rate: ₹11.00/bottle (Recommended menu MRP: ₹25.00–₹30.00, Margin: ~56%–63%).\n\n` +
              `2. **1000ml Vintage Heritage Arch (Heavy-Base Flint Glass):**\n` +
              `   • Heavy crystal glass base, luxury landscape crest aur polished brass gold cap.\n` +
              `   • Premium family feast tables aur luxury dining banquets ke liye exclusive format.\n` +
              `   • Wholesale rate: ₹18.00/bottle (Recommended menu MRP: ₹50.00, Margin: ~64%).\n\n` +
              `Dono formats me aapke restaurant ka **custom brand logo, Devanagari typography aur smart QR menu** print hota hai. Kya aap inka sample mangwana chahenge?`
            : lang === 'hindi'
            ? `हाँजी! हरित जल के पास **1000ml (1 लीटर)** के 2 प्रमुख विकल्प उपलब्ध हैं:\n\n` +
              `1. **1000ml हेरिटेज ढाबा फैमिली बॉटल (फूड-ग्रेड रीसाइक्लेबल PET):**\n` +
              `   • एर्गोनॉमिक रिब्ड ग्रिप, फॉरेस्ट ऑलिव / रॉयल गोल्ड कैप।\n` +
              `   • हाईवे ढाबों और फैमिली डाइनिंग के लिए सबसे लोकप्रिय।\n` +
              `   • थोक दर (Wholesale): ₹11.00/बॉटल (अनुशंसित मेनू MRP: ₹25.00–₹30.00)।\n\n` +
              `2. **1000ml विंटेज हेरिटेज आर्च (हैवी-बेस फ्लिंट ग्लास):**\n` +
              `   • क्रिस्टल ग्लास बेस और पॉलिश्ड ब्रास गोल्ड कैप।\n` +
              `   • प्रीमियम फैमिली टेबल्स के लिए विशेष स्वरूप।\n` +
              `   • थोक दर (Wholesale): ₹18.00/बॉटल (अनुशंसित मेनू MRP: ₹50.00)।\n\n` +
              `दोनों बोतलों पर आपके प्रतिष्ठान का लोगो व नाम प्रिंट होता है। क्या आप टेबल सैंपल मंगवाना चाहते हैं?`
            : `Yes, absolutely! Harit Jal offers two distinguished **1000ml (1 Litre)** bottle formats tailored for dining:\n\n` +
              `1. **1000ml Heritage Dhaba Family Bottle (Food-Grade Recyclable PET):**\n` +
              `   • Ergonomic ribbed grip with tamper-evident Forest Olive or Royal Gold cap.\n` +
              `   • Built for high-turnover highway dhabas, multi-cuisine family dining, and casual resorts.\n` +
              `   • Wholesale rate: ₹11.00/bottle (Recommended menu MRP: ₹25.00–₹30.00, Margin: ~56%–63%).\n\n` +
              `2. **1000ml Vintage Heritage Arch (Heavy-Base Flint Glass):**\n` +
              `   • Heavy-base flint glass cylinder with engraved crest and polished brass gold cap.\n` +
              `   • Crafted for luxury family banquets and upscale dining tables.\n` +
              `   • Wholesale rate: ₹18.00/bottle (Recommended menu MRP: ₹50.00, Margin: ~64%).\n\n` +
              `Both formats include 100% custom label printing with your establishment name, logo, and smart QR code. Would you like to view them in our Bottle Gallery or schedule a sample kit?`;

          actions.push(
            { label: 'View 1L Dhaba Bottle in Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'Request 1L Sample Kit', action: 'book_call' },
            { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
          );
        } else if (targetBottleSize === '750ml_glass') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Harit Jal ke paas **750ml** me hamara flagship **750ml Grand Reserve Decanter** (Heavy fluted crystal glass aur royal gold stopper cap) aur **750ml Grand Banquet Celebration Bottle** uplabdh hai. Yeh fine dining aur grand wedding ballrooms ke liye banaya gaya hai. Wholesale rate: ₹24.00, Recommended MRP: ₹70.00.`
            : `Harit Jal features the **750ml Grand Reserve Decanter** (fluted crystal glass with royal gold stopper) and **750ml Grand Banquet Celebration Bottle**, designed for palace dining and luxury wedding feasts. Wholesale rate: ₹24.00, Recommended MRP: ₹70.00.`;
          actions.push(
            { label: 'View 750ml in Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'Request Decanter Samples', action: 'book_call' }
          );
        } else if (targetBottleSize === '250ml') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Harit Jal ke paas **250ml** me hamara **250ml Artisanal Cafe Edition** aur **250ml Cafe Terra Frosted Mist** uplabdh hai. Yeh specialty cafes, patisseries aur quick dining ke liye perfect hai. Wholesale rate: ₹7.00–₹11.00, Recommended MRP: ₹20.00–₹30.00.`
            : `Harit Jal offers the **250ml Artisanal Cafe Edition** and **250ml Cafe Terra Frosted Mist**, designed for modern coffee bars and patisseries. Wholesale rate: ₹7.00–₹11.00, Recommended MRP: ₹20.00–₹30.00.`;
          actions.push(
            { label: 'View 250ml in Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'Request Cafe Samples', action: 'book_call' }
          );
        } else {
          // 500ml or general overview of all sizes
          text = lang === 'hinglish'
            ? `Harit Jal me dining establishments ke liye 4 standard bottle sizes uplabdh hain:\n\n` +
              `• **1000ml (1 Litre):** Heritage Dhaba PET (₹11.00) aur Vintage Estate Glass (₹18.00)\n` +
              `• **750ml Decanter:** Fluted Grand Reserve Crystal Glass (₹24.00)\n` +
              `• **500ml Dine-In:** Classic Flint Glass (₹14.00) aur Executive Hotel Cylinder (₹14.00)\n` +
              `• **250ml Cafe:** Artisanal rPET (₹7.00) aur Frosted Mist Glass (₹11.00)\n\n` +
              `Sabhi bottles par aapke restaurant ka custom logo aur branding hoti hai. Aap kaunsa size dekhna chahenge?`
            : `Harit Jal offers 4 dedicated hospitality bottle sizes:\n\n` +
              `• **1000ml (1 Litre):** Heritage Dhaba PET (₹11.00) & Vintage Estate Glass (₹18.00)\n` +
              `• **750ml Decanter:** Fluted Grand Reserve Crystal Glass (₹24.00)\n` +
              `• **500ml Dine-In:** Classic Flint Glass (₹14.00) & Executive Hotel Cylinder (₹14.00)\n` +
              `• **250ml Cafe:** Artisanal rPET (₹7.00) & Frosted Mist Glass (₹11.00)\n\n` +
              `All formats feature 100% bespoke branding with your establishment emblem. Which format would you like to explore?`;

          actions.push(
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'How It Works', action: 'navigate', payload: '/how-it-works' },
            { label: 'Book Discovery Call', action: 'book_call' }
          );
        }
        break;

      // --- TEST 8 & TARGETED PRICING ENQUIRY ---
      case 'pricing_enquiry':
        if (entities.specificTopic === 'moq') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Harit Jal me initial trial order minimum 10 se 25 cases (240 se 600 bottles for 500ml) se shuru ho sakta hai. Regular scheduled cellar replenishment ke liye standard dispatch batches 50 cases (1,200 bottles) hoti hain jo moisture-sealed crates me safe aati hain.`
            : `For initial establishment trials and label approval, our minimum order starts at just 10 to 25 cases (240 to 600 bottles for 500ml). Regular scheduled cellar replenishment batches are 50 cases (1,200 bottles), delivered securely in moisture-sealed crates.`;
          actions.push(
            { label: 'Schedule Trial Batch', action: 'book_call' },
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' }
          );
        } else if (entities.specificTopic === 'payment_terms') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Payment terms: First trial consignment advance ya Cash-on-Delivery (COD) par execute hota hai. Verified regular monthly restaurant partners ke liye 7 se 15 din ka weekly cellar billing cycle uplabdh rehta hai.`
            : `Payment terms: Initial trial consignments are executed on advance or Cash-on-Delivery (COD). Verified monthly restaurant accounts qualify for flexible 7 to 15-day weekly cellar credit billing cycles.`;
          actions.push(
            { label: 'Book Partner Consultation', action: 'book_call' },
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' }
          );
        } else if (entities.specificTopic === 'sample_kit') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Haanji! Verified restaurant aur hotel owners ke liye hum complimentary physical sample testing kit provide karte hain. Aap table par bottle ki crystal clarity, label finish aur cold condensation khud test kar sakte hain. 'Book Discovery Call' click karke sample request karein!`
            : `Yes, absolutely! We provide complimentary physical sample presentation sets to restaurant and hotel owners so you can examine the crystal flint glass, label typography, and chilled condensation on your dining tables. Click 'Book Discovery Call' to request your sample kit!`;
          actions.push(
            { label: 'Request Free Sample Kit', action: 'book_call' },
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' }
          );
        } else if (entities.bottleSize === '250ml') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `250ml Artisanal Cafe Edition ka verified wholesale rate ₹7.00 per bottle hai (Recommended menu MRP: ₹20.00). Restaurant profit margin ~65% rehta hai. Yeh compact single-serve format specialty cafes, bakeries aur quick dining tables ke liye ideal hai.`
            : `The 250ml Artisanal Cafe Edition is priced at ₹7.00 wholesale per bottle (Recommended menu MRP: ₹20.00). It delivers an attractive ~65% table profit margin and is tailored for specialty coffee houses, patisseries, and quick service dining.`;
          actions.push(
            { label: 'View 250ml in Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'Request 250ml Samples', action: 'book_call' }
          );
        } else if (entities.bottleSize === '750ml_glass') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `750ml Grand Reserve Decanter ka verified wholesale rate ₹24.00 per bottle hai (Recommended menu MRP: ₹70.00). Table margin ~66% rehta hai. Heavy fluted crystal glass aur royal gold cap VIP banquet tables aur fine dining banquet halls ke liye opulent feel deta hai.`
            : `The 750ml Grand Reserve Decanter is priced at ₹24.00 wholesale per bottle (Recommended menu MRP: ₹70.00), delivering a ~66% table margin. Sculpted with heavy fluted glass and royal gold cap, it is crafted for luxury palace dining and grand banquet feasts.`;
          actions.push(
            { label: 'View 750ml Decanter in Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
          );
        } else if (entities.bottleSize === '1000ml') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `1000ml Highway Dhaba Edition ka verified wholesale rate ₹11.00 per bottle hai (Recommended menu MRP: ₹25.00). Table margin ~56% rehta hai. Iska ergonomic ribbed grip aur sturdy food-grade rPET body high-turnover family dining tables aur dhabas ke liye perfect hai.`
            : `The 1000ml Highway Dhaba Edition is priced at ₹11.00 wholesale per bottle (Recommended menu MRP: ₹25.00), giving a ~56% margin. Engineered with an ergonomic ribbed grip and sturdy recyclable rPET body, it is built for high-turnover highway dhabas and family feasts.`;
          actions.push(
            { label: 'View Dhaba Bottle in Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'Schedule Supply Call', action: 'book_call' }
          );
        } else {
          // Standard full verified tariff breakdown (compatible with TEST 8)
          text = lang === 'hinglish'
            ? `Harit Jal ki indicative wholesale pricing ₹7.00 se ₹24.00 per bottle ke beech hoti hai:\n\n• 250ml rPET: ~₹7.00 wholesale (Menu MRP ₹20)\n• 500ml Classic Glass: ~₹14.00 wholesale (Menu MRP ₹40)\n• 750ml Grand Decanter: ~₹24.00 wholesale (Menu MRP ₹70)\n• 1000ml Highway Dhaba: ~₹11.00 wholesale (Menu MRP ₹25)\n\n*T&C Apply: Yeh dar anumaanit benchmark hain. Delivery aur freight charges alag hain aur location/transit distance ke anusar vary karte hain (koi flat/fixed price ka wada nahi hai). Isse restaurant ko per table 60% se 70% margin milta hai. Apni city ke liye custom quotation aur free samples ke liye apna restaurant name share karein!`
            : `Harit Jal wholesale benchmarks range between ₹7.00 to ₹24.00 per bottle depending on bottle size and material:\n\n• 250ml rPET: ~₹7.00 wholesale (Menu MRP ₹20)\n• 500ml Classic Glass: ~₹14.00 wholesale (Menu MRP ₹40)\n• 750ml Grand Decanter: ~₹24.00 wholesale (Menu MRP ₹70)\n• 1000ml Highway Dhaba: ~₹11.00 wholesale (Menu MRP ₹25)\n\n*T&C Apply: Displayed rates are indicative estimates. Delivery and freight charges are billed separately and vary location-to-location based on transit distance and volume (no flat fixed price guarantee). For an exact landed quotation tailored to your restaurant turnover and route, please share your establishment name and daily requirement.`;
          actions.push(
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'Request Free Samples', action: 'book_call' },
            { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
          );
        }
        break;

      // --- TARGETED BOTTLE CUSTOMIZATION ---
      case 'bottle_customization':
        if (entities.bottleSize && !context.preferredMaterial) {
          context.preferredSize = entities.bottleSize;
          context.lastQuestionAsked = 'material';
          text = `Certainly! We can customize ${entities.bottleSize} bottles with your establishment's name, logo, and signature caps. Do you prefer crystal Flint Glass or food-grade recyclable rPET bottles?`;
          actions.push(
            { label: 'Flint Glass', action: 'query', payload: 'Glass' },
            { label: 'Recyclable rPET', action: 'query', payload: 'rPET' }
          );
          break;
        }

        if (entities.specificTopic === 'cap_colors') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Harit Jal me 4 Signature Metallic Cap finishes milti hain:\n\n1. Polished Champagne Gold (Luxurious fine dining)\n2. Forest Olive Green (Organic heritage dining & dhabas)\n3. Deep Royal Navy (Executive suites & modern bistros)\n4. Soft Pearl Cream (Artisanal cafes & patisseries)\n\nSabhi caps food-safe tamper-evident safety seal ke sath aati hain.`
            : `Harit Jal offers 4 Signature Metallic Cap finishes:\n\n1. Polished Champagne Gold (Fine dining & banquets)\n2. Forest Olive Green (Heritage dining & highway dhabas)\n3. Deep Royal Navy (Executive suites & modern bistros)\n4. Soft Pearl Cream (Artisanal cafes & boutique tables)\n\nEach cap includes a high-barrier tamper-evident security seal to preserve pristine taste.`;
          actions.push(
            { label: 'View Bottles in Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
          );
        } else if (entities.specificTopic === 'qr_code') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Haanji! Har bottle ke label par hum ek custom high-definition Smart QR Code print karte hain. Dining guests jab ise apne mobile phone se scan karte hain, toh aapka live digital food menu, banquet booking page ya Google review link turant open ho jata hai.`
            : `Yes! Every custom label can incorporate a high-resolution Smart QR Code. When guests at your tables scan the bottle with their phone, it instantly opens your live digital food menu, wine pairing guide, or Google review page.`;
          actions.push(
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'Book Discovery Consultation', action: 'book_call' }
          );
        } else {
          text = lang === 'hinglish'
            ? `Harit Jal me hum 100% bespoke branding karte hain:\n\n• Aapke restaurant ka logo aur custom typography high-definition print hota hai.\n• 4 Signature Metallic Caps: Champagne Gold, Forest Olive, Royal Navy, aur Soft Cream.\n• Smart QR Code: Bottle scan karke mehman aapka live digital menu ya Google reviews dekh sakte hain.\n\nAap hamari Bottle Gallery me sabhi exclusive designs dekh sakte hain aur physical sample book kar sakte hain!`
            : `Every Harit Jal bottle is crafted exclusively for your dining room:\n\n• High-definition label printing featuring your establishment emblem, bespoke typography, and contact info.\n• Tamper-evident metallic caps in Polished Champagne Gold, Forest Olive, Royal Navy, or Soft Cream.\n• Smart QR Menu integration allowing guests to view your live digital menu.\n\nYou can explore all exclusive bottle designs in our Bottle Gallery and order physical sample bottles!`;
          actions.push(
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'How It Works', action: 'navigate', payload: '/how-it-works' },
            { label: 'Book Consultation Call', action: 'book_call' }
          );
        }
        break;

      // --- TARGETED DELIVERY & LOCATION ENQUIRY ---
      case 'delivery_enquiry':
        const lowerMsg = userMessage.toLowerCase();
        if (entities.specificTopic === 'bottle_return') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Haanji! Hamare CPCB Extended Producer Responsibility (EPR) circular recycling program ke tehat, empty used crates agle weekly replenishment truck ke sath collect ho jati hain aur buy-back credit aapke agle billing cycle me adjust ho jata hai.`
            : `Yes! Under our certified CPCB Extended Producer Responsibility (EPR) circular program, empty used bottles and crates are collected during weekly replenishment visits, and buy-back credits are adjusted directly on your monthly invoice.`;
          actions.push(
            { label: 'Explore Supply Journey', action: 'navigate', payload: '/how-it-works' },
            { label: 'Schedule Cellar Pickup', action: 'book_call' }
          );
        } else if (/bihar|patna|gaya|muzaffarpur|bettiah|banuchhapar/i.test(lowerMsg)) {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Haanji! Harit Jal ka registered hub Banuchhapar, Bettiah, Bihar me sthit hai, aur hum pure Bihar highway circuits (Bettiah, Patna, Gaya, Muzaffarpur, Bhagalpur) me direct restaurant delivery supply karte hain. Hamari dedicated fleet high-density routes par scheduled truck delivery karti hai. Aapka restaurant kaunsi city me hai aur daily kitni requirement hogi?`
            : `Yes, absolutely! Harit Jal is headquartered in Banuchhapar, Bettiah, Bihar, and operates dedicated supply logistics along Bihar highway corridors, servicing restaurants and hotels across Bettiah, Patna, Gaya, Muzaffarpur, and regional dining circuits on predictable weekly schedules. Which city is your establishment in, and what is your daily volume?`;
          actions.push(
            { label: 'Schedule Bihar Cellar Supply', action: 'book_call' },
            { label: 'Explore Supply Roadmap', action: 'navigate', payload: '/how-it-works' }
          );
        } else if (/murthal|gt\s*karnal|gt\s*road|delhi|ncr|gurgaon|noida/i.test(lowerMsg)) {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Delhi NCR aur GT Karnal Road / Murthal corridor hamara flagship express supply route hai! Yahan restaurant cellars ko 24 ghante ke andar direct automated truck delivery aur regular weekly replenishment milti hai.`
            : `Delhi NCR and the GT Karnal Road / Murthal corridor is our flagship express route! Partner establishments receive 24-hour rapid replenishment directly to their cellar floor with dedicated delivery drivers.`;
          actions.push(
            { label: 'Schedule Murthal/NCR Supply', action: 'book_call' },
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' }
          );
        } else {
          text = lang === 'hinglish'
            ? `Haanji! Harit Jal pan-India delivery provide karta hai. Hamari dedicated fleet high-density hospitality routes jaise Delhi NCR, GT Karnal Road (Murthal), Haryana, Punjab, Jaipur, Lucknow, aur Bihar highway circuits par direct restaurant cellar delivery karti hai.\n\nAapka restaurant kaunsi city me hai aur daily kitni bottles ki requirement hogi?`
            : `Yes, certainly! Harit Jal supplies pan-India with dedicated express regional fleets serving major corridors: Delhi NCR, GT Karnal Road / Murthal, Haryana, Punjab, Rajasthan, UP, and Bihar circuits.\n\nConsignments are delivered directly to your cellar on predictable weekly schedules. In which city is your establishment located, and what is your estimated daily volume?`;
          actions.push(
            { label: 'Explore 6-Stage Supply Journey', action: 'navigate', payload: '/how-it-works' },
            { label: 'Schedule Cellar Supply Call', action: 'book_call' }
          );
        }
        break;

      // --- TEST 1: GREETING ---
      case 'greeting':
        text = lang === 'hinglish'
          ? `Namaste! Main Neer hoon 💧 Harit Jal ka AI Water Guide. Hum restaurants aur hotels ke naam se bespoke packaged drinking water bottles craft karte hain. Main aapke dining establishment ke liye kya help kar sakta hoon?`
          : lang === 'hindi'
          ? `नमस्ते! मैं नीर हूँ 💧 हरित जल का जल साथी। हम आपके रेस्तरां या होटल के गर्वित नाम से ब्रांडेड पानी की बोतलें तैयार करते हैं। क्या आप कांच की या आर-पैट बोतलें देखना चाहेंगे?`
          : `Namaste and welcome! I am Neer 💧 Harit Jal's AI Water Guide. We craft bespoke packaged drinking water bottles exclusively branded in your restaurant or hotel's name. How can I assist your establishment today?`;
        actions.push(
          { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
          { label: 'How It Works (Supply Process)', action: 'navigate', payload: '/how-it-works' },
          { label: 'Book a Consultation Call', action: 'book_call' }
        );
        break;

      // --- GENERAL QUESTION / INTENT-DRIVEN RAG RETRIEVAL ---
      default:
        // Sizing Intent Defense: If bottle size is detected, directly route to product_info!
        if (entities.bottleSize) {
          return this.routeIntent(userMessage, 'product_info', entities, history, context);
        }

        // 1. Direct handler for Specific Technical & Quality Topics
        if (entities.specificTopic === 'shelf_life') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Harit Jal packaged drinking water ki certified shelf life bottling date se 12 mahine (1 year) hoti hai. Har bottle ke tamper-evident cap par FSSAI aur BIS IS:14543 norms ke anusaar manufacturing date, batch number aur best before timeline clearly laser-printed hoti hai.`
            : `Harit Jal packaged drinking water has a certified shelf life of 12 months from the bottling date when stored in clean, cool cellar conditions. Every tamper-evident cap displays laser-printed manufacturing dates, batch codes, and best before dates per BIS IS:14543 regulations.`;
          actions.push(
            { label: 'View Quality Certifications', action: 'navigate', payload: '/compliance' },
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' }
          );
          break;
        }

        if (entities.specificTopic === 'tds_quality') {
          text = lang === 'hinglish' || lang === 'hindi'
            ? `Harit Jal ka TDS 80 se 120 ppm ke beech perfectly balanced rehta hai. Iska neutral pH aur essential calcium-magnesium remineralization palate ko clean rakhta hai, jisse fine dining curries, wines aur coffees ka original taste bilkul affect nahi hota. 8-stage multi-barrier purification me dual RO, UV aur ozonation shamil hai.`
            : `Harit Jal water is formulated with a balanced 80–120 ppm TDS and neutral pH, enriched with essential calcium and magnesium for crisp palate neutrality. This ensures guest dining experiences, fine wines, and specialty coffees retain their unadulterated flavors. Purified through an 8-stage multi-barrier process (Dual RO, UV, ozonation).`;
          actions.push(
            { label: 'Read BIS & FSSAI Standards', action: 'navigate', payload: '/compliance' },
            { label: 'Request Tasting Sample Kit', action: 'book_call' }
          );
          break;
        }

        // 2. High-precision semantic knowledge base lookup
        const ragResults = KnowledgeBaseService.searchKnowledge(userMessage, 2);
        if (ragResults.length > 0 && ragResults[0].score >= 4) {
          const top = ragResults[0].item;
          text = lang === 'hinglish' || lang === 'hindi'
            ? `${top.content}\n\nAapke restaurant ya hotel ke liye is vishay par aur kya jankari chahiye?`
            : `${top.content}\n\nWould you like more details regarding this for your establishment, or shall we arrange sample bottles for your dining tables?`;
          citation = {
            title: top.title,
            sourceType: top.category === 'compliance' ? 'regulatory' : 'website',
            verifiedDate: top.lastUpdated,
          };
          actions.push(
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'How It Works', action: 'navigate', payload: '/how-it-works' },
            { label: 'Book Discovery Call', action: 'book_call' }
          );
        } else {
          // Out of Knowledge / Unknown Query: Log for continuous learning & training!
          NeerAIService.recordUnansweredQuery(userMessage, lang);

          text = lang === 'hinglish'
            ? `Kshama karein, is sawal ki specific jankari mere paas filhal uplabdh nahi hai kyonki main packaged drinking water aur bespoke restaurant bottles me focused hoon.\n\nKripya apna **Naam** aur **Mobile Number** share karein, taaki hamari Harit Jal specialist team aapse direct sampark karke aapke sawalon ka sahi jawab aur poori sahayata de sake!`
            : lang === 'hindi'
            ? `क्षमा करें, इस विषय की सटीक जानकारी फिलहाल मेरे पास उपलब्ध नहीं है।\n\nकृपया अपना **नाम** और **मोबाइल नंबर** साझा करें, ताकि हमारी टीम आपसे सीधे संपर्क करके आपकी पूरी सहायता कर सके!`
            : `I apologize, I do not have this specific information available at the moment.\n\nPlease share your **Name** and **Mobile Number**, and our Harit Jal specialist team will get in touch with you directly to assist you with all your requirements!`;

          context.lastQuestionAsked = 'name_and_phone';
          actions.push(
            { label: 'Request Call Back', action: 'book_call' },
            { label: 'Explore Bottle Gallery', action: 'open_gallery', payload: '/gallery' },
            { label: 'How It Works', action: 'navigate', payload: '/how-it-works' }
          );
        }
        break;
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: lang,
      suggestedActions: actions,
      sourceCitation: citation,
      intent,
      entitiesExtracted: entities,
    };
  }
}

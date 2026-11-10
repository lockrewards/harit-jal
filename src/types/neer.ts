export type NeerLanguage = 'english' | 'hindi' | 'hinglish';

export interface NeerAction {
  label: string;
  action: 'navigate' | 'book_call' | 'open_studio' | 'open_gallery' | 'query';
  payload?: string;
}

export interface NeerSourceCitation {
  title: string;
  sourceType: 'website' | 'regulatory' | 'external';
  url?: string;
  verifiedDate?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  language?: NeerLanguage;
  suggestedActions?: NeerAction[];
  sourceCitation?: NeerSourceCitation;
  isThinking?: boolean;
  intent?: string;
  entitiesExtracted?: Record<string, any>;
}

export interface ConversationContext {
  conversationId?: string;
  language: NeerLanguage;
  customerName?: string;
  restaurantName?: string;
  businessType?: 'restaurant' | 'dhaba' | 'cafe' | 'hotel' | 'banquet' | 'other';
  phone?: string;
  preferredMaterial?: 'glass' | 'rpet' | 'frosted';
  preferredSize?: '250ml' | '500ml' | '750ml_glass' | '1000ml';
  dailyVolume?: number;
  location?: string;
  currentPage: string;
  viewedProductId?: string;
  userAuthenticated?: boolean;
  userEmail?: string;
  currentLeadId?: string;
  bookingId?: string;
  leadStage?: 'initial' | 'requirements_gathered' | 'awaiting_contact' | 'submitted';
  enquiryNotes?: string[];
  lastQuestionAsked?: string;
  turnsCount?: number;
}

export type NeerIntentType =
  | 'greeting'
  | 'email_provided'
  | 'phone_provided'
  | 'name_provided'
  | 'business_name_provided'
  | 'business_enquiry'
  | 'pricing_enquiry'
  | 'product_info'
  | 'bottle_customization'
  | 'bulk_order_enquiry'
  | 'delivery_enquiry'
  | 'login_assistance'
  | 'order_tracking'
  | 'consultation_request'
  | 'general_question'
  | 'complaint_support'
  | 'human_assistance'
  | 'follow_up_message'
  | 'enquiry_submission'
  | 'privacy_probe'
  | 'admin_probe'
  | 'dpdp_compliance'
  | 'profit_calculation'
  | 'unknown_topic';

export interface ExtractedEntities {
  customerName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  businessCategory?: 'restaurant' | 'dhaba' | 'cafe' | 'hotel' | 'banquet' | 'other';
  location?: string;
  bottleMaterial?: 'glass' | 'rpet' | 'frosted';
  bottleSize?: '250ml' | '500ml' | '750ml_glass' | '1000ml';
  estimatedQuantity?: number;
  customerRequirements?: string;
  specificTopic?: string;
  targetCalculation?: {
    dailyQuantity: number;
    bottleSize?: string;
  };
}

export interface IntentResult {
  primaryIntent: NeerIntentType;
  secondaryIntents?: NeerIntentType[];
  confidence: number;
  entities: ExtractedEntities;
}

export interface LeadRecord {
  id: string; // e.g., LEAD-HJ-1042
  conversationId: string;
  createdDate: string;
  customerName: string;
  email: string;
  phone: string;
  businessName: string;
  businessCategory: string;
  location: string;
  bottleSize: string;
  bottleMaterial: string;
  estimatedQuantity: string;
  customerRequirements: string;
  conversationSummary: string;
  sourcePage: string;
  inquirySource?: 'website_form' | 'mascot' | 'contact_page';
  leadStatus: 'New' | 'Incomplete' | 'Contacted' | 'Closed';
  adminNotificationStatus: 'Sent' | 'Pending' | 'Failed';
  customerConfirmationStatus: 'Sent' | 'Skipped' | 'Pending' | 'Failed';
  googleSheetsStatus: 'Synced' | 'Pending' | 'Failed';
  lastUpdated: string;
}

export interface KnowledgeItem {
  id: string;
  category: 'product' | 'pricing' | 'compliance' | 'supply' | 'customization' | 'general' | 'faq' | 'regulatory';
  title: string;
  keywords: string[];
  content: string;
  source: string;
  verified: boolean;
  lastUpdated: string;
  requiresVerification?: boolean;
}

export interface NeerAnalytics {
  totalSessions: number;
  totalMessages: number;
  frequentIntents: Record<string, number>;
  languageBreakdown: Record<NeerLanguage, number>;
  unansweredQueries: { query: string; timestamp: string; language: string }[];
  conversions: {
    studioClicks: number;
    consultationClicks: number;
    enquirySubmissions: number;
    collectionsViewed: number;
  };
}

export interface NeerAIConfig {
  provider: 'local' | 'gemini';
  modelName: string;
  temperature: number;
  strictRAGOnly: boolean;
  allowGeneralQA: boolean;
}

export interface AutomationConfig {
  adminEmail: string;
  googleSheetsSpreadsheetId: string;
  googleSheetsAutoSync: boolean;
  emailFromAddress?: string;
  lastSheetsSyncTime?: string;
}

export interface CallBooking {
  id: string;
  restaurantName: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
  bottleSize: '250ml' | '500ml' | '750ml_glass' | '1000ml';
  bottleFormats?: string[];
  monthlyVolume: number; // in bottles
  capColor: string;
  labelStyle: string;
  preferredDateTime: string;
  notes?: string;
  status: 'New' | 'Call Scheduled' | 'Sample Dispatched' | 'Active Client' | 'Follow Up';
  assignedTo: string;
  createdAt: string;
  syncedToGoogleSheets: boolean;
  adminApproved?: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

export interface VisitorRecord {
  visitorId: string;
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  pagesViewed: string[];
  associatedEmail?: string;
  associatedRestaurant?: string;
  isRegular: boolean;
  device: string;
  city: string;
  lastActive: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  role: 'Super Admin' | 'Sales Manager' | 'Operations Lead' | 'Label Designer' | 'Staff';
  permissions?: string[];
  status: 'Active' | 'Blocked' | 'On Leave';
  inquiriesAssigned: number;
  isFirstLogin?: boolean;
  temporaryPassword?: string;
  totpSecret?: string;
  totpEnabled?: boolean;
  emailPhoneChangesCount?: number;
  createdAt?: string;
}

export interface GoogleSheetsConfig {
  sheetId: string;
  sheetName: string;
  webhookUrl: string;
  autoSync: boolean;
  lastSyncTime?: string;
}

export interface BottleMockupConfig {
  brandName: string;
  tagline: string;
  bottleSize: '250ml' | '500ml' | '750ml_glass' | '1000ml';
  bottleMaterial: 'pet_clear' | 'pet_tinted' | 'luxury_glass' | 'frosted_matte';
  capColor: 'deep_blue' | 'emerald_green' | 'royal_gold' | 'pearl_white' | 'midnight_black';
  labelTheme: 'classic_luxury' | 'dhaba_heritage' | 'bistro_minimal' | 'regal_crest';
  customLogoUrl?: string;
  phoneOrContact?: string;
}

export interface CustomerAccount {
  id: string;
  restaurantName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  password?: string;
  createdAt: string;
  emailPhoneChangesCount?: number;
}

export interface CustomerOrder {
  id: string;
  restaurantName: string;
  ownerEmail: string;
  bottleSize: '250ml' | '500ml' | '750ml_glass' | '1000ml';
  caseCount: number;
  bottlesTotal: number;
  ratePerBottle: number;
  totalAmount: number;
  status: 'Order Confirmed' | 'Bottling & BIS Testing' | 'Dispatched (Out for Delivery)' | 'Delivered to Restaurant';
  driverName?: string;
  driverPhone?: string;
  deliveryAddress: string;
  orderedAt: string;
  expectedDelivery: string;
}

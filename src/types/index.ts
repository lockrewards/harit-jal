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
  source?: 'website_form' | 'mascot' | 'contact_page';
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

export type StaffRole =
  | 'admin'
  | 'staff'
  | 'Staff'
  | 'Sales Manager'
  | 'sales_manager'
  | 'Operations Lead'
  | 'operations_lead'
  | 'Label Designer'
  | 'label_designer';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  role: StaffRole;
  permissions?: string[];
  status: 'Active' | 'Blocked' | 'On Leave';
  inquiriesAssigned: number;
  isRootSuperAdmin?: boolean;
  isFirstLogin?: boolean;
  temporaryPassword?: string; // Legacy plaintext (deprecated, never stored in Supabase/production)
  temporaryPasswordHash?: string; // Salted PBKDF2 hash of temporary password (dev offline fallback only)
  temporaryPasswordExpiresAt?: number; // Expiration timestamp (72h)
  passwordHash?: string;
  totpSecret?: string;
  totpEnabled?: boolean;
  emailPhoneChangesCount?: number;
  createdAt?: string;
}

export interface StaffAuditLog {
  id: string;
  action:
    | 'CREATE_STAFF'
    | 'BLOCK_STAFF'
    | 'UNBLOCK_STAFF'
    | 'DELETE_STAFF'
    | 'FIRST_LOGIN_COMPLETE'
    | 'MFA_ENROLLMENT_COMPLETE'
    | 'RESET_STAFF_MFA'
    | 'REISSUE_STAFF_INVITE'
    | 'UPDATE_STAFF_PERMISSIONS'
    | 'UPDATE_ADMIN_PROFILE'
    | 'BREAK_GLASS_RECOVERY';
  targetUserId: string;
  targetUserEmail: string;
  performedBy: string;
  timestamp: string;
  details: string;
}

export interface GoogleSheetsConfig {
  sheetId: string;
  sheetName: string;
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
  id: string; // Supabase Auth UUID (auth.users.id)
  restaurantName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
  emailPhoneChangesCount?: number;
  deletionScheduledAt?: string;
  deletionDueAt?: string;
  /** @deprecated Passwords are managed exclusively by Supabase Auth (auth.users). Never store passwords in CustomerAccount. */
  password?: string;
  /** @deprecated Password hashes are managed exclusively by Supabase Auth (auth.users). Never store hashes in CustomerAccount. */
  passwordHash?: string;
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

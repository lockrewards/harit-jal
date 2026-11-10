import { AdminUser, CallBooking, GoogleSheetsConfig, VisitorRecord, StaffAuditLog } from '../types';
import { isProductionEnvironment } from './env';
import { normalizeStaffRole, ROOT_SUPER_ADMIN_IDENTITY } from './roles';

const STORAGE_KEYS = {
  BOOKINGS: 'harit_jal_bookings_v1',
  VISITORS: 'harit_jal_visitors_v1',
  CURRENT_VISITOR: 'harit_jal_current_visitor_id',
  USERS: 'harit_jal_admin_users_v1',
  SHEETS_CONFIG: 'harit_jal_sheets_config_v1',
  EMAIL_DISPATCH_LOGS: 'harit_jal_email_logs_v1',
  STAFF_AUDIT_LOGS: 'harit_jal_staff_audit_logs_v1',
};

// Development-only offline roster directory (ZERO plaintext passwords, ZERO password hashes, ZERO TOTP secrets)
export const DEV_SEED_USERS: AdminUser[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: ROOT_SUPER_ADMIN_IDENTITY.name,
    email: ROOT_SUPER_ADMIN_IDENTITY.email,
    phone: ROOT_SUPER_ADMIN_IDENTITY.phone,
    designation: ROOT_SUPER_ADMIN_IDENTITY.designation,
    role: ROOT_SUPER_ADMIN_IDENTITY.role,
    permissions: ['all', 'leads', 'orders', 'inventory', 'pricing', 'staff', 'audit_logs'],
    status: 'Active',
    isRootSuperAdmin: true,
    inquiriesAssigned: 0,
    totpEnabled: true,
    isFirstLogin: false,
    emailPhoneChangesCount: 0,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Pooja Verma',
    email: 'pooja.sales@haritjal.in',
    phone: '+91 98765 43210',
    designation: 'Senior Sales Head',
    role: 'sales_manager',
    permissions: ['leads', 'orders'],
    status: 'Active',
    isRootSuperAdmin: false,
    inquiriesAssigned: 0,
    totpEnabled: true,
    isFirstLogin: false,
    emailPhoneChangesCount: 0,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Rohit K. Rawat',
    email: 'rohit.ops@haritjal.in',
    phone: '+91 98223 45678',
    designation: 'Fulfillment & Logistics Lead',
    role: 'operations_lead',
    permissions: ['orders', 'inventory'],
    status: 'Active',
    isRootSuperAdmin: false,
    inquiriesAssigned: 0,
    totpEnabled: true,
    isFirstLogin: false,
    emailPhoneChangesCount: 0,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Ananya Sen',
    email: 'ananya.design@haritjal.in',
    phone: '+91 98334 56789',
    designation: 'Bespoke Label Art Director',
    role: 'label_designer',
    permissions: ['leads'],
    status: 'Active',
    isRootSuperAdmin: false,
    inquiriesAssigned: 0,
    totpEnabled: true,
    isFirstLogin: false,
    emailPhoneChangesCount: 0,
  },
];

// Development-only demo bookings (never seeded when isProductionEnvironment() === true)
const DEV_SEED_BOOKINGS: CallBooking[] = [
  {
    id: 'HJ-2026-081',
    restaurantName: 'Karan The Dhaba',
    ownerName: 'Karanpreet Singh',
    phone: '+91 62992 93497',
    email: 'karanpreet@karanthedhaba.com',
    city: 'Murthal, GT Road, Haryana',
    bottleSize: '500ml',
    monthlyVolume: 4500,
    capColor: 'emerald_green',
    labelStyle: 'dhaba_heritage',
    preferredDateTime: '2026-11-09 at 3:00 PM',
    notes: 'Require custom Punjabi heritage typography with our signature paratha emblem. Daily peak demand on weekends.',
    status: 'Call Scheduled',
    assignedTo: 'Pooja Verma',
    createdAt: '2026-11-07 14:20',
    syncedToGoogleSheets: true,
  },
  {
    id: 'HJ-2026-082',
    restaurantName: 'The Royal Darbar & Banquets',
    ownerName: 'Rajeev Singhania',
    phone: '+91 98765 43210',
    email: 'banquets@royal-darbar.in',
    city: 'Jaipur, Rajasthan',
    bottleSize: '750ml_glass',
    monthlyVolume: 3000,
    capColor: 'royal_gold',
    labelStyle: 'regal_crest',
    preferredDateTime: '2026-11-08 at 11:30 AM',
    notes: 'Seeking luxury glass decanters with gold foil crest for wedding parties and VIP dining.',
    status: 'New',
    assignedTo: ROOT_SUPER_ADMIN_IDENTITY.name,
    createdAt: '2026-11-07 18:45',
    syncedToGoogleSheets: true,
  },
  {
    id: 'HJ-2026-083',
    restaurantName: 'Cafe Terra - Artisanal Kitchen',
    ownerName: 'Meera Deshmukh',
    phone: '+91 97654 88990',
    email: 'meera@cafeterra.co',
    city: 'Bandra West, Mumbai',
    bottleSize: '250ml',
    monthlyVolume: 2200,
    capColor: 'midnight_black',
    labelStyle: 'bistro_minimal',
    preferredDateTime: '2026-11-10 at 4:00 PM',
    notes: 'Matte finish with minimalist monochrome layout. Looking for eco-friendly returnable program.',
    status: 'Sample Dispatched',
    assignedTo: 'Pooja Verma',
    createdAt: '2026-11-06 16:10',
    syncedToGoogleSheets: true,
  },
];

// Development-only demo visitors (never seeded when isProductionEnvironment() === true)
const DEV_SEED_VISITORS: VisitorRecord[] = [
  {
    visitorId: 'vis-dhaba-99',
    visitCount: 6,
    firstVisit: '2026-11-03 10:15',
    lastVisit: '2026-11-07 20:10',
    pagesViewed: ['Home', 'Bottle Customizer', 'Government Compliance', 'Book a Call'],
    associatedEmail: 'karanpreet@karanthedhaba.com',
    associatedRestaurant: 'Karan The Dhaba',
    isRegular: true,
    device: 'Chrome / Android (OnePlus 12)',
    city: 'Delhi NCR / Murthal',
    lastActive: '15 mins ago',
  },
  {
    visitorId: 'vis-royal-42',
    visitCount: 3,
    firstVisit: '2026-11-05 17:40',
    lastVisit: '2026-11-07 18:40',
    pagesViewed: ['Home', 'Gallery', 'Glass Decanters', 'Compliance FSSAI'],
    associatedEmail: 'banquets@royal-darbar.in',
    associatedRestaurant: 'The Royal Darbar & Banquets',
    isRegular: true,
    device: 'Safari / macOS',
    city: 'Jaipur',
    lastActive: '1 hr ago',
  },
];

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  sentAt: string;
  content: string;
  type: 'admin_lead_alert' | 'client_confirmation' | 'otp_verification';
  status?: string;
}

export const StorageService = {
  // --- BOOKINGS ---
  getBookings(): CallBooking[] {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (!raw) {
      if (isProductionEnvironment()) {
        return [];
      }
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(DEV_SEED_BOOKINGS));
      return DEV_SEED_BOOKINGS;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return isProductionEnvironment() ? [] : DEV_SEED_BOOKINGS;
    }
  },

  setBookings(bookings: CallBooking[]): CallBooking[] {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    return bookings;
  },

  addBooking(booking: Omit<CallBooking, 'id' | 'createdAt' | 'status' | 'assignedTo' | 'syncedToGoogleSheets'>): CallBooking {
    const all = this.getBookings();
    // Collision-resistant ID combining timestamp and random digits to avoid DB primary key collisions across client devices
    const uniqueSuffix = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    const newId = `HJ-2026-${uniqueSuffix}`;
    const users = this.getUsers();
    const salesUser = users.find((u) => normalizeStaffRole(u.role) === 'sales_manager') || users[0];

    const newRecord: CallBooking = {
      ...booking,
      id: newId,
      status: 'New',
      assignedTo: salesUser?.name || 'Harit Jal Sales Desk',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      syncedToGoogleSheets: true,
    };

    all.unshift(newRecord);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(all));

    this.associateCurrentVisitor(booking.email, booking.restaurantName);
    this.dispatchAdminEmailNotification(newRecord);

    return newRecord;
  },

  updateBookingStatus(id: string, status: CallBooking['status'], assignedTo?: string) {
    const all = this.getBookings();
    const updated = all.map((b) => {
      if (b.id === id) {
        const isAdminApproved = status === 'Call Scheduled' || status === 'Active Client' || b.adminApproved;
        return {
          ...b,
          status,
          adminApproved: isAdminApproved,
          ...(isAdminApproved && !b.approvedAt ? { approvedAt: new Date().toISOString() } : {}),
          ...(assignedTo ? { assignedTo } : {}),
        };
      }
      return b;
    });
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return updated;
  },

  updateBookingDetails(id: string, updates: Partial<CallBooking>) {
    const all = this.getBookings();
    const updated = all.map((b) => {
      if (b.id === id) {
        return {
          ...b,
          ...updates,
        };
      }
      return b;
    });
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return updated;
  },

  approveBooking(id: string, approvedBy: string = 'Super Admin') {
    const all = this.getBookings();
    const updated = all.map((b) => {
      if (b.id === id) {
        return {
          ...b,
          status: 'Call Scheduled' as const,
          adminApproved: true,
          approvedAt: new Date().toISOString(),
          approvedBy,
        };
      }
      return b;
    });
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(updated));
    return updated;
  },

  // --- VISITOR & REGULAR USER TRACKING ---
  getVisitors(): VisitorRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.VISITORS);
    if (!raw) {
      if (isProductionEnvironment()) {
        return [];
      }
      localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(DEV_SEED_VISITORS));
      return DEV_SEED_VISITORS;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return isProductionEnvironment() ? [] : DEV_SEED_VISITORS;
    }
  },

  trackCurrentVisitorSession(currentPage: string = 'Home'): VisitorRecord {
    let visitorId = localStorage.getItem(STORAGE_KEYS.CURRENT_VISITOR);
    const visitors = this.getVisitors();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    let currentRecord = visitors.find((v) => v.visitorId === visitorId);

    if (!currentRecord) {
      visitorId = `vis-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem(STORAGE_KEYS.CURRENT_VISITOR, visitorId);

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      currentRecord = {
        visitorId,
        visitCount: 1,
        firstVisit: now,
        lastVisit: now,
        pagesViewed: [currentPage],
        isRegular: false,
        device: isMobile ? 'Mobile Browser' : 'Desktop (Windows / Mac)',
        city: 'Delhi NCR (Detected)',
        lastActive: 'Just now',
      };
      visitors.unshift(currentRecord);
    } else {
      currentRecord.visitCount += 1;
      currentRecord.lastVisit = now;
      currentRecord.lastActive = 'Active now';
      if (currentRecord.visitCount >= 2) {
        currentRecord.isRegular = true;
      }
      if (!currentRecord.pagesViewed.includes(currentPage)) {
        currentRecord.pagesViewed.push(currentPage);
      }
    }

    localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(visitors));
    return currentRecord;
  },

  associateCurrentVisitor(email: string, restaurantName?: string) {
    const visitorId = localStorage.getItem(STORAGE_KEYS.CURRENT_VISITOR);
    if (!visitorId) return;

    const visitors = this.getVisitors();
    const updated = visitors.map((v) => {
      if (v.visitorId === visitorId) {
        return {
          ...v,
          associatedEmail: email,
          ...(restaurantName ? { associatedRestaurant: restaurantName } : {}),
          isRegular: true,
        };
      }
      return v;
    });
    localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(updated));
  },

  // --- ADMIN USERS & ROLE ASSIGNMENT ---
  getUsers(): AdminUser[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      if (isProductionEnvironment()) {
        return [];
      }
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEV_SEED_USERS));
      return DEV_SEED_USERS;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return isProductionEnvironment() ? [] : DEV_SEED_USERS;
    }
  },

  setUsers(users: AdminUser[]): AdminUser[] {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return users;
  },

  addUser(user: Omit<AdminUser, 'id' | 'inquiriesAssigned'> & { id?: string }): AdminUser {
    const all = this.getUsers();
    const newUser: AdminUser = {
      ...user,
      id: user.id || `usr-${Date.now().toString().slice(-4)}`,
      inquiriesAssigned: 0,
    };
    all.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(all));
    return newUser;
  },

  deleteUser(id: string) {
    const all = this.getUsers().filter((u) => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(all));
    return all;
  },

  updateUser(id: string, updates: Partial<AdminUser>): AdminUser | null {
    const all = this.getUsers();
    const idx = all.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    // Purge keys explicitly updated to undefined (e.g. single-use credentials)
    for (const key of Object.keys(updates)) {
      if ((updates as Record<string, unknown>)[key] === undefined) {
        delete (all[idx] as unknown as Record<string, unknown>)[key];
      }
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(all));
    return all[idx];
  },

  blockUser(id: string): AdminUser | null {
    return this.updateUser(id, { status: 'Blocked' });
  },

  unblockUser(id: string): AdminUser | null {
    return this.updateUser(id, { status: 'Active' });
  },

  updateAdminProfile(
    adminId: string,
    newEmail?: string,
    newPhone?: string
  ): { success: boolean; error?: string; user?: AdminUser } {
    const all = this.getUsers();
    const user = all.find((u) => u.id === adminId);
    if (!user) {
      return { success: false, error: 'Admin account not found.' };
    }

    if (user.role !== 'admin' && !user.isRootSuperAdmin) {
      return { success: false, error: 'Staff members cannot change their email or phone. Only Admin can update credentials.' };
    }

    if (user.isRootSuperAdmin === true) {
      return { success: false, error: 'Root Admin email address and mobile number are permanently bound and immutable.' };
    }

    const currentCount = user.emailPhoneChangesCount || 0;
    if (currentCount >= 5) {
      return {
        success: false,
        error: 'Lifetime modification limit reached. You have already changed your email/mobile number 5 times.',
      };
    }

    const cleanEmail = newEmail ? newEmail.trim().toLowerCase() : user.email;
    const cleanPhone = newPhone ? newPhone.trim() : user.phone;

    if (cleanEmail !== user.email && all.some((u) => u.id !== adminId && u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'This email is already assigned to another staff member.' };
    }

    user.email = cleanEmail;
    user.phone = cleanPhone;
    user.emailPhoneChangesCount = currentCount + 1;

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(all));
    return { success: true, user };
  },

  // --- GOOGLE SHEETS & EMAIL AUTOMATION ---
  getSheetsConfig(): GoogleSheetsConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.SHEETS_CONFIG);
    const defaultConfig: GoogleSheetsConfig = {
      sheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      sheetName: 'HaritJal_Inquiries_Master',
      autoSync: true,
      lastSyncTime: 'Just now',
    };
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SHEETS_CONFIG, JSON.stringify(defaultConfig));
      return defaultConfig;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const clean: GoogleSheetsConfig = {
        sheetId: typeof parsed.sheetId === 'string' && parsed.sheetId.trim() ? parsed.sheetId : defaultConfig.sheetId,
        sheetName: typeof parsed.sheetName === 'string' && parsed.sheetName.trim() ? parsed.sheetName : defaultConfig.sheetName,
        autoSync: typeof parsed.autoSync === 'boolean' ? parsed.autoSync : defaultConfig.autoSync,
        lastSyncTime: typeof parsed.lastSyncTime === 'string' ? parsed.lastSyncTime : defaultConfig.lastSyncTime,
      };
      if ('webhookUrl' in parsed) {
        localStorage.setItem(STORAGE_KEYS.SHEETS_CONFIG, JSON.stringify(clean));
      }
      return clean;
    } catch {
      return defaultConfig;
    }
  },

  saveSheetsConfig(config: GoogleSheetsConfig) {
    const clean: GoogleSheetsConfig = {
      sheetId: config.sheetId,
      sheetName: config.sheetName,
      autoSync: config.autoSync,
      lastSyncTime: config.lastSyncTime,
    };
    localStorage.setItem(STORAGE_KEYS.SHEETS_CONFIG, JSON.stringify(clean));
  },

  dispatchAdminEmailNotification(booking: CallBooking) {
    const logsRaw = localStorage.getItem(STORAGE_KEYS.EMAIL_DISPATCH_LOGS);
    const logs: EmailLog[] = logsRaw ? JSON.parse(logsRaw) : [];

    const channelLabel = booking.source === 'mascot'
      ? 'Mascot (Neer AI Chat)'
      : booking.source === 'contact_page'
      ? 'Website Form (Contact Page)'
      : 'Website Form (Consultation Modal)';
    const channelTag = booking.source === 'mascot' ? 'Mascot (Neer AI)' : 'Website Form';

    const newLog: EmailLog = {
      id: `mail-${Date.now()}`,
      recipient: 'info@haritjal.in',
      subject: `🚨 [NEW ENQUIRY via ${channelTag}] ${booking.restaurantName} (${booking.city})`,
      sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'admin_lead_alert',
      status: 'Dispatched',
      content: `Hello Harit Jal Operations Team,

A new customer inquiry has been received.

• Channel / Source: ${channelLabel}
• Restaurant Name: ${booking.restaurantName}
• Owner / Decision Maker: ${booking.ownerName}
• Direct Phone: ${booking.phone}
• Email ID: ${booking.email}
• Location: ${booking.city}
• Monthly Requirement: ${booking.monthlyVolume.toLocaleString()} bottles
• Preferred Size: ${booking.bottleSize}
• Preferred Time: ${booking.preferredDateTime}
• Special Notes: ${booking.notes || 'None'}

Status: Automatically appended to Google Sheets row #${logs.length + 4}.
Action: Sales representative assigned: ${booking.assignedTo}.`,
    };

    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.EMAIL_DISPATCH_LOGS, JSON.stringify(logs.slice(0, 30)));
  },

  addEmailLog(entry: {
    recipient?: string;
    to?: string;
    subject: string;
    content?: string;
    body?: string;
    type?: 'admin_lead_alert' | 'client_confirmation' | 'otp_verification';
    status?: string;
  }): EmailLog {
    const logsRaw = localStorage.getItem(STORAGE_KEYS.EMAIL_DISPATCH_LOGS);
    const logs: EmailLog[] = logsRaw ? JSON.parse(logsRaw) : [];

    const newLog: EmailLog = {
      id: `mail-${Date.now()}`,
      recipient: entry.recipient || entry.to || 'info@haritjal.in',
      subject: entry.subject,
      sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: entry.type || 'otp_verification',
      status: entry.status || 'Dispatched',
      content: entry.content || entry.body || '',
    };

    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.EMAIL_DISPATCH_LOGS, JSON.stringify(logs.slice(0, 50)));
    return newLog;
  },

  getEmailLogs(): EmailLog[] {
    const logsRaw = localStorage.getItem(STORAGE_KEYS.EMAIL_DISPATCH_LOGS);
    return logsRaw ? JSON.parse(logsRaw) : [];
  },

  /**
   * Appends an immutable audit log entry for administrative staff management actions
   */
  addStaffAuditLog(entry: Omit<StaffAuditLog, 'id' | 'timestamp'>): StaffAuditLog {
    const logsRaw = localStorage.getItem(STORAGE_KEYS.STAFF_AUDIT_LOGS);
    const logs: StaffAuditLog[] = logsRaw ? JSON.parse(logsRaw) : [];

    const newLog: StaffAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action: entry.action,
      targetUserId: entry.targetUserId,
      targetUserEmail: entry.targetUserEmail,
      performedBy: entry.performedBy,
      details: entry.details,
      timestamp: new Date().toISOString(),
    };

    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.STAFF_AUDIT_LOGS, JSON.stringify(logs.slice(0, 100)));
    return newLog;
  },

  setStaffAuditLogs(logs: StaffAuditLog[]): StaffAuditLog[] {
    localStorage.setItem(STORAGE_KEYS.STAFF_AUDIT_LOGS, JSON.stringify(logs.slice(0, 100)));
    return logs;
  },

  /**
   * Retrieves administrative staff audit trail
   */
  getStaffAuditLogs(): StaffAuditLog[] {
    const logsRaw = localStorage.getItem(STORAGE_KEYS.STAFF_AUDIT_LOGS);
    return logsRaw ? JSON.parse(logsRaw) : [];
  },

  // Export current inquiries as a downloadable Google Sheets compatible CSV
  exportToCSV(): string {
    const bookings = this.getBookings();
    const headers = [
      'Inquiry ID',
      'Restaurant Name',
      'Owner Name',
      'Phone',
      'Email',
      'City',
      'Bottle Size',
      'Monthly Volume (Units)',
      'Preferred Call Date/Time',
      'Status',
      'Assigned Manager',
      'Date Submitted',
    ];

    const rows = bookings.map((b) => [
      b.id,
      `"${b.restaurantName}"`,
      `"${b.ownerName}"`,
      `"${b.phone}"`,
      b.email,
      `"${b.city}"`,
      b.bottleSize,
      b.monthlyVolume,
      `"${b.preferredDateTime}"`,
      b.status,
      `"${b.assignedTo}"`,
      b.createdAt,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },
};

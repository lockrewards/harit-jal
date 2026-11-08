import { AdminUser, CallBooking, GoogleSheetsConfig, VisitorRecord } from '../types';

const STORAGE_KEYS = {
  BOOKINGS: 'harit_jal_bookings_v1',
  VISITORS: 'harit_jal_visitors_v1',
  CURRENT_VISITOR: 'harit_jal_current_visitor_id',
  USERS: 'harit_jal_admin_users_v1',
  SHEETS_CONFIG: 'harit_jal_sheets_config_v1',
  EMAIL_DISPATCH_LOGS: 'harit_jal_email_logs_v1',
};

// Initial Seed Data for Instant Demonstration
const INITIAL_USERS: AdminUser[] = [
  {
    id: 'usr-1',
    name: 'Vikramaditya Chauhan',
    email: 'vikram@haritjal.in',
    phone: '+91 98765 43210',
    designation: 'Founder & Super Admin',
    role: 'Super Admin',
    permissions: ['all', 'leads', 'orders', 'inventory', 'pricing', 'staff', 'audit_logs'],
    status: 'Active',
    inquiriesAssigned: 4,
    totpSecret: 'JBSWY3DPEHPK3PXP',
    totpEnabled: true,
    emailPhoneChangesCount: 0,
  },
  {
    id: 'usr-2',
    name: 'Pooja Verma',
    email: 'pooja.sales@haritjal.in',
    phone: '+91 98112 34567',
    designation: 'Senior Sales Head',
    role: 'Sales Manager',
    permissions: ['leads', 'orders'],
    status: 'Active',
    inquiriesAssigned: 8,
    totpSecret: 'KRSXG5CTMVRXEZLU',
    totpEnabled: true,
    emailPhoneChangesCount: 0,
  },
  {
    id: 'usr-3',
    name: 'Rohit K. Rawat',
    email: 'rohit.ops@haritjal.in',
    phone: '+91 98223 45678',
    designation: 'Fulfillment & Logistics Lead',
    role: 'Operations Lead',
    permissions: ['orders', 'inventory'],
    status: 'Active',
    inquiriesAssigned: 3,
    totpSecret: 'MZXXE33BOMQWO2LH',
    totpEnabled: true,
    emailPhoneChangesCount: 0,
  },
  {
    id: 'usr-4',
    name: 'Ananya Sen',
    email: 'ananya.design@haritjal.in',
    phone: '+91 98334 56789',
    designation: 'Bespoke Label Art Director',
    role: 'Label Designer',
    permissions: ['leads'],
    status: 'Active',
    inquiriesAssigned: 5,
    totpSecret: 'GEZDGNBVGY3TQOJQ',
    totpEnabled: true,
    emailPhoneChangesCount: 0,
  },
];

const INITIAL_BOOKINGS: CallBooking[] = [
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
    phone: '+91 98112 34567',
    email: 'banquets@royal-darbar.in',
    city: 'Jaipur, Rajasthan',
    bottleSize: '750ml_glass',
    monthlyVolume: 3000,
    capColor: 'royal_gold',
    labelStyle: 'regal_crest',
    preferredDateTime: '2026-11-08 at 11:30 AM',
    notes: 'Seeking luxury glass decanters with gold foil crest for wedding parties and VIP dining.',
    status: 'New',
    assignedTo: 'Vikramaditya Chauhan',
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

const INITIAL_VISITORS: VisitorRecord[] = [
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
  {
    visitorId: 'vis-bengaluru-88',
    visitCount: 4,
    firstVisit: '2026-11-04 12:20',
    lastVisit: '2026-11-07 19:30',
    pagesViewed: ['Home', 'Supply Roadmap', 'Eco Sustainability'],
    associatedEmail: 'aniket@smokeandhops.in',
    associatedRestaurant: 'Smoke & Hops Brewery',
    isRegular: true,
    device: 'Chrome / Windows',
    city: 'Bengaluru',
    lastActive: '45 mins ago',
  },
];

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  sentAt: string;
  content: string;
  type: 'admin_lead_alert' | 'client_confirmation' | 'otp_verification';
}

export const StorageService = {
  // --- BOOKINGS ---
  getBookings(): CallBooking[] {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(INITIAL_BOOKINGS));
      return INITIAL_BOOKINGS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_BOOKINGS;
    }
  },

  addBooking(booking: Omit<CallBooking, 'id' | 'createdAt' | 'status' | 'assignedTo' | 'syncedToGoogleSheets'>): CallBooking {
    const all = this.getBookings();
    const newId = `HJ-2026-${String(all.length + 84).padStart(3, '0')}`;
    const users = this.getUsers();
    // Round-robin or default sales lead assignment
    const salesUser = users.find(u => u.role === 'Sales Manager') || users[0];

    const newRecord: CallBooking = {
      ...booking,
      id: newId,
      status: 'New',
      assignedTo: salesUser.name,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      syncedToGoogleSheets: true,
    };

    all.unshift(newRecord);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(all));

    // Update current visitor association
    this.associateCurrentVisitor(booking.email, booking.restaurantName);

    // Simulate Admin Email Dispatch
    this.dispatchAdminEmailNotification(newRecord);

    return newRecord;
  },

  updateBookingStatus(id: string, status: CallBooking['status'], assignedTo?: string) {
    const all = this.getBookings();
    const updated = all.map(b => {
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

  approveBooking(id: string, approvedBy: string = 'Super Admin') {
    const all = this.getBookings();
    const updated = all.map(b => {
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
      localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(INITIAL_VISITORS));
      return INITIAL_VISITORS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_VISITORS;
    }
  },

  trackCurrentVisitorSession(currentPage: string = 'Home'): VisitorRecord {
    let visitorId = localStorage.getItem(STORAGE_KEYS.CURRENT_VISITOR);
    const visitors = this.getVisitors();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    let currentRecord = visitors.find(v => v.visitorId === visitorId);

    if (!currentRecord) {
      // First time visiting
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
      // Returning visitor!
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
    const updated = visitors.map(v => {
      if (v.visitorId === visitorId) {
        return {
          ...v,
          associatedEmail: email,
          ...(restaurantName ? { associatedRestaurant: restaurantName } : {}),
          isRegular: true, // Anyone who enters their business info is marked as a verified regular lead
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
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_USERS;
    }
  },

  addUser(user: Omit<AdminUser, 'id' | 'inquiriesAssigned'>): AdminUser {
    const all = this.getUsers();
    const newUser: AdminUser = {
      ...user,
      id: `usr-${Date.now().toString().slice(-4)}`,
      inquiriesAssigned: 0,
    };
    all.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(all));
    return newUser;
  },

  deleteUser(id: string) {
    const all = this.getUsers().filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(all));
    return all;
  },

  updateUser(id: string, updates: Partial<AdminUser>): AdminUser | null {
    const all = this.getUsers();
    const idx = all.findIndex(u => u.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
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
    const user = all.find(u => u.id === adminId);
    if (!user) {
      return { success: false, error: 'Admin account not found.' };
    }

    // Only Super Admin can change their credentials
    if (user.role !== 'Super Admin') {
      return { success: false, error: 'Staff members cannot change their email or phone. Only Super Admin can update credentials.' };
    }

    const currentCount = user.emailPhoneChangesCount || 0;
    if (currentCount >= 5) {
      return { 
        success: false, 
        error: 'Lifetime modification limit reached. You have already changed your email/mobile number 5 times.' 
      };
    }

    const cleanEmail = newEmail ? newEmail.trim().toLowerCase() : user.email;
    const cleanPhone = newPhone ? newPhone.trim() : user.phone;

    // Check for collisions
    if (cleanEmail !== user.email && all.some(u => u.id !== adminId && u.email.toLowerCase() === cleanEmail)) {
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
      webhookUrl: 'https://script.google.com/macros/s/AKfycbz_HaritJal_LiveSync/exec',
      autoSync: true,
      lastSyncTime: 'Just now',
    };
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SHEETS_CONFIG, JSON.stringify(defaultConfig));
      return defaultConfig;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return defaultConfig;
    }
  },

  saveSheetsConfig(config: GoogleSheetsConfig) {
    localStorage.setItem(STORAGE_KEYS.SHEETS_CONFIG, JSON.stringify(config));
  },

  dispatchAdminEmailNotification(booking: CallBooking) {
    const logsRaw = localStorage.getItem(STORAGE_KEYS.EMAIL_DISPATCH_LOGS);
    const logs: EmailLog[] = logsRaw ? JSON.parse(logsRaw) : [];

    const newLog: EmailLog = {
      id: `mail-${Date.now()}`,
      recipient: 'info@haritjal.in',
      subject: `🚨 [URGENT NEW CALL BOOKED] ${booking.restaurantName} (${booking.city})`,
      sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'admin_lead_alert',
      content: `Hello Harit Jal Operations Team,

A new high-value store inquiry was just booked on haritjal.in!

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

    const rows = bookings.map(b => [
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

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  },
};


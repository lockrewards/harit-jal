import React, { useState, useEffect } from 'react';
import { 
  X, Users, UserPlus, PhoneCall, Mail, FileSpreadsheet, Download, RefreshCw, 
  Search, CheckCircle, Clock, Trash2, Activity, Eye, EyeOff, Building, Pencil,
  Bot, BookOpen, Sliders, Plus, ShieldCheck, CheckCircle2, Image as ImageIcon, Upload,
  LogOut, Home, Sparkles
} from 'lucide-react';
import { CallBooking, VisitorRecord, AdminUser, GoogleSheetsConfig, StaffAuditLog } from '../types';
import { KnowledgeItem, NeerAnalytics, NeerAIConfig, LeadRecord, AutomationConfig } from '../types/neer';
import { StorageService, EmailLog } from '../services/storage';
import { KnowledgeBaseService } from '../services/knowledgeBase';
import { NeerAIService } from '../services/neerAI';
import { AutomationService, ServerIntegrationStatus } from '../services/automationService';
import { soundPlayer } from '../services/sound';
import { GalleryService, GalleryItem } from '../services/galleryService';
import { AdminAuthService, AdminSession } from '../services/adminAuth';
import { SupabaseService, isSupabaseConfigured } from '../services/supabase';
import { formatRoleDisplay } from '../services/roles';
import { StaffManagementModal } from './admin/StaffManagementModal';
import { AdminProfileSettingsModal } from './admin/AdminProfileSettingsModal';

interface AdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
  session?: AdminSession | null;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ isOpen, onClose, onLogout, session }) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'visitors' | 'users' | 'email_logs' | 'neer_ai' | 'gallery'>('bookings');
  
  // Data states (initialized lazily; async cloud hydration runs inside useEffect)
  const [bookings, setBookings] = useState<CallBooking[]>(() => StorageService.getBookings());
  const [visitors, setVisitors] = useState<VisitorRecord[]>(() => StorageService.getVisitors());
  const [users, setUsers] = useState<AdminUser[]>(() => StorageService.getUsers());
  const [staffAuditLogs, setStaffAuditLogs] = useState<StaffAuditLog[]>(() => StorageService.getStaffAuditLogs());
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(() => StorageService.getEmailLogs());
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(() => StorageService.getSheetsConfig());

  // Staff and Admin Profile Modals State
  const [showStaffManagementModal, setShowStaffManagementModal] = useState(false);
  const [showAdminProfileModal, setShowAdminProfileModal] = useState(false);

  // Gallery Catalog Management State
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(() => GalleryService.getAllItems());
  const [showAddEditGalleryModal, setShowAddEditGalleryModal] = useState(false);
  const [editingGalleryItem, setEditingGalleryItem] = useState<GalleryItem | null>(null);
  const [gallerySearchTerm, setGallerySearchTerm] = useState('');
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState('all');

  // Form states for adding/editing gallery item
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formCategory, setFormCategory] = useState<GalleryItem['category']>('glass');
  const [formSize, setFormSize] = useState<GalleryItem['size']>('500ml');
  const [formMaterial, setFormMaterial] = useState('Ultra-Clear Flint Glass');
  const [formCapColor, setFormCapColor] = useState('Champagne Gold');
  const [formWholesaleRate, setFormWholesaleRate] = useState<number>(14);
  const [formRecommendedMRP, setFormRecommendedMRP] = useState<number>(40);
  const [formBadge, setFormBadge] = useState('Signature');
  const [formIsVisible, setFormIsVisible] = useState(true);


  // Neer AI & Knowledge Base state
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(() => KnowledgeBaseService.getAllKnowledge());
  const [neerAnalytics, setNeerAnalytics] = useState<NeerAnalytics>(() => NeerAIService.getAnalytics());
  const [neerConfig, setNeerConfig] = useState<NeerAIConfig>(() => NeerAIService.getAIConfig());
  const [leads, setLeads] = useState<LeadRecord[]>(() => AutomationService.getAllLeads());
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig>(() => AutomationService.getConfig());
  const [integrationStatus, setIntegrationStatus] = useState<ServerIntegrationStatus | null>(null);
  const [knowledgeCategoryFilter, setKnowledgeCategoryFilter] = useState('all');
  const [knowledgeSearchTerm, setKnowledgeSearchTerm] = useState('');
  const [showAddKnowledgeModal, setShowAddKnowledgeModal] = useState(false);
  const [newKbTitle, setNewKbTitle] = useState('');
  const [newKbCategory, setNewKbCategory] = useState<KnowledgeItem['category']>('product');
  const [newKbKeywords, setNewKbKeywords] = useState('');
  const [newKbContent, setNewKbContent] = useState('');
  const [newKbSource, setNewKbSource] = useState('Harit Jal B2B Admin Desk');

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Sync notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const liveStoredSession = AdminAuthService.getCurrentSession();
  const effectiveSession = liveStoredSession || session || null;

  const hasWorkspacePermission = (perm: string): boolean => {
    if (liveStoredSession) {
      return AdminAuthService.hasPermission(perm);
    }
    if (!effectiveSession) return false;
    if (effectiveSession.isRootSuperAdmin === true) return true;
    const perms = Array.isArray(effectiveSession.permissions) ? effectiveSession.permissions : [];
    return perms.includes('all') || perms.includes(perm);
  };

  const canManageStaff =
    effectiveSession?.isRootSuperAdmin === true ||
    (Array.isArray(effectiveSession?.permissions) && effectiveSession.permissions.includes('staff'));
  const canViewBookings = hasWorkspacePermission('leads') || hasWorkspacePermission('orders');
  const canViewVisitors = hasWorkspacePermission('analytics');
  const canViewEmailLogs = hasWorkspacePermission('audit_logs');
  const canManageNeerAi =
    hasWorkspacePermission('leads') ||
    hasWorkspacePermission('pricing') ||
    hasWorkspacePermission('analytics');
  const canManageGallery = hasWorkspacePermission('inventory') || hasWorkspacePermission('pricing');
  const hasAnyWorkspaceTab =
    canViewBookings ||
    canViewVisitors ||
    canManageStaff ||
    canViewEmailLogs ||
    canManageNeerAi ||
    canManageGallery;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const readLocalSnapshot = () => ({
    localBookings: StorageService.getBookings(),
    localVisitors: StorageService.getVisitors(),
    localUsers: StorageService.getUsers(),
    localAuditLogs: StorageService.getStaffAuditLogs(),
    localEmailLogs: StorageService.getEmailLogs(),
    localSheetsConfig: StorageService.getSheetsConfig(),
    localKnowledge: KnowledgeBaseService.getAllKnowledge(),
    localAnalytics: NeerAIService.getAnalytics(),
    localNeerConfig: NeerAIService.getAIConfig(),
    localLeads: AutomationService.getAllLeads(),
    localAutomationConfig: AutomationService.getConfig(),
    localGallery: GalleryService.getAllItems(),
  });

  const [isSyncing, setIsSyncing] = useState(false);

  const syncPortalData = async (isCancelled?: () => boolean) => {
    await Promise.resolve();
    if (isCancelled?.()) return;

    setIsSyncing(true);
    try {
      const snap = readLocalSnapshot();
      setBookings(snap.localBookings);
      setVisitors(snap.localVisitors);
      setUsers(snap.localUsers);
      setStaffAuditLogs(snap.localAuditLogs);
      setEmailLogs(snap.localEmailLogs);
      setSheetsConfig(snap.localSheetsConfig);
      setKnowledgeItems(snap.localKnowledge);
      setNeerAnalytics(snap.localAnalytics);
      setNeerConfig(snap.localNeerConfig);
      setLeads(snap.localLeads);
      setAutomationConfig(snap.localAutomationConfig);
      setGalleryItems(snap.localGallery);

      if (isSupabaseConfigured() && AdminAuthService.isAuthenticated()) {
        const [cloudBookings, cloudUsers, cloudAuditLogs, cloudEmailLogs, srvIntegrations] = await Promise.all([
          canViewBookings ? SupabaseService.fetchConsultationsForStaff() : Promise.resolve(null),
          canManageStaff || canViewBookings ? AdminAuthService.syncStaffRosterFromCloud() : Promise.resolve(null),
          canManageStaff || canViewEmailLogs ? SupabaseService.fetchStaffAuditLogs() : Promise.resolve(null),
          canViewEmailLogs ? SupabaseService.fetchEmailLogs() : Promise.resolve(null),
          AutomationService.fetchServerIntegrationStatus(),
        ]);

        if (isCancelled?.()) return;

        if (srvIntegrations) {
          setIntegrationStatus(srvIntegrations);
        }

        if (cloudBookings) {
          StorageService.setBookings(cloudBookings);
          setBookings(cloudBookings);
        }
        if (cloudUsers) {
          setUsers(cloudUsers);
        }
        if (cloudAuditLogs) {
          StorageService.setStaffAuditLogs(cloudAuditLogs);
          setStaffAuditLogs(cloudAuditLogs);
        }
        if (cloudEmailLogs) {
          setEmailLogs(cloudEmailLogs);
        }
      }
    } finally {
      if (!isCancelled?.()) {
        setIsSyncing(false);
      }
    }
  };

  const refreshData = () => {
    void syncPortalData();
  };

  useEffect(() => {
    let cancelled = false;
    if (isOpen) {
      const hydrateOnOpen = async () => {
        await Promise.resolve();
        if (cancelled) return;

        const snap = readLocalSnapshot();
        setBookings(snap.localBookings);
        setVisitors(snap.localVisitors);
        setUsers(snap.localUsers);
        setStaffAuditLogs(snap.localAuditLogs);
        setEmailLogs(snap.localEmailLogs);
        setSheetsConfig(snap.localSheetsConfig);
        setKnowledgeItems(snap.localKnowledge);
        setNeerAnalytics(snap.localAnalytics);
        setNeerConfig(snap.localNeerConfig);
        setLeads(snap.localLeads);
        setAutomationConfig(snap.localAutomationConfig);
        setGalleryItems(snap.localGallery);

        if (isSupabaseConfigured() && AdminAuthService.isAuthenticated()) {
          const [cloudBookings, cloudUsers, cloudAuditLogs, cloudEmailLogs, srvIntegrations] = await Promise.all([
            canViewBookings ? SupabaseService.fetchConsultationsForStaff() : Promise.resolve(null),
            canManageStaff || canViewBookings ? AdminAuthService.syncStaffRosterFromCloud() : Promise.resolve(null),
            canManageStaff || canViewEmailLogs ? SupabaseService.fetchStaffAuditLogs() : Promise.resolve(null),
            canViewEmailLogs ? SupabaseService.fetchEmailLogs() : Promise.resolve(null),
            AutomationService.fetchServerIntegrationStatus(),
          ]);

          if (cancelled) return;

          if (srvIntegrations) {
            setIntegrationStatus(srvIntegrations);
          }

          if (cloudBookings) {
            StorageService.setBookings(cloudBookings);
            setBookings(cloudBookings);
          }
          if (cloudUsers) {
            setUsers(cloudUsers);
          }
          if (cloudAuditLogs) {
            StorageService.setStaffAuditLogs(cloudAuditLogs);
            setStaffAuditLogs(cloudAuditLogs);
          }
          if (cloudEmailLogs) {
            setEmailLogs(cloudEmailLogs);
          }
        }
      };

      void hydrateOnOpen();
    }
    const unsubscribeGallery = GalleryService.subscribe(() => {
      if (!cancelled) {
        setGalleryItems(GalleryService.getAllItems());
      }
    });
    return () => {
      cancelled = true;
      unsubscribeGallery();
    };
  }, [isOpen, canViewBookings, canManageStaff, canViewEmailLogs]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const ensurePermittedTab = async () => {
      const allowedTabs: Array<'bookings' | 'visitors' | 'users' | 'email_logs' | 'neer_ai' | 'gallery'> = [];
      if (canViewBookings) allowedTabs.push('bookings');
      if (canViewVisitors) allowedTabs.push('visitors');
      if (canManageStaff) allowedTabs.push('users');
      if (canViewEmailLogs) allowedTabs.push('email_logs');
      if (canManageNeerAi) allowedTabs.push('neer_ai');
      if (canManageGallery) allowedTabs.push('gallery');

      if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
        await Promise.resolve();
        if (!cancelled) {
          setActiveTab(allowedTabs[0]);
        }
      }
    };
    void ensurePermittedTab();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, canViewBookings, canViewVisitors, canManageStaff, canViewEmailLogs, canManageNeerAi, canManageGallery]);

  if (!isOpen) return null;

  const denyUnauthorizedAction = () => {
    soundPlayer.playBubblePop();
    showToast('Access denied: Missing required workspace permission.');
  };

  const handleUpdateStatus = (id: string, newStatus: CallBooking['status']) => {
    if (!canViewBookings) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    const updated = StorageService.updateBookingStatus(id, newStatus);
    setBookings(updated);
    if (isSupabaseConfigured()) {
      void SupabaseService.updateConsultationStatusInCloud(id, newStatus);
    }
    showToast(`Status updated to "${newStatus}" for inquiry ${id}`);
  };

  const handleReassignUser = (id: string, assignedTo: string) => {
    if (!canViewBookings) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;
    const updated = StorageService.updateBookingStatus(id, booking.status, assignedTo);
    setBookings(updated);
    if (isSupabaseConfigured()) {
      const matchedStaff = users.find((u) => u.name === assignedTo);
      void SupabaseService.updateConsultationStatusInCloud(id, booking.status, matchedStaff?.id);
    }
    showToast(`Reassigned inquiry ${id} to ${assignedTo}`);
  };

  const handleExportCSV = () => {
    if (!canViewBookings && !canViewEmailLogs) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playSuccessChime();
    const csvContent = StorageService.exportToCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `harit_jal_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported CSV file for Google Sheets integration.');
  };

  const handleToggleSheetsAutoSync = (enabled: boolean) => {
    if (!canViewEmailLogs && !canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    const updated = {
      ...sheetsConfig,
      autoSync: enabled,
    };
    StorageService.saveSheetsConfig(updated);
    setSheetsConfig(updated);
    showToast(`Google Sheets server auto-sync ${enabled ? 'enabled' : 'disabled'}.`);
  };

  const handleAddKnowledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    if (!newKbTitle.trim() || !newKbContent.trim()) return;

    soundPlayer.playSuccessChime();
    const keywordsArray = newKbKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    const item = KnowledgeBaseService.addKnowledgeItem({
      category: newKbCategory,
      title: newKbTitle.trim(),
      keywords: keywordsArray.length > 0 ? keywordsArray : [newKbTitle.toLowerCase()],
      content: newKbContent.trim(),
      source: newKbSource.trim() || 'Harit Jal B2B Admin Desk',
      verified: true,
    });

    setKnowledgeItems(KnowledgeBaseService.getAllKnowledge());
    setShowAddKnowledgeModal(false);
    setNewKbTitle('');
    setNewKbKeywords('');
    setNewKbContent('');
    showToast(`Added verified knowledge: "${item.title}"`);
  };

  const handleDeleteKnowledge = (id: string) => {
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playBubblePop();
    KnowledgeBaseService.deleteKnowledgeItem(id);
    setKnowledgeItems(KnowledgeBaseService.getAllKnowledge());
    showToast('Knowledge item removed.');
  };

  const handleResetKnowledge = () => {
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    const defaults = KnowledgeBaseService.resetToDefault();
    setKnowledgeItems(defaults);
    showToast('Reset Knowledge Base to verified defaults.');
  };

  const handleSyncCatalogToKnowledge = () => {
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    const updated = KnowledgeBaseService.getAllKnowledge();
    setKnowledgeItems(updated);
    showToast('Neer AI successfully trained with all latest Bottle Gallery catalog items!');
  };

  const handleTrainFromQuery = (queryText: string) => {
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    setNewKbTitle(`Visitor Inquiry: ${queryText.slice(0, 40)}`);
    const words = queryText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length > 2);
    setNewKbKeywords(words.slice(0, 6).join(', '));
    setNewKbCategory('general');
    setNewKbContent('');
    setNewKbSource('Customer Inquiry Learning');
    setShowAddKnowledgeModal(true);
  };

  const handleDismissQuery = (index: number) => {
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    NeerAIService.removeUnansweredQuery(index);
    setNeerAnalytics(NeerAIService.getAnalytics());
    showToast('Inquiry removed from training queue.');
  };

  const handleSaveAIConfig = (provider: 'local' | 'gemini') => {
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    NeerAIService.saveAIConfig({
      provider,
    });
    setNeerConfig(NeerAIService.getAIConfig());
    showToast(`Neer AI config updated to ${provider === 'gemini' ? 'Gemini Cloud LLM (Server Edge Proxy)' : 'Local Intelligent RAG Engine'}.`);
  };

  const handleExportLeadsCSV = () => {
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playSuccessChime();
    const csvContent = AutomationService.exportLeadsToCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `harit_jal_neer_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Neer AI customer leads CSV.');
  };

  const handleRetryPendingSyncs = () => {
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    const count = AutomationService.retryPendingSyncs();
    setLeads(AutomationService.getAllLeads());
    showToast(count > 0 ? `Retried Google Sheets sync for ${count} queued leads.` : 'All leads are already synchronized.');
  };

  const handleSaveAutomationSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageNeerAi) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playSuccessChime();
    AutomationService.saveConfig(automationConfig);
    showToast('Automation & Google Sheets configuration saved.');
  };

  // Gallery Catalog Management Handlers
  const handleOpenAddGalleryModal = () => {
    if (!canManageGallery) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playBubblePop();
    setEditingGalleryItem(null);
    setFormTitle('');
    setFormSubtitle('');
    setFormDescription('');
    setFormImage('/images/bottles/spiral_wave_studio.jpg');
    setFormCategory('glass');
    setFormSize('500ml');
    setFormMaterial('Ultra-Clear Flint Glass');
    setFormCapColor('Champagne Gold');
    setFormWholesaleRate(14);
    setFormRecommendedMRP(40);
    setFormBadge('New Design');
    setFormIsVisible(true);
    setShowAddEditGalleryModal(true);
  };

  const handleOpenEditGalleryModal = (item: GalleryItem) => {
    if (!canManageGallery) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playBubblePop();
    setEditingGalleryItem(item);
    setFormTitle(item.title);
    setFormSubtitle(item.subtitle);
    setFormDescription(item.description);
    setFormImage(item.image);
    setFormCategory(item.category);
    setFormSize(item.size);
    setFormMaterial(item.material);
    setFormCapColor(item.capColor);
    setFormWholesaleRate(item.wholesaleRate || 14);
    setFormRecommendedMRP(item.recommendedMRP || 40);
    setFormBadge(item.badge || '');
    setFormIsVisible(item.isVisible !== false);
    setShowAddEditGalleryModal(true);
  };

  const handleSaveGalleryItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageGallery) {
      denyUnauthorizedAction();
      return;
    }
    if (!formTitle.trim() || !formImage.trim()) {
      alert('Please provide at least a bottle title and image.');
      return;
    }
    soundPlayer.playSuccessChime();

    const sizeLabels: Record<string, string> = {
      '250ml': '250ml Pocket',
      '500ml': '500ml Dine-In Glass',
      '750ml_glass': '750ml Heavy Decanter',
      '1000ml': '1000ml Family Estate',
    };

    if (editingGalleryItem) {
      GalleryService.updateItem(editingGalleryItem.id, {
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        description: formDescription.trim(),
        image: formImage.trim(),
        category: formCategory,
        categories: [formCategory, formSize],
        size: formSize,
        sizeLabel: sizeLabels[formSize] || formSize,
        material: formMaterial.trim(),
        capColor: formCapColor.trim(),
        wholesaleRate: Number(formWholesaleRate) || 0,
        recommendedMRP: Number(formRecommendedMRP) || 0,
        badge: formBadge.trim(),
        isVisible: formIsVisible,
      });
      showToast(`Updated "${formTitle.trim()}" in Gallery.`);
    } else {
      GalleryService.addItem({
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        description: formDescription.trim(),
        image: formImage.trim(),
        category: formCategory,
        categories: [formCategory, formSize],
        size: formSize,
        sizeLabel: sizeLabels[formSize] || formSize,
        material: formMaterial.trim(),
        capColor: formCapColor.trim(),
        wholesaleRate: Number(formWholesaleRate) || 0,
        recommendedMRP: Number(formRecommendedMRP) || 0,
        badge: formBadge.trim(),
        isVisible: formIsVisible,
      });
      showToast(`Added "${formTitle.trim()}" to Gallery.`);
    }

    setGalleryItems(GalleryService.getAllItems());
    setShowAddEditGalleryModal(false);
  };

  const handleToggleGalleryVisibility = (id: string) => {
    if (!canManageGallery) {
      denyUnauthorizedAction();
      return;
    }
    soundPlayer.playWaterDrop();
    const isNowVisible = GalleryService.toggleVisibility(id);
    setGalleryItems(GalleryService.getAllItems());
    showToast(isNowVisible ? 'Product is now visible on live gallery.' : 'Product is now hidden from public customer gallery.');
  };

  const handleDeleteGalleryItem = (id: string) => {
    if (!canManageGallery) {
      denyUnauthorizedAction();
      return;
    }
    if (window.confirm('Are you sure you want to permanently remove this bottle from the gallery?')) {
      soundPlayer.playBubblePop();
      GalleryService.deleteItem(id);
      setGalleryItems(GalleryService.getAllItems());
      showToast('Product removed from gallery.');
    }
  };

  const handleResetGalleryDefaults = () => {
    if (!canManageGallery) {
      denyUnauthorizedAction();
      return;
    }
    if (window.confirm('Reset all gallery products to factory default catalog? Any custom added bottles will be restored to defaults.')) {
      soundPlayer.playWaterDrop();
      GalleryService.resetToDefault();
      setGalleryItems(GalleryService.getAllItems());
      showToast('Gallery catalog restored to factory defaults.');
    }
  };

  const handleGalleryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (.png, .jpg, .jpeg, .webp)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setFormImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const filteredAdminGallery = galleryItems.filter((item) => {
    const matchesCat = galleryCategoryFilter === 'all' || item.category === galleryCategoryFilter || (item.categories && item.categories.includes(galleryCategoryFilter));
    const matchesSearch = gallerySearchTerm === '' ||
      item.title.toLowerCase().includes(gallerySearchTerm.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(gallerySearchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(gallerySearchTerm.toLowerCase()) ||
      item.sizeLabel.toLowerCase().includes(gallerySearchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });


  const filteredKnowledge = knowledgeItems.filter((item) => {
    const matchesCategory = knowledgeCategoryFilter === 'all' || item.category === knowledgeCategoryFilter;
    const matchesSearch = knowledgeSearchTerm === '' ||
      item.title.toLowerCase().includes(knowledgeSearchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(knowledgeSearchTerm.toLowerCase()) ||
      item.keywords.some((kw) => kw.toLowerCase().includes(knowledgeSearchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.restaurantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalVisitors = visitors.reduce((sum, v) => sum + v.visitCount, 0);
  const regularVisitors = visitors.filter((v) => v.isRegular);

  return (
    <div className="min-h-screen w-full bg-[#FFF9EF] text-[#102B46] font-manrope flex flex-col animate-fadeIn">
      <div className="relative w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#455C22] text-[#FFF9EF] font-extrabold text-xs shadow-xl animate-bounce flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#C99B43]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#C99B43]/20 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl border border-[#C99B42]/50 bg-[#FFF9EF] flex items-center justify-center p-1.5 shadow-sm overflow-hidden shrink-0">
              <img 
                src="/images/brand/harit-jal-logo-mark.png" 
                alt="Harit Jal Logo" 
                className="w-full h-full object-contain filter drop-shadow-xs" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold font-playfair text-[#102B46]">
                  Harit Jal Admin & Operations CRM
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#455C22]/10 text-[#455C22] border border-[#455C22]/30 font-mono font-bold">
                  LIVE CRM
                </span>
              </div>
              <p className="text-xs text-[#77766F]">
                Manage call inquiries, visitor records, staff roles & Google Sheets lead synchronization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Active Staff Member Indicator */}
            {effectiveSession && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#102B46]/5 border border-[#102B46]/10 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-[#102B46]">{effectiveSession.name}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#C99B43]/20 text-[#8C6418]">
                  {formatRoleDisplay(effectiveSession.role)}
                </span>
              </div>
            )}

            {/* Super Admin Settings Button (Profile, Contact & Native MFA Status) */}
            {canManageStaff && (
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setShowAdminProfileModal(true);
                }}
                className="px-3 py-1.5 rounded-full bg-[#C99B43]/20 hover:bg-[#C99B43]/30 text-[#8C6418] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-[#C99B43]/40"
                title="Super Admin Profile & Security Status"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#8C6418]" />
                <span>Admin Settings</span>
              </button>
            )}

            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                refreshData();
                showToast('Synced with latest database records.');
              }}
              disabled={isSyncing}
              title={isSyncing ? "Syncing..." : "Refresh All Records"}
              className="p-2 rounded-full text-[#77766F] hover:text-[#102B46] hover:bg-[#F8F3E9] transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#C99B42]' : ''}`} />
            </button>

            {/* Return to Public Website */}
            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                onClose();
              }}
              title="Return to Public Website"
              className="px-3 py-1.5 rounded-full bg-white hover:bg-[#F8F3E9] border border-[#C99B43]/30 text-[#102B46] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Home className="w-3.5 h-3.5 text-[#102B46]" />
              <span className="hidden sm:inline">Public Site</span>
            </button>

            {/* Prominent Admin Logout Button */}
            <button
              onClick={() => {
                soundPlayer.playBubblePop();
                if (onLogout) {
                  onLogout();
                } else {
                  AdminAuthService.logout();
                  if (onClose) onClose();
                }
              }}
              title="Sign Out of Admin Console"
              className="px-3.5 py-1.5 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5 text-white" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Metrics Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-[#C99B43]/20">
          <div className="flex flex-wrap items-center gap-2">
            {canViewBookings && (
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('bookings');
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'bookings'
                    ? 'btn-gold-luxury shadow-sm'
                    : 'bg-[#F8F3E9] text-[#102B46] hover:bg-[#102B46]/10'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Bookings ({bookings.length})</span>
              </button>
            )}

            {canViewVisitors && (
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('visitors');
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'visitors'
                    ? 'btn-gold-luxury shadow-sm'
                    : 'bg-[#F8F3E9] text-[#102B46] hover:bg-[#102B46]/10'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-[#455C22]" />
                <span>Visitor Analytics ({regularVisitors.length} regulars)</span>
              </button>
            )}

            {canManageStaff && (
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('users');
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'users'
                    ? 'btn-gold-luxury shadow-sm'
                    : 'bg-[#F8F3E9] text-[#102B46] hover:bg-[#102B46]/10'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-[#C99B43]" />
                <span>Staff &amp; Access ({users.length})</span>
              </button>
            )}

            {canViewEmailLogs && (
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('email_logs');
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'email_logs'
                    ? 'btn-gold-luxury shadow-sm'
                    : 'bg-[#F8F3E9] text-[#102B46] hover:bg-[#102B46]/10'
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-[#C99B43]" />
                <span>Email & Sheet Logs</span>
              </button>
            )}

            {canManageNeerAi && (
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('neer_ai');
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'neer_ai'
                    ? 'btn-gold-luxury shadow-sm'
                    : 'bg-[#F8F3E9] text-[#102B46] hover:bg-[#102B46]/10'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-[#52652D]" />
                <span>Neer AI 2.0 & Knowledge</span>
              </button>
            )}

            {canManageGallery && (
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('gallery');
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'gallery'
                    ? 'btn-gold-luxury shadow-sm'
                    : 'bg-[#F8F3E9] text-[#102B46] hover:bg-[#102B46]/10'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#C99B43]" />
                <span>Bottle Gallery Manager ({galleryItems.length})</span>
              </button>
            )}
          </div>

          {(canViewBookings || canViewEmailLogs) && (
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 rounded-full bg-[#102B46] hover:bg-[#183C60] text-[#FFF9EF] font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#C99B43]" />
              <span>Export to Google Sheets CSV</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4">

          {!hasAnyWorkspaceTab && (
            <div className="p-8 rounded-2xl bg-white border border-[#C99B43]/30 text-center space-y-2 shadow-sm">
              <ShieldCheck className="w-10 h-10 text-[#C99B43] mx-auto" />
              <h3 className="text-base font-bold font-playfair text-[#102B46]">
                No Workspace Permissions Assigned
              </h3>
              <p className="text-xs text-[#77766F] max-w-md mx-auto">
                Your staff account is verified at AAL2, but no workspace modules have been assigned yet. Please contact the Super Admin to grant access permissions.
              </p>
            </div>
          )}

          {/* TAB 1: CALL BOOKINGS CRM */}
          {activeTab === 'bookings' && canViewBookings && (
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-[#77766F] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search restaurant (e.g. Karan The Dhaba)..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#C99B43]/35 text-[#102B46] text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-[#77766F]">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#C99B43]/35 text-[#102B46] text-xs focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Call Scheduled">Call Scheduled</option>
                    <option value="Sample Dispatched">Sample Dispatched</option>
                    <option value="Active Client">Active Client</option>
                  </select>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="rounded-2xl border border-[#C99B43]/25 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#C99B43]/20 bg-[#F8F3E9] text-[#102B46] uppercase font-bold text-[10.5px]">
                        <th className="py-2.5 px-3">Restaurant & Owner</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Format & Volume</th>
                        <th className="py-2.5 px-3">Scheduled Time</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Assigned Staff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#C99B43]/15 text-[#102B46]">
                      {filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#77766F]">
                            No inquiries match the search filter.
                          </td>
                        </tr>
                      ) : (
                        filteredBookings.map((b) => (
                          <tr key={b.id} className="hover:bg-[#FFF9EF] transition">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-[#102B46] flex items-center gap-1.5 flex-wrap">
                                <Building className="w-3.5 h-3.5 text-[#C99B43]" />
                                <span>{b.restaurantName}</span>
                                {b.source === 'mascot' ? (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#102B46]/10 text-[#102B46]">
                                    🤖 Mascot (Neer)
                                  </span>
                                ) : b.source === 'contact_page' ? (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#52652D]/15 text-[#52652D]">
                                    🌐 Contact Page
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#C99B43]/15 text-[#8A6A23]">
                                    🌐 Website Form
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#77766F]">
                                {b.ownerName} • <span className="text-[#102B46] font-semibold">{b.city}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-mono font-medium">{b.phone}</div>
                              <div className="text-[11px] text-[#77766F]">{b.email}</div>
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-[#102B46]">
                                {b.bottleSize} • {b.monthlyVolume.toLocaleString()} units
                              </div>
                              <div className="text-[10px] text-[#455C22] font-mono">
                                In Google Sheets ✓
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-medium text-[#102B46]">{b.preferredDateTime}</div>
                              <div className="text-[10px] text-[#77766F]">{b.createdAt}</div>
                            </td>

                            <td className="py-2.5 px-3">
                              <select
                                value={b.status}
                                onChange={(e) => handleUpdateStatus(b.id, e.target.value as CallBooking['status'])}
                                className="px-2 py-1 rounded-lg text-[11px] font-bold border border-[#C99B43]/40 bg-[#FFF9EF] text-[#102B46] focus:outline-none"
                              >
                                <option value="New">New (Pending)</option>
                                <option value="Call Scheduled">Call Scheduled (Approved)</option>
                                <option value="Sample Dispatched">Sample Dispatched</option>
                                <option value="Active Client">Active Client</option>
                                <option value="Follow Up">Follow Up</option>
                              </select>

                              {b.status === 'New' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!canViewBookings) {
                                      denyUnauthorizedAction();
                                      return;
                                    }
                                    soundPlayer.playSuccessChime();
                                    const updated = StorageService.approveBooking(b.id, effectiveSession?.name || 'Admin');
                                    setBookings(updated);
                                    if (isSupabaseConfigured()) {
                                      void SupabaseService.updateConsultationStatusInCloud(b.id, 'Call Scheduled');
                                    }
                                    showToast(`Call approved for ${b.restaurantName} at ${b.preferredDateTime}`);
                                  }}
                                  className="mt-1.5 px-2 py-0.5 rounded-md bg-[#52652D] hover:bg-[#3F4F23] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs transition"
                                  title="Approve Call Request"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-[#C99B43]" />
                                  <span>Approve Call</span>
                                </button>
                              ) : (
                                (b.adminApproved || b.status === 'Call Scheduled') && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[9.5px] font-bold text-[#52652D]">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Approved by Admin</span>
                                  </span>
                                )
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <select
                                value={b.assignedTo}
                                onChange={(e) => handleReassignUser(b.id, e.target.value)}
                                className="px-2 py-1 rounded-lg text-[11px] font-medium border border-[#C99B43]/40 bg-white text-[#102B46] focus:outline-none"
                              >
                                {users.map((u) => (
                                  <option key={u.id} value={u.name}>
                                    {u.name} ({formatRoleDisplay(u.role).split(' ')[0]})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VISITOR ANALYTICS & REGULAR USERS */}
          {activeTab === 'visitors' && canViewVisitors && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-[#C99B43]/25 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-[#77766F] block">Total Recorded Visits</span>
                  <span className="text-2xl font-bold font-playfair text-[#102B46]">{totalVisitors}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#C99B43]/25 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-[#77766F] block">Unique Visitor Profiles</span>
                  <span className="text-2xl font-bold font-playfair text-[#102B46]">{visitors.length}</span>
                </div>
                <div className="p-4 rounded-2xl bg-[#455C22]/10 border border-[#455C22]/30 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-[#455C22] block">Repeat / Regular Diners</span>
                  <span className="text-2xl font-bold font-playfair text-[#455C22]">{regularVisitors.length}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#C99B43]/25 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#C99B43]/20 bg-[#F8F3E9] text-[#102B46] uppercase font-bold text-[10.5px]">
                        <th className="py-2.5 px-3">Visitor / Store Owner</th>
                        <th className="py-2.5 px-3">Email Address</th>
                        <th className="py-2.5 px-3">Visits Count</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#C99B43]/15 text-[#102B46]">
                      {visitors.map((v) => (
                        <tr key={v.visitorId} className="hover:bg-[#FFF9EF] transition">
                          <td className="py-2.5 px-3 font-semibold text-[#102B46]">{v.associatedRestaurant || 'Anonymous Visitor'}</td>
                          <td className="py-2.5 px-3 font-mono">{v.associatedEmail || 'Browsing without login'}</td>
                          <td className="py-2.5 px-3 font-bold">{v.visitCount} visits</td>
                          <td className="py-2.5 px-3">
                            {v.isRegular ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#455C22]/15 text-[#455C22] text-[10px] font-bold">
                                ★ REGULAR PARTNER
                              </span>
                            ) : (
                              <span className="text-[#77766F] text-[11px]">First Discovery</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-[#77766F]">{v.lastActive}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STAFF & ROLE MANAGEMENT (Super Admin Only) */}
          {activeTab === 'users' && canManageStaff && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#102B46]">Authorized Team Members</h3>
                  <p className="text-xs text-[#77766F]">
                    Super Admin governance: provision staff, assign workspace permissions, block/unblock, or delete accounts.
                  </p>
                </div>
                <button
                  onClick={() => {
                    soundPlayer.playWaterDrop();
                    setShowStaffManagementModal(true);
                  }}
                  className="px-4 py-2 rounded-full bg-[#102B46] text-[#FFF9EF] text-xs font-bold hover:bg-[#183C60] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#C99B43]" />
                  <span>Manage Team &amp; Add Staff</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {users.map((u) => (
                  <div key={u.id} className="p-4 rounded-2xl bg-white border border-[#C99B43]/25 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-[#102B46]">{u.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFF9EF] text-[#455C22] font-bold border border-[#455C22]/30 shrink-0">
                          {formatRoleDisplay(u.role)}
                        </span>
                      </div>
                      <span className="text-xs text-[#77766F] block mt-1">{u.email}</span>
                      <span className="text-[10px] text-[#77766F] block mt-0.5">
                        Assigned: {u.inquiriesAssigned} leads
                      </span>
                    </div>

                    <div className="pt-3 mt-3 border-t border-[#C99B43]/15 flex items-center justify-between">
                      <span
                        className={`text-[11px] font-semibold ${
                          u.status === 'Blocked' ? 'text-red-600' : 'text-[#455C22]'
                        }`}
                      >
                        {u.status === 'Blocked' ? 'Blocked' : 'Active Access'}
                      </span>
                      {u.isRootSuperAdmin && (
                        <span className="text-[10px] font-bold text-[#8A631E] bg-[#C99B42]/15 px-2 py-0.5 rounded-full">
                          Root Protected
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Staff Security & Governance Audit Trail */}
              <div className="rounded-2xl border border-[#C99B43]/25 overflow-hidden bg-white shadow-sm">
                <div className="p-3.5 bg-[#F8F3E9] border-b border-[#C99B43]/20 flex items-center justify-between">
                  <span className="font-bold text-xs text-[#102B46] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#C99B43]" />
                    <span>Staff Management &amp; Security Audit Trail ({staffAuditLogs.length})</span>
                  </span>
                </div>
                <div className="divide-y divide-[#C99B43]/15 max-h-64 overflow-y-auto">
                  {staffAuditLogs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#77766F]">
                      No staff management audit events recorded yet.
                    </div>
                  ) : (
                    staffAuditLogs.map((log) => (
                      <div key={log.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-[#102B46]/10 text-[#102B46] font-mono text-[10px] font-bold">
                              {log.action}
                            </span>
                            <span className="font-semibold text-[#102B46]">{log.targetUserEmail}</span>
                          </div>
                          <p className="text-[11px] text-[#77766F] mt-0.5">{log.details}</p>
                        </div>
                        <div className="text-left sm:text-right text-[10.5px] text-[#77766F] shrink-0">
                          <div>By: <strong className="text-[#102B46]">{log.performedBy}</strong></div>
                          <div className="font-mono">{log.timestamp.replace('T', ' ').substring(0, 16)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EMAIL & SHEETS LOGS */}
          {activeTab === 'email_logs' && canViewEmailLogs && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white border border-[#C99B43]/25 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-[#455C22]" />
                    <h3 className="text-sm font-bold text-[#102B46]">Server-Side Google Sheets CRM &amp; Email Dispatch</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      integrationStatus?.sheetsWebhookConfigured
                        ? 'bg-[#455C22]/10 text-[#455C22] border-[#455C22]/30'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {integrationStatus === null
                        ? 'Edge Status: Local / Unchecked'
                        : integrationStatus.sheetsWebhookConfigured
                          ? 'Webhook Secret: Configured Server-Side'
                          : 'Webhook Secret: Not Set on Edge Server'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      integrationStatus?.resendConfigured
                        ? 'bg-[#455C22]/10 text-[#455C22] border-[#455C22]/30'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {integrationStatus === null
                        ? 'Resend API: Local Mode'
                        : integrationStatus.resendConfigured
                          ? 'Resend Key: Active on Edge Server'
                          : 'Resend Key: Missing Secret'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[#77766F]">
                  All Google Apps Script webhook URLs, webhook signing secrets, and Resend API keys are stored exclusively in Supabase Edge Function secrets (<code className="font-mono text-[#102B46]">crm-sync</code> / <code className="font-mono text-[#102B46]">send-email-otp</code>) — never in browser storage or bundles.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-[#455C22] font-bold">
                    {sheetsConfig.autoSync ? '✓ Client Auto-Sync Requests Enabled' : 'Offline / Manual CSV Export Only'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleSheetsAutoSync(!sheetsConfig.autoSync)}
                    className="px-4 py-2 rounded-full bg-[#102B46] text-[#FFF9EF] text-xs font-bold hover:bg-[#183C60] transition cursor-pointer"
                  >
                    {sheetsConfig.autoSync ? 'Pause Auto-Sync' : 'Enable Auto-Sync'}
                  </button>
                </div>
              </div>

              {/* Email dispatch logs */}
              <div className="rounded-2xl border border-[#C99B43]/25 overflow-hidden bg-white shadow-sm">
                <div className="p-3 bg-[#F8F3E9] border-b border-[#C99B43]/20 font-bold text-xs text-[#102B46]">
                  Cloud &amp; Local Notification Dispatch Trail ({emailLogs.length})
                </div>
                <div className="divide-y divide-[#C99B43]/15 max-h-60 overflow-y-auto">
                  {emailLogs.map((log) => (
                    <div key={log.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-[#102B46]">{log.subject}</div>
                        <div className="text-[11px] text-[#77766F]">To: {log.recipient} • {log.sentAt}</div>
                      </div>
                      {(() => {
                        const statusLabel = log.status || 'Dispatched';
                        const lower = statusLabel.toLowerCase();
                        const badgeClass =
                          lower.includes('fail') || lower.includes('error') || lower.includes('reject')
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : lower.includes('simulat') || lower.includes('pend') || lower.includes('queue') || lower.includes('block')
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-[#455C22]/10 text-[#455C22]';
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold self-start sm:self-auto ${badgeClass}`}>
                            {statusLabel}
                          </span>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NEER AI 2.0 & KNOWLEDGE MANAGEMENT */}
          {activeTab === 'neer_ai' && canManageNeerAi && (
            <div className="space-y-6">
              
              {/* Analytics Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-[#C99B43]/25 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#77766F] uppercase">Chat Sessions</span>
                    <Bot className="w-4 h-4 text-[#52652D]" />
                  </div>
                  <div className="text-2xl font-bold font-playfair text-[#102B46]">
                    {neerAnalytics.totalSessions}
                  </div>
                  <div className="text-[10.5px] text-[#52652D] font-semibold mt-1">
                    {neerAnalytics.totalMessages} assistant messages handled
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#C99B43]/25 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#77766F] uppercase">Captured Leads</span>
                    <Users className="w-4 h-4 text-[#C99B43]" />
                  </div>
                  <div className="text-2xl font-bold font-playfair text-[#102B46]">
                    {leads.length}
                  </div>
                  <div className="text-[10px] text-[#77766F] mt-1">
                    {leads.filter(l => l.googleSheetsStatus === 'Synced').length} synced to Google Sheets
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#C99B43]/25 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#77766F] uppercase">Top Intent</span>
                    <Activity className="w-4 h-4 text-[#C99B43]" />
                  </div>
                  <div className="text-sm font-bold text-[#102B46]">
                    Pricing & Customization
                  </div>
                  <div className="text-[10px] text-[#77766F] mt-1">
                    Pricing: {neerAnalytics.frequentIntents.pricing || 0} • Studio: {neerAnalytics.frequentIntents.customization || 0}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#C99B43]/25 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#77766F] uppercase">Assisted Conversions</span>
                    <CheckCircle2 className="w-4 h-4 text-[#52652D]" />
                  </div>
                  <div className="text-xs font-semibold text-[#102B46] space-y-0.5">
                    <div>Gallery Clicks: <span className="font-bold text-[#52652D]">{neerAnalytics.conversions.studioClicks}</span></div>
                    <div>Consultation Clicks: <span className="font-bold text-[#C99B43]">{neerAnalytics.conversions.consultationClicks}</span></div>
                  </div>
                </div>
              </div>

              {/* Customer Leads & Automation Captured by Neer AI */}
              <div className="rounded-2xl border border-[#C99B43]/25 overflow-hidden bg-white shadow-sm space-y-0">
                <div className="p-4 bg-[#F8F3E9] border-b border-[#C99B43]/25 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#C99B43]" />
                      <h3 className="text-sm font-bold text-[#102B46]">
                        Customer Enquiries & Captured Leads ({leads.length})
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-[#52652D]/10 text-[#52652D] text-[10px] font-bold border border-[#52652D]/20">
                        {leads.filter(l => l.googleSheetsStatus === 'Synced').length} Synced
                      </span>
                      {leads.some(l => l.googleSheetsStatus === 'Pending') && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 text-[10px] font-bold border border-amber-500/20">
                          {leads.filter(l => l.googleSheetsStatus === 'Pending').length} Pending Sync
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#77766F] mt-0.5">
                      Progressive multi-turn conversational leads captured from website visitors with automated CRM integration.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleRetryPendingSyncs}
                      className="px-3 py-1.5 rounded-full border border-[#C99B43]/40 text-[#102B46] hover:bg-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="Retry pending Google Sheets syncs"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-[#C99B43]" />
                      <span>Retry Sync</span>
                    </button>

                    <button
                      onClick={handleExportLeadsCSV}
                      className="btn-gold-luxury px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Download Google Sheets compatible CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Leads CSV</span>
                    </button>
                  </div>
                </div>

                {/* Leads List / Table */}
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full min-w-[720px] text-left text-xs border-collapse">
                    <thead className="bg-[#FFF9EF] text-[#77766F] uppercase text-[10px] font-bold tracking-wider border-b border-[#C99B43]/15 sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        <th className="p-3">Lead ID & Date</th>
                        <th className="p-3">Customer & Business</th>
                        <th className="p-3">Contact</th>
                        <th className="p-3">Bottle Specs & Volume</th>
                        <th className="p-3">Conversation Summary</th>
                        <th className="p-3">Google Sheets</th>
                        <th className="p-3">Alerts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#C99B43]/15 text-[#102B46]">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-[#FFF9EF]/60 transition">
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-[#102B46]">{lead.id}</span>
                            <div className="text-[10px] text-[#77766F]">{lead.createdDate}</div>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#102B46]/10 text-[#102B46] text-[9.5px] font-bold">
                              {lead.leadStatus}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-[#102B46]">{lead.businessName || 'Business Pending'}</div>
                            <div className="text-[11px] text-[#52652D] font-medium">{lead.customerName}</div>
                            <div className="text-[10px] text-[#77766F]">{lead.businessCategory} • {lead.location}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-mono text-[11px] text-[#102B46]">{lead.email}</div>
                            <div className="text-[10.5px] text-[#77766F]">{lead.phone || 'Phone pending'}</div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-semibold text-[#102B46]">{lead.bottleSize} • {lead.bottleMaterial}</div>
                            <div className="text-[10.5px] text-[#C99B43] font-bold">{lead.estimatedQuantity}</div>
                          </td>
                          <td className="p-3 max-w-xs text-[11px] text-[#2C3E50]">
                            <div className="line-clamp-2" title={lead.conversationSummary}>
                              {lead.conversationSummary || lead.customerRequirements}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                              lead.googleSheetsStatus === 'Synced'
                                ? 'bg-[#52652D]/15 text-[#52652D]'
                                : 'bg-amber-500/15 text-amber-800'
                            }`}>
                              {lead.googleSheetsStatus === 'Synced' ? (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Synced</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>Pending</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap space-y-1">
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-[#77766F]">Admin:</span>
                              <span className={`font-bold ${lead.adminNotificationStatus === 'Sent' ? 'text-[#52652D]' : 'text-amber-700'}`}>
                                {lead.adminNotificationStatus}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-[#77766F]">Customer:</span>
                              <span className={`font-bold ${lead.customerConfirmationStatus === 'Sent' ? 'text-[#52652D]' : 'text-amber-700'}`}>
                                {lead.customerConfirmationStatus}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {leads.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-[#77766F] text-xs">
                            No customer leads captured yet. As customers chat with Neer AI, inquiries will automatically appear and sync here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Google Sheets & Email Automation Settings */}
              <div className="p-5 rounded-2xl bg-white border border-[#C99B43]/25 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#C99B43]/20">
                  <div>
                    <h3 className="text-sm font-bold text-[#102B46] flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#C99B43]" />
                      <span>Google Sheets & Admin Automation Settings</span>
                    </h3>
                    <p className="text-xs text-[#77766F]">
                      Configure destination admin email, Google Sheets spreadsheet ID, and live webhook URL for automated lead routing.
                    </p>
                  </div>
                  {automationConfig.lastSheetsSyncTime && (
                    <span className="text-[10px] text-[#52652D] font-mono bg-[#52652D]/10 px-2.5 py-1 rounded-full border border-[#52652D]/20">
                      Last Live Sync: {automationConfig.lastSheetsSyncTime}
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveAutomationSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-xs font-semibold text-[#102B46] mb-1">
                      HARIT_JAL_ADMIN_EMAIL (Admin Alert Recipient)
                    </label>
                    <input
                      type="email"
                      value={automationConfig.adminEmail}
                      onChange={(e) => setAutomationConfig({ ...automationConfig, adminEmail: e.target.value })}
                      placeholder="info@haritjal.in"
                      className="w-full px-3 py-2 rounded-xl bg-[#F8F3E9] border border-[#C99B43]/30 text-xs font-mono text-[#102B46] focus:outline-none"
                    />
                    <span className="text-[10px] text-[#77766F] mt-0.5 block">
                      Receives full customer enquiry details, bottle specifications, and conversation summaries.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#102B46] mb-1">
                      EMAIL_FROM_ADDRESS (Customer Acknowledgment Sender)
                    </label>
                    <input
                      type="email"
                      value={automationConfig.emailFromAddress}
                      onChange={(e) => setAutomationConfig({ ...automationConfig, emailFromAddress: e.target.value })}
                      placeholder="info@haritjal.in"
                      className="w-full px-3 py-2 rounded-xl bg-[#F8F3E9] border border-[#C99B43]/30 text-xs font-mono text-[#102B46] focus:outline-none"
                    />
                    <span className="text-[10px] text-[#77766F] mt-0.5 block">
                      Shown as the hospitality partnership desk sender in confirmation emails.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#102B46] mb-1">
                      GOOGLE_SHEETS_SPREADSHEET_ID
                    </label>
                    <input
                      type="text"
                      value={automationConfig.googleSheetsSpreadsheetId}
                      onChange={(e) => setAutomationConfig({ ...automationConfig, googleSheetsSpreadsheetId: e.target.value })}
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                      className="w-full px-3 py-2 rounded-xl bg-[#F8F3E9] border border-[#C99B43]/30 text-xs font-mono text-[#102B46] focus:outline-none"
                    />
                    <span className="text-[10px] text-[#77766F] mt-0.5 block">
                      Target Google Sheet: "Harit Jal — Customer Enquiries & Leads" (18 tracking columns).
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8F3E9] border border-[#C99B43]/30 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#102B46]">
                        Google Sheets Webhook &amp; Signing Secret (Edge Managed)
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        integrationStatus?.sheetsWebhookConfigured
                          ? 'bg-[#52652D]/15 text-[#52652D]'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {integrationStatus?.sheetsWebhookConfigured ? 'CONFIGURED' : 'SERVER SECRET'}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#77766F] leading-relaxed">
                      Configured exclusively via Supabase Edge Function secrets for <code className="font-mono text-[#102B46]">crm-sync</code>. Never entered or persisted in the browser.
                    </p>
                  </div>

                  <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#C99B43]/15">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={automationConfig.googleSheetsAutoSync}
                        onChange={(e) => setAutomationConfig({ ...automationConfig, googleSheetsAutoSync: e.target.checked })}
                        className="rounded accent-[#C99B43] w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-[#102B46]">
                        Enable automatic background synchronization to Google Sheets
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="btn-gold-luxury px-5 py-2 rounded-full font-bold text-xs shadow-md transition cursor-pointer self-start sm:self-auto"
                    >
                      Save Automation Settings
                    </button>
                  </div>
                </form>
              </div>

              {/* AI Engine & Security Settings */}
              <div className="p-5 rounded-2xl bg-white border border-[#C99B43]/25 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#C99B43]/20">
                  <div>
                    <h3 className="text-sm font-bold text-[#102B46] flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#C99B43]" />
                      <span>Neer AI Architecture & Security Settings</span>
                    </h3>
                    <p className="text-xs text-[#77766F]">
                      Controls intelligence provider, strict prompt injection filtering, and RAG knowledge retrieval.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#52652D]/10 text-[#52652D] text-[10.5px] font-bold border border-[#52652D]/30 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Prompt Injection Guard: ACTIVE</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#F8F3E9] border border-[#C99B43]/25 space-y-2">
                    <div className="font-bold text-[#102B46]">Active Intelligence Provider</div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="ai_provider"
                          checked={neerConfig.provider === 'local'}
                          onChange={() => handleSaveAIConfig('local')}
                          className="accent-[#C99B43]"
                        />
                        <span>Local Semantic RAG Engine (Zero API Dependency)</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="ai_provider"
                          checked={neerConfig.provider === 'gemini'}
                          onChange={() => handleSaveAIConfig('gemini')}
                          className="accent-[#C99B43]"
                        />
                        <span>Google Gemini 2.0 Flash Cloud LLM</span>
                      </label>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F8F3E9] border border-[#C99B43]/25 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-[#102B46]">Cloud LLM Edge Proxy Status</div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        integrationStatus?.geminiConfigured
                          ? 'bg-[#52652D]/15 text-[#52652D]'
                          : 'bg-[#102B46]/10 text-[#102B46]'
                      }`}>
                        {integrationStatus?.geminiConfigured ? 'GEMINI SECRET ACTIVE' : 'SERVER SECRET ONLY'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#77766F] leading-relaxed">
                      When Gemini Cloud LLM is selected, requests route through the server-side <code className="font-mono text-[#102B46]">crm-sync</code> Edge Function using its protected server secret.
                    </p>
                    <span className="text-[10px] text-[#77766F] block">
                      Configured exclusively in Supabase Edge Function secrets. No AI keys are ever stored in browser storage or bundles.
                    </span>
                  </div>
                </div>
              </div>

              {/* Centralized Knowledge Base Management */}
              <div className="rounded-2xl border border-[#C99B43]/25 overflow-hidden bg-white shadow-sm">
                
                {/* Knowledge Header Controls */}
                <div className="p-4 bg-[#F8F3E9] border-b border-[#C99B43]/25 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#C99B43]" />
                    <h3 className="text-sm font-bold text-[#102B46]">
                      Verified Knowledge Base ({knowledgeItems.length} entries)
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#77766F] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search knowledge..."
                        value={knowledgeSearchTerm}
                        onChange={(e) => setKnowledgeSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102B46] focus:outline-none w-40 sm:w-48"
                      />
                    </div>

                    {/* Category Filter */}
                    <select
                      value={knowledgeCategoryFilter}
                      onChange={(e) => setKnowledgeCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102B46] focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      <option value="product">Products & Sizes</option>
                      <option value="pricing">Pricing & Margins</option>
                      <option value="customization">Bottle &amp; Customization</option>
                      <option value="supply">Supply & Delivery</option>
                      <option value="compliance">BIS & FSSAI Legal</option>
                      <option value="general">General & FAQs</option>
                    </select>

                    <button
                      onClick={() => setShowAddKnowledgeModal(true)}
                      className="btn-gold-luxury px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Knowledge</span>
                    </button>

                    <button
                      onClick={handleSyncCatalogToKnowledge}
                      className="px-3 py-1.5 rounded-full border border-[#52652D]/40 text-[#52652D] hover:bg-[#52652D]/10 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      title="Auto-train Neer AI with all products, sizes and rates from the Bottle Gallery"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#52652D]" />
                      <span>Auto-Train Catalog</span>
                    </button>

                    <button
                      onClick={handleResetKnowledge}
                      className="px-3 py-1.5 rounded-full border border-[#C99B43]/40 text-[#102B46] hover:bg-white text-xs font-semibold transition cursor-pointer"
                      title="Reset all knowledge to verified Harit Jal defaults"
                    >
                      Reset Defaults
                    </button>
                  </div>
                </div>

                {/* Knowledge Items Table / List */}
                <div className="divide-y divide-[#C99B43]/15 max-h-[380px] overflow-y-auto">
                  {filteredKnowledge.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-[#FFF9EF]/60 transition flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                      <div className="space-y-1.5 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-[#102B46] font-playfair">{item.title}</span>
                          <span className="px-2 py-0.2 rounded-full bg-[#C99B43]/15 text-[#102B46] text-[10px] font-bold uppercase">
                            {item.category}
                          </span>
                          <span className="px-2 py-0.2 rounded-full bg-[#52652D]/10 text-[#52652D] text-[10px] font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        </div>
                        <p className="text-[#2C3E50] leading-relaxed">
                          {item.content}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-[#77766F] pt-1">
                          <span>Source: <strong className="text-[#102B46]">{item.source}</strong></span>
                          <span>•</span>
                          <span>Updated: {item.lastUpdated}</span>
                          <span>•</span>
                          <span>Keywords: {item.keywords.slice(0, 4).join(', ')}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto">
                        <button
                          onClick={() => handleDeleteKnowledge(item.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition cursor-pointer"
                          title="Delete knowledge item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredKnowledge.length === 0 && (
                    <div className="p-8 text-center text-[#77766F] text-xs">
                      No knowledge items matched your search.
                    </div>
                  )}
                </div>

              </div>

              {/* Neer AI Self-Training & Visitor Queries Queue */}
              <div className="rounded-2xl border border-[#C99B43]/25 overflow-hidden bg-white shadow-sm space-y-3">
                <div className="p-4 bg-[#F8F3E9] border-b border-[#C99B43]/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#C99B43]" />
                    <div>
                      <h3 className="text-sm font-bold text-[#102B46] flex items-center gap-2">
                        <span>Neer AI Self-Training & Customer Inquiries Queue</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#C99B43]/20 text-[#102B46] text-[10px] font-bold">
                          {neerAnalytics.unansweredQueries?.length || 0} Inquiries Logged
                        </span>
                      </h3>
                      <p className="text-[11px] text-[#77766F]">
                        Review questions asked by website visitors and train Neer in 1-click so the AI learns continuously.
                      </p>
                    </div>
                  </div>

                  {neerAnalytics.unansweredQueries && neerAnalytics.unansweredQueries.length > 0 && (
                    <button
                      onClick={() => {
                        NeerAIService.clearUnansweredQueries();
                        setNeerAnalytics(NeerAIService.getAnalytics());
                        showToast('Training queue cleared.');
                      }}
                      className="px-3 py-1 rounded-full border border-red-300 text-red-600 hover:bg-red-50 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Clear Queue
                    </button>
                  )}
                </div>

                <div className="p-4 pt-1">
                  {neerAnalytics.unansweredQueries && neerAnalytics.unansweredQueries.length > 0 ? (
                    <div className="divide-y divide-[#C99B43]/15 max-h-[260px] overflow-y-auto">
                      {neerAnalytics.unansweredQueries.map((item, idx) => (
                        <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="font-bold text-[#102B46] flex items-center gap-2">
                              <span>&ldquo;{item.query}&rdquo;</span>
                              <span className="px-2 py-0.2 rounded-full bg-[#102B46]/10 text-[#102B46] text-[9.5px] uppercase font-semibold">
                                {item.language}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#77766F]">
                              Logged: {new Date(item.timestamp).toLocaleString('en-IN')}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              onClick={() => handleTrainFromQuery(item.query)}
                              className="btn-gold-luxury px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              title="Train Neer with an answer to this query"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Train Neer</span>
                            </button>
                            <button
                              onClick={() => handleDismissQuery(idx)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                              title="Dismiss from queue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-[#77766F] text-xs space-y-1">
                      <div className="font-semibold text-[#52652D] flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#52652D]" />
                        <span>Training Queue Clean & Active</span>
                      </div>
                      <p className="text-[11px] text-[#77766F]">
                        Neer AI is continuously learning from the live Bottle Gallery catalog and verified knowledge items.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB: BOTTLE GALLERY CATALOG MANAGER */}
          {activeTab === 'gallery' && canManageGallery && (
            <div className="space-y-6">

              {/* Header Strip with Stats & Actions */}
              <div className="p-5 rounded-2xl bg-white border border-[#C99B43]/35 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-[#C99B43]" />
                    <h3 className="font-bold text-base text-[#102C47] font-playfair">
                      Product Gallery &amp; Bottle Catalog Manager
                    </h3>
                  </div>
                  <p className="text-xs text-[#77766F] mt-1 max-w-2xl">
                    Add new bottle designs, upload real product photography, edit descriptions &amp; prices, toggle public visibility (hide/show), or delete products. Any change updates the live customer gallery instantly.
                  </p>

                  <div className="flex items-center gap-2 pt-2.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#102C47]/10 text-[#102C47] text-[10.5px] font-bold">
                      {galleryItems.length} Total Bottles
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#52652D]/15 text-[#52652D] text-[10.5px] font-bold flex items-center gap-1">
                      <Eye className="w-3 h-3 text-[#52652D]" />
                      <span>{galleryItems.filter((i) => i.isVisible !== false).length} Live on Website</span>
                    </span>
                    {galleryItems.some((i) => i.isVisible === false) && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-bold flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        <span>{galleryItems.filter((i) => i.isVisible === false).length} Hidden</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                  <button
                    onClick={handleOpenAddGalleryModal}
                    className="btn-gold-luxury px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Bottle</span>
                  </button>

                  <button
                    onClick={handleResetGalleryDefaults}
                    className="p-2 rounded-xl bg-[#F8F3E9] hover:bg-[#102C47]/10 text-[#102C47] border border-[#C99B43]/30 text-xs font-bold transition cursor-pointer"
                    title="Reset gallery catalogue to original factory defaults"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#C99B43]" />
                  </button>
                </div>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#C99B43]/25 shadow-xs">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-[#77766F] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={gallerySearchTerm}
                    onChange={(e) => setGallerySearchTerm(e.target.value)}
                    placeholder="Search bottles by title, format, or keyword..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#F8F3E9]/50 border border-[#C99B43]/30 text-[#102C47] text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-[#77766F] shrink-0">Filter Category:</span>
                  <select
                    value={galleryCategoryFilter}
                    onChange={(e) => setGalleryCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-[#F8F3E9]/50 border border-[#C99B43]/30 text-[#102C47] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Categories ({galleryItems.length})</option>
                    <option value="glass">Flint Glass</option>
                    <option value="banquet">Luxury Banquets</option>
                    <option value="finedining">Fine Dining</option>
                    <option value="dhaba">Dhabas &amp; Highway</option>
                    <option value="cafe">Artisanal Cafes</option>
                    <option value="pet">Recyclable rPET</option>
                  </select>
                </div>
              </div>

              {/* Gallery Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                {filteredAdminGallery.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 ${
                      item.isVisible === false
                        ? 'bg-gray-50/90 border-gray-300 opacity-75'
                        : 'bg-white border-[#C99B43]/35 shadow-sm hover:border-[#C99B43]'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Image & Badges */}
                      <div className="relative w-full aspect-[4/3] rounded-xl bg-gradient-to-b from-[#F7F2EA] to-[#EBE0D3] overflow-hidden flex items-center justify-center p-3 border border-[#C99B43]/20">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-contain filter drop-shadow-md"
                        />

                        {/* Visibility Status Badge */}
                        <div className="absolute top-2 left-2 z-10">
                          {item.isVisible !== false ? (
                            <span className="px-2 py-0.5 rounded-full bg-[#52652D] text-white text-[9.5px] font-bold shadow-xs flex items-center gap-1">
                              <Eye className="w-2.5 h-2.5" />
                              <span>Live</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-gray-700 text-white text-[9.5px] font-bold shadow-xs flex items-center gap-1">
                              <EyeOff className="w-2.5 h-2.5" />
                              <span>Hidden</span>
                            </span>
                          )}
                        </div>

                        {/* Size Badge */}
                        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-[#102C47] text-[#FFF9EF] text-[9.5px] font-bold">
                          {item.sizeLabel}
                        </div>
                      </div>

                      {/* Details */}
                      <div>
                        {item.badge && (
                          <span className="text-[9.5px] uppercase font-bold text-[#52652D] tracking-wider block">
                            {item.badge}
                          </span>
                        )}
                        <h4 className="font-bold text-base text-[#102C47] font-playfair tracking-tight">
                          {item.title}
                        </h4>
                        <p className="text-xs text-[#C99B43] font-medium truncate">
                          {item.subtitle}
                        </p>
                      </div>

                      <p className="text-xs text-[#77766F] line-clamp-2">
                        {item.description}
                      </p>

                      <div className="pt-2 border-t border-[#C99B43]/15 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-[#77766F]">
                          Est: <strong className="text-[#102C47]">₹{item.wholesaleRate || '14'}</strong>
                        </span>
                        <span className="text-[11px] text-[#77766F]">
                          MRP: <strong className="text-[#52652D]">₹{item.recommendedMRP || '40'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="pt-3 mt-3 border-t border-[#C99B43]/20 flex items-center justify-between gap-1">
                      {/* Hide/Show Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleGalleryVisibility(item.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                          item.isVisible !== false
                            ? 'bg-[#F8F3E9] text-[#77766F] hover:text-[#102C47] hover:bg-[#C99B42]/20'
                            : 'bg-[#52652D]/15 text-[#52652D] hover:bg-[#52652D]/25'
                        }`}
                        title={item.isVisible !== false ? 'Hide this product from customers' : 'Show this product to customers'}
                      >
                        {item.isVisible !== false ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-[#52652D]" />
                            <span>Show Live</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditGalleryModal(item)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#F8F3E9] hover:bg-[#C99B42]/20 text-[#102C47] text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                          title="Edit bottle details"
                        >
                          <Pencil className="w-3 h-3 text-[#C99B43]" />
                          <span>Edit</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteGalleryItem(item.id)}
                          className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 transition cursor-pointer"
                          title="Delete bottle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredAdminGallery.length === 0 && (
                <div className="p-12 text-center bg-white rounded-2xl border border-[#C99B43]/30 text-xs text-[#77766F] space-y-2">
                  <p>No bottles found matching your search or category filter.</p>
                  <button
                    onClick={() => {
                      setGallerySearchTerm('');
                      setGalleryCategoryFilter('all');
                    }}
                    className="btn-gold-luxury px-3.5 py-1 rounded-full text-xs font-bold cursor-pointer"
                  >
                    Clear Filter
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* Add Knowledge Base Modal */}
      {showAddKnowledgeModal && canManageNeerAi && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleAddKnowledge} className="w-full max-w-lg rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/45 p-6 space-y-4 shadow-2xl text-[#102B46] font-manrope">
            <div className="flex items-center justify-between pb-2 border-b border-[#C99B43]/20">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#C99B43]" />
                <h3 className="font-bold text-base text-[#102B46] font-playfair">Add Verified Knowledge / FAQ</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddKnowledgeModal(false)}
                className="text-[#77766F] hover:text-[#102B46]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">Title / Question</label>
                <input
                  type="text"
                  required
                  value={newKbTitle}
                  onChange={(e) => setNewKbTitle(e.target.value)}
                  placeholder="e.g. 500ml Glass Minimum Order"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102B46] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">Category</label>
                <select
                  value={newKbCategory}
                  onChange={(e) => setNewKbCategory(e.target.value as KnowledgeItem['category'])}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102B46] focus:outline-none cursor-pointer"
                >
                  <option value="product">Products & Sizes</option>
                  <option value="pricing">Pricing & Margins</option>
                  <option value="customization">Bottle &amp; Customization</option>
                  <option value="supply">Supply & Delivery</option>
                  <option value="compliance">BIS & FSSAI Legal</option>
                  <option value="general">General & FAQs</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">Keywords (comma-separated)</label>
              <input
                type="text"
                value={newKbKeywords}
                onChange={(e) => setNewKbKeywords(e.target.value)}
                placeholder="500ml, moq, trial, crate, order"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102B46] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">Verified Information Content</label>
              <textarea
                required
                rows={4}
                value={newKbContent}
                onChange={(e) => setNewKbContent(e.target.value)}
                placeholder="Detailed, accurate information that Neer AI should communicate to customers..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102B46] focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">Source Reference</label>
              <input
                type="text"
                value={newKbSource}
                onChange={(e) => setNewKbSource(e.target.value)}
                placeholder="e.g. Harit Jal Commercial Tariff 2026"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102B46] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="btn-gold-luxury w-full py-2.5 rounded-full font-bold text-xs shadow-md transition cursor-pointer"
            >
              Save to Neer Knowledge Base
            </button>
          </form>
        </div>
      )}

      {/* Add / Edit Bottle Gallery Modal */}
      {showAddEditGalleryModal && canManageGallery && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleSaveGalleryItem}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/45 p-6 space-y-4 shadow-2xl text-[#102C47] font-manrope"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#C99B43]/20">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#C99B43]" />
                <h3 className="font-bold text-lg text-[#102C47] font-playfair">
                  {editingGalleryItem ? 'Edit Bottle in Gallery' : 'Add New Bottle to Gallery'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEditGalleryModal(false)}
                className="text-[#77766F] hover:text-[#102C47]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Title & Subtitle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">
                  Bottle Name / Title
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Spiral Fluted Carafe 500ml"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">
                  Subtitle / Dining Placement
                </label>
                <input
                  type="text"
                  required
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="e.g. Murthal Highway Dining & Premium Dhabas"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none"
                />
              </div>
            </div>

            {/* Size, Category, Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">
                  Bottle Format &amp; Size
                </label>
                <select
                  value={formSize}
                  onChange={(e) => setFormSize(e.target.value as GalleryItem['size'])}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none cursor-pointer"
                >
                  <option value="250ml">250ml Pocket</option>
                  <option value="500ml">500ml Dine-In</option>
                  <option value="750ml_glass">750ml Decanter</option>
                  <option value="1000ml">1000ml Family</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">
                  Hospitality Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as GalleryItem['category'])}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none cursor-pointer"
                >
                  <option value="glass">Flint Glass</option>
                  <option value="banquet">Luxury Banquets</option>
                  <option value="finedining">Fine Dining</option>
                  <option value="dhaba">Dhabas &amp; Highway</option>
                  <option value="cafe">Artisanal Cafes</option>
                  <option value="pet">Recyclable rPET</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">
                  Special Badge (Optional)
                </label>
                <input
                  type="text"
                  value={formBadge}
                  onChange={(e) => setFormBadge(e.target.value)}
                  placeholder="e.g. Signature, Bestseller"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none"
                />
              </div>
            </div>

            {/* Material & Cap Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">
                  Glass Material / Spec
                </label>
                <input
                  type="text"
                  value={formMaterial}
                  onChange={(e) => setFormMaterial(e.target.value)}
                  placeholder="e.g. Ultra-Clear Flint Glass"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">
                  Metallic Cap Color &amp; Finish
                </label>
                <input
                  type="text"
                  value={formCapColor}
                  onChange={(e) => setFormCapColor(e.target.value)}
                  placeholder="e.g. Champagne Gold, Royal Navy"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#77766F] mb-1">
                    Est. Wholesale Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formWholesaleRate}
                    onChange={(e) => setFormWholesaleRate(Number(e.target.value))}
                    placeholder="14.0"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#77766F] mb-1">
                    Recommended Menu MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formRecommendedMRP}
                    onChange={(e) => setFormRecommendedMRP(Number(e.target.value))}
                    placeholder="40.0"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-[#77766F] pt-0.5">
                * Note: Rates are indicative wholesale benchmarks. The public gallery displays standard T&amp;C stating delivery &amp; freight charges are separate and vary by distance/location.
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                Product Description &amp; Hospitality Details
              </label>
              <textarea
                required
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Highlight glass thickness, reflection, dining table elegance, and hospitality benefits..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none resize-none"
              />
            </div>

            {/* Bottle Photograph (File Upload OR Image URL) */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#C99B43]/25 space-y-2.5">
              <label className="block text-xs font-semibold text-[#102C47]">
                Bottle Photograph (Upload File or Enter Image URL)
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="btn-gold-luxury px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGalleryImageUpload}
                    className="hidden"
                  />
                </label>

                <span className="text-xs text-[#77766F] font-semibold">OR</span>

                <input
                  type="text"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  placeholder="Paste image URL (e.g. /images/bottles/... or https://...)"
                  className="flex-1 w-full px-3 py-2 rounded-xl bg-[#F8F3E9]/50 border border-[#C99B43]/30 text-xs text-[#102C47] focus:outline-none"
                />
              </div>

              {/* Image Preview Box */}
              {formImage && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-16 h-20 rounded-xl bg-[#F8F3E9] overflow-hidden border border-[#C99B43]/30 flex items-center justify-center p-1">
                    <img
                      src={formImage}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-xs text-[#52652D] font-semibold">
                    ✓ Photo preview verified
                  </span>
                </div>
              )}
            </div>

            {/* Visibility Toggle Checkbox */}
            <label className="flex items-center gap-2 text-xs font-semibold text-[#102C47] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={formIsVisible}
                onChange={(e) => setFormIsVisible(e.target.checked)}
                className="w-4 h-4 rounded text-[#C99B42] accent-[#C99B42] cursor-pointer"
              />
              <span>Display this bottle immediately on the live customer gallery</span>
            </label>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="btn-gold-luxury w-full py-3 rounded-full font-bold text-xs shadow-md transition cursor-pointer"
              >
                {editingGalleryItem ? 'Save Bottle Updates' : 'Add Bottle to Live Gallery'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff & Access Management Modal (Super Admin Only - Server Enforced AAL2) */}
      {showStaffManagementModal && canManageStaff && (() => {
        if (!effectiveSession) return null;
        const resolvedCurrentAdmin: AdminUser =
          users.find(
            (u) =>
              u.id === effectiveSession.adminId ||
              u.email.toLowerCase() === effectiveSession.email.toLowerCase()
          ) || {
            id: effectiveSession.adminId,
            name: effectiveSession.name,
            email: effectiveSession.email,
            phone: effectiveSession.phone || '',
            role: effectiveSession.role,
            designation: effectiveSession.designation || formatRoleDisplay(effectiveSession.role),
            permissions: effectiveSession.permissions || [],
            status: 'Active',
            inquiriesAssigned: 0,
            isRootSuperAdmin: effectiveSession.isRootSuperAdmin === true,
            totpEnabled: effectiveSession.authLevel === 'aal2',
          };

        return (
          <StaffManagementModal
            isOpen={showStaffManagementModal}
            currentUser={resolvedCurrentAdmin}
            onClose={() => setShowStaffManagementModal(false)}
            onRefresh={refreshData}
          />
        );
      })()}

      {/* Super Admin Profile & Security Status Modal (Super Admin Only) */}
      {showAdminProfileModal && canManageStaff && (() => {
        if (!effectiveSession) return null;
        const resolvedCurrentAdmin: AdminUser =
          users.find(
            (u) =>
              u.id === effectiveSession.adminId ||
              u.email.toLowerCase() === effectiveSession.email.toLowerCase()
          ) || {
            id: effectiveSession.adminId,
            name: effectiveSession.name,
            email: effectiveSession.email,
            phone: effectiveSession.phone || '',
            role: effectiveSession.role,
            designation: effectiveSession.designation || formatRoleDisplay(effectiveSession.role),
            permissions: effectiveSession.permissions || [],
            status: 'Active',
            inquiriesAssigned: 0,
            isRootSuperAdmin: effectiveSession.isRootSuperAdmin === true,
            totpEnabled: effectiveSession.authLevel === 'aal2',
          };

        return (
          <AdminProfileSettingsModal
            isOpen={showAdminProfileModal}
            user={resolvedCurrentAdmin}
            onClose={() => setShowAdminProfileModal(false)}
            onUpdated={() => {
              refreshData();
              showToast('Super Admin profile updated successfully.');
            }}
          />
        );
      })()}

    </div>
  );
};

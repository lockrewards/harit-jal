import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Shield, X, Check, Copy, Ban, Trash2, KeyRound, AlertTriangle, Pencil, RefreshCw
} from 'lucide-react';
import { AdminUser } from '../../types';
import { StorageService } from '../../services/storage';
import { soundPlayer } from '../../services/sound';
import { AdminAuthService } from '../../services/adminAuth';
import { isSupabaseConfigured } from '../../services/supabase';
import { LoadingButton } from '../ui/LoadingButton';
import {
  ASSIGNABLE_STAFF_ROLES,
  formatRoleDisplay,
} from '../../services/roles';

interface StaffManagementModalProps {
  isOpen: boolean;
  currentUser: AdminUser;
  onClose: () => void;
  onRefresh: () => void;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'leads', label: 'Leads & CRM Consultations' },
  { id: 'orders', label: 'Custom Bottle Orders & Logistics' },
  { id: 'inventory', label: 'Inventory & Stock Counts' },
  { id: 'pricing', label: 'Pricing & Catalog Configuration' },
  { id: 'analytics', label: 'Visitor Analytics & Insights' },
  { id: 'audit_logs', label: 'Security & Email Audit Logs' },
];

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onRefresh,
}) => {
  const [users, setUsers] = useState<AdminUser[]>(() => StorageService.getUsers());
  const [showAddForm, setShowAddForm] = useState(false);

  const isRootAdmin = currentUser?.isRootSuperAdmin === true;
  const canManageStaff =
    isRootAdmin ||
    (Array.isArray(currentUser?.permissions) && currentUser.permissions.includes('staff'));

  // New Staff Form state
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AdminUser['role']>('staff');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['leads', 'orders']);

  // Success state showing generated or reissued temporary password
  const [generatedStaff, setGeneratedStaff] = useState<{
    name: string;
    email: string;
    phone: string;
    tempPass: string;
    isReissued?: boolean;
  } | null>(null);

  // Role & permission editor state
  const [editingTarget, setEditingTarget] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<AdminUser['role']>('staff');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const loadRoster = async () => {
      if (isSupabaseConfigured()) {
        const cloudUsers = await AdminAuthService.syncStaffRosterFromCloud();
        if (isMounted && cloudUsers) {
          setUsers(cloudUsers);
          return;
        }
      } else {
        await Promise.resolve();
      }
      if (isMounted) {
        setUsers(StorageService.getUsers());
      }
    };

    void loadRoster();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const refreshList = async () => {
    if (isSupabaseConfigured()) {
      const cloudUsers = await AdminAuthService.syncStaffRosterFromCloud();
      if (cloudUsers) {
        setUsers(cloudUsers);
        onRefresh();
        return;
      }
    }
    setUsers(StorageService.getUsers());
    onRefresh();
  };

  const handleTogglePermission = (permId: string) => {
    soundPlayer.playWaterDrop();
    setSelectedPermissions(prev => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const handleGenerateAndAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const cleanDesig = designation.trim();

    if (!cleanName || !cleanDesig || !cleanEmail || !cleanPhone) {
      setError('Name, Designation, Email, and Mobile Number are all strictly mandatory.');
      soundPlayer.playBubblePop();
      return;
    }

    if (selectedPermissions.length === 0) {
      setError('Please select at least one permission for this staff member.');
      soundPlayer.playBubblePop();
      return;
    }

    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      setError('A staff member with this Email ID already exists.');
      soundPlayer.playBubblePop();
      return;
    }

    setIsSubmitting(true);
    soundPlayer.playWaterDrop();

    // Authoritative Server-Side Staff Creation (Phase 1G.3)
    // The temporary password is generated ONLY on the server.
    // We await server confirmation before mutating local state or displaying success.
    const createRes = await AdminAuthService.createStaffUser({
      name: cleanName,
      designation: cleanDesig,
      email: cleanEmail,
      phone: cleanPhone,
      role,
      permissions: selectedPermissions,
      performedBy: currentUser.email,
    });

    setIsSubmitting(false);

    if (!createRes.success || !createRes.staff) {
      soundPlayer.playBubblePop();
      setError(createRes.error || 'Server failed to create staff member. No account was provisioned.');
      return;
    }

    // Display EXACT temporary password returned by the server
    soundPlayer.playSuccessChime();
    setGeneratedStaff({
      name: createRes.staff.name,
      email: createRes.staff.email,
      phone: createRes.staff.phone || cleanPhone,
      tempPass: createRes.staff.temporaryPassword || '',
    });

    // Reset Form
    setName('');
    setDesignation('');
    setEmail('');
    setPhone('');
    setRole('staff');
    setSelectedPermissions(['leads', 'orders']);
    setShowAddForm(false);
    await refreshList();
  };

  const isProtectedRootAccount = (targetUser: AdminUser): boolean => {
    return (
      targetUser.isRootSuperAdmin === true ||
      targetUser.id === 'admin_seed_001' ||
      targetUser.id === currentUser.id
    );
  };

  const handleToggleBlock = async (targetUser: AdminUser) => {
    if (isProtectedRootAccount(targetUser)) {
      alert('The Root Super Admin account cannot be blocked.');
      return;
    }

    soundPlayer.playBubblePop();
    const isCurrentlyBlocked = targetUser.status === 'Blocked';

    // Await authoritative server-side Edge Function response
    const blockRes = isCurrentlyBlocked
      ? await AdminAuthService.unblockStaffUser(targetUser.id, currentUser.email)
      : await AdminAuthService.blockStaffUser(targetUser.id, currentUser.email);

    if (!blockRes.success) {
      alert(blockRes.error || `Server failed to ${isCurrentlyBlocked ? 'unblock' : 'block'} staff member.`);
      return;
    }

    await refreshList();
  };

  const handleDelete = async (targetUser: AdminUser) => {
    if (isProtectedRootAccount(targetUser)) {
      alert('The Root Super Admin account cannot be deleted.');
      return;
    }

    if (window.confirm(`Are you sure you want to remove staff member "${targetUser.name}"? This will revoke all administrative access while preserving historical business records.`)) {
      soundPlayer.playWaterDrop();

      // Await authoritative server-side Edge Function response
      const deleteRes = await AdminAuthService.deleteStaffUser(targetUser.id, currentUser.email);
      if (!deleteRes.success) {
        alert(deleteRes.error || 'Server failed to delete staff member.');
        return;
      }

      await refreshList();
    }
  };

  const handleStartEditPermissions = (targetUser: AdminUser) => {
    if (isProtectedRootAccount(targetUser)) {
      alert('Root Super Admin role and permissions cannot be edited.');
      return;
    }
    soundPlayer.playWaterDrop();
    setError(null);
    setActionNotice(null);
    setEditingTarget(targetUser);
    setEditRole(targetUser.role);
    setEditPermissions(
      Array.isArray(targetUser.permissions) && targetUser.permissions.length > 0
        ? [...targetUser.permissions]
        : ['leads', 'orders']
    );
  };

  const handleToggleEditPermission = (permId: string) => {
    soundPlayer.playWaterDrop();
    setEditPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;
    if (editPermissions.length === 0) {
      alert('Select at least one workspace permission for the staff account.');
      return;
    }

    setIsUpdatingPermissions(true);
    setActionNotice(null);
    soundPlayer.playWaterDrop();

    const updateRes = await AdminAuthService.updateStaffRolePermissions(
      editingTarget.id,
      editRole,
      editPermissions,
      currentUser.email
    );

    setIsUpdatingPermissions(false);

    if (!updateRes.success) {
      soundPlayer.playBubblePop();
      alert(updateRes.error || 'Server failed to update staff role and permissions.');
      return;
    }

    soundPlayer.playSuccessChime();
    setActionNotice(`Updated role and workspace permissions for ${editingTarget.name} (${editingTarget.email}).`);
    setEditingTarget(null);
    await refreshList();
  };

  const handleReissueInvite = async (targetUser: AdminUser) => {
    if (isProtectedRootAccount(targetUser)) {
      alert('Cannot reissue a temporary invite for the Root Super Admin account.');
      return;
    }
    if (
      !window.confirm(
        `Reissue a fresh 72-hour temporary password and reset first-login setup for "${targetUser.name}" (${targetUser.email})? This will also clear old authenticator factors so they can re-enroll.`
      )
    ) {
      return;
    }

    setBusyUserId(targetUser.id);
    setActionNotice(null);
    soundPlayer.playWaterDrop();

    const reissueRes = await AdminAuthService.reissueStaffInvite(targetUser.id, true, currentUser.email);
    setBusyUserId(null);

    if (!reissueRes.success || !reissueRes.temporaryPassword) {
      soundPlayer.playBubblePop();
      alert(reissueRes.error || 'Server failed to reissue 72h staff invite.');
      return;
    }

    soundPlayer.playSuccessChime();
    setGeneratedStaff({
      name: targetUser.name,
      email: targetUser.email,
      phone: targetUser.phone || '—',
      tempPass: reissueRes.temporaryPassword,
      isReissued: true,
    });
    setActionNotice(`Fresh 72h temporary invite issued for ${targetUser.email}. Copy the single-use password above.`);
    await refreshList();
  };

  const handleResetMfa = async (targetUser: AdminUser) => {
    if (isProtectedRootAccount(targetUser)) {
      alert('Root Super Admin MFA cannot be reset from the staff directory.');
      return;
    }
    if (
      !window.confirm(
        `Reset Google Authenticator (TOTP) for "${targetUser.name}" (${targetUser.email})? They will be required to enroll a new authenticator factor on next login.`
      )
    ) {
      return;
    }

    setBusyUserId(targetUser.id);
    setActionNotice(null);
    soundPlayer.playWaterDrop();

    const resetRes = await AdminAuthService.resetStaffMfa(targetUser.id, currentUser.email);
    setBusyUserId(null);

    if (!resetRes.success) {
      soundPlayer.playBubblePop();
      alert(resetRes.error || 'Server failed to reset staff TOTP factor.');
      return;
    }

    soundPlayer.playSuccessChime();
    setActionNotice(`Reset Google Authenticator TOTP for ${targetUser.email}. They will re-enroll on next sign-in.`);
    await refreshList();
  };

  const handleCopyCredentials = () => {
    if (!generatedStaff) return;
    const text = `Harit Jal Staff Credentials:\nName: ${generatedStaff.name}\nEmail: ${generatedStaff.email}\nMobile: ${generatedStaff.phone}\nTemporary Password: ${generatedStaff.tempPass}\n\n*Note:* Valid for 72 hours (single use). On your login at the admin gateway, you must set your permanent password and link Google Authenticator.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    soundPlayer.playWaterDrop();
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#102C47]/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl bg-[#FFF9EF] border border-[#C99B42]/50 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden font-manrope text-[#102C47] flex flex-col max-h-[92dvh]">
        
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-[#F8F3E9] border-b border-[#C99B42]/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#102C47] text-[#C99B42] flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-playfair text-[#102C47]">
                Staff & Team Access Management
              </h2>
              <p className="text-xs text-[#77766F]">
                Authorized Super Admin control: Add staff with temporary passwords, assign roles, and enforce Google Authenticator (TOTP).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#102C47]/10 text-[#77766F] hover:text-[#102C47] transition cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">

          {actionNotice && (
            <div className="p-3.5 rounded-2xl bg-[#52652D]/10 border border-[#52652D]/35 text-[#102C47] text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#52652D] shrink-0" />
                <span>{actionNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="text-[11px] font-bold text-[#77766F] hover:text-[#102C47] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
          
          {/* Newly Generated or Reissued Staff Banner */}
          {generatedStaff && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-emerald-900">
                    {generatedStaff.isReissued
                      ? '72-Hour Temporary Invite Reissued & Credentials Generated'
                      : 'New Staff Created & Temporary Credentials Generated'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setGeneratedStaff(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white/80 rounded-xl border border-emerald-200 text-xs">
                <div>
                  <span className="text-gray-500 block">Staff Name:</span>
                  <strong className="text-emerald-950">{generatedStaff.name}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Email Address:</span>
                  <strong className="text-emerald-950">{generatedStaff.email}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Mobile Number:</span>
                  <strong className="text-emerald-950">{generatedStaff.phone}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Temporary Password:</span>
                  <strong className="text-emerald-900 font-mono text-sm bg-emerald-100 px-2 py-0.5 rounded">
                    {generatedStaff.tempPass}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Credentials Copied!' : 'Copy Staff Invitation & Password'}</span>
                </button>
                <span className="text-[11px] text-emerald-800">
                  *Staff will be required to set their permanent password and Google Authenticator on first login.
                </span>
              </div>
            </div>
          )}

          {/* Action Bar: Add Staff Button */}
          {!showAddForm && (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#102C47]">
                  Active Team Members ({users.length})
                </h3>
                <span className="text-xs text-[#77766F]">
                  Staff members log in via Email or Mobile with Google Authenticator TOTP.
                </span>
              </div>

              {canManageStaff && (
                <button
                  onClick={() => {
                    soundPlayer.playWaterDrop();
                    setShowAddForm(true);
                  }}
                  className="btn-gold-luxury px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-[#102C47]" />
                  <span>Add New Staff Member</span>
                </button>
              )}
            </div>
          )}

          {/* ADD NEW STAFF FORM */}
          {showAddForm && (
            <form onSubmit={handleGenerateAndAddStaff} className="p-5 rounded-2xl bg-white border border-[#C99B42]/40 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-[#C99B42]/20">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#C99B42]" />
                  <h3 className="font-bold text-sm text-[#102C47]">Add New Staff Member</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-[#77766F] hover:text-[#102C47] cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#102C47] mb-1">
                    Staff Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Staff full name"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#102C47] mb-1">
                    Staff Designation / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Regional Logistics Lead"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#102C47] mb-1">
                    Official Email ID *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. karan.ops@haritjal.in"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#102C47] mb-1">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#102C47] mb-1">
                    System Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as AdminUser['role'])}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none"
                  >
                    {ASSIGNABLE_STAFF_ROLES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Permissions Checklist */}
              <div>
                <label className="block text-xs font-bold text-[#102C47] mb-1.5">
                  Assigned Workspace Permissions *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label
                      key={perm.id}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        selectedPermissions.includes(perm.id)
                          ? 'bg-[#102C47] text-[#FFF9EF] border-[#102C47]'
                          : 'bg-[#F8F3E9] text-[#102C47] border-[#C99B42]/30 hover:border-[#102C47]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm.id)}
                        onChange={() => handleTogglePermission(perm.id)}
                        className="rounded accent-[#C99B42]"
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-[#77766F] hover:text-[#102C47]"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Creating on Server..."
                  variant="gold"
                  className="px-5 py-2 rounded-full font-bold text-xs shadow-sm"
                  leftIcon={<KeyRound className="w-3.5 h-3.5 text-[#102C47]" />}
                >
                  Generate Temporary Password & Save Staff
                </LoadingButton>
              </div>
            </form>
          )}

          {/* INLINE ROLE & PERMISSIONS EDITOR */}
          {editingTarget && canManageStaff && (
            <form
              onSubmit={handleSavePermissions}
              className="p-5 rounded-2xl bg-white border border-[#102C47]/30 shadow-sm space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#C99B42]/20">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-[#C99B42]" />
                  <div>
                    <h3 className="font-bold text-sm text-[#102C47]">
                      Edit Role &amp; Workspace Permissions — {editingTarget.name}
                    </h3>
                    <p className="text-[11px] text-[#77766F] font-mono">{editingTarget.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="text-xs text-[#77766F] hover:text-[#102C47] cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102C47] mb-1">System Role *</label>
                {isRootAdmin ? (
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as AdminUser['role'])}
                    className="w-full sm:w-72 px-3.5 py-2 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none"
                  >
                    {ASSIGNABLE_STAFF_ROLES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-[#77766F] p-2 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/20">
                    <span className="font-semibold text-[#102C47]">{formatRoleDisplay(editRole)}</span>
                    <span className="text-[11px] ml-2 text-[#77766F]">(Role changes restricted to Root Admin)</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102C47] mb-1.5">
                  Assigned Workspace Permissions *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label
                      key={perm.id}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        editPermissions.includes(perm.id)
                          ? 'bg-[#102C47] text-[#FFF9EF] border-[#102C47]'
                          : 'bg-[#F8F3E9] text-[#102C47] border-[#C99B42]/30 hover:border-[#102C47]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editPermissions.includes(perm.id)}
                        onChange={() => handleToggleEditPermission(perm.id)}
                        className="rounded accent-[#C99B42]"
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-[#77766F] hover:text-[#102C47]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPermissions}
                  className="btn-gold-luxury px-5 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5 text-[#102C47]" />
                  <span>{isUpdatingPermissions ? 'Saving on Server...' : 'Save Role & Permissions'}</span>
                </button>
              </div>
            </form>
          )}

          {/* STAFF MEMBERS TABLE */}
          <div className="rounded-2xl border border-[#C99B42]/30 overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-[#F8F3E9] border-b border-[#C99B42]/20 text-[#77766F] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Staff Member</th>
                    <th className="p-3.5">Contact (Email & Phone)</th>
                    <th className="p-3.5">Role & Permissions</th>
                    <th className="p-3.5">2FA (TOTP)</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C99B42]/15">
                  {users.map((u) => {
                    const isProtected = isProtectedRootAccount(u);
                    const isBlocked = u.status === 'Blocked';

                    return (
                      <tr key={u.id} className="hover:bg-[#FFF9EF]/60 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-[#102C47] flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {u.isRootSuperAdmin && (
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-[#C99B42]/20 text-[#8A631E] font-bold">
                                Root
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#77766F]">
                            {u.designation || formatRoleDisplay(u.role)}
                          </span>
                        </td>

                        <td className="p-3.5 space-y-0.5">
                          <div className="font-mono text-[#102C47] text-[11px]">{u.email}</div>
                          <div className="text-[10.5px] text-[#52652D] font-medium">{u.phone || '—'}</div>
                        </td>

                        <td className="p-3.5 space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#102C47]/10 text-[#102C47]">
                            {formatRoleDisplay(u.role)}
                          </span>
                          {Array.isArray(u.permissions) && u.permissions.length > 0 && (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {u.permissions.map((perm) => (
                                <span
                                  key={perm}
                                  className="px-1.5 py-0.5 rounded bg-[#F8F3E9] border border-[#C99B42]/25 text-[9.5px] font-semibold text-[#77766F]"
                                >
                                  {perm}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5">
                          {u.totpEnabled ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Shield className="w-3 h-3 text-emerald-600" />
                              <span>Google Auth Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <span>Pending 1st Login</span>
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                            isBlocked
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {u.status}
                          </span>
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap">
                          {!isProtected && canManageStaff ? (
                            <div className="inline-flex items-center justify-end gap-1 flex-wrap">
                              <button
                                type="button"
                                disabled={busyUserId === u.id}
                                onClick={() => handleStartEditPermissions(u)}
                                className="px-2 py-1 rounded-full text-[11px] font-bold bg-[#F8F3E9] text-[#102C47] hover:bg-[#C99B42]/20 transition cursor-pointer disabled:opacity-50"
                                title="Edit Role & Permissions"
                              >
                                <span className="flex items-center gap-1">
                                  <Pencil className="w-3 h-3 text-[#C99B42]" />
                                  <span>Permissions</span>
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={busyUserId === u.id}
                                onClick={() => handleReissueInvite(u)}
                                className="px-2 py-1 rounded-full text-[11px] font-bold bg-[#102C47]/10 text-[#102C47] hover:bg-[#102C47]/20 transition cursor-pointer disabled:opacity-50"
                                title="Reissue 72h Temp Password"
                              >
                                <span className="flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Reissue 72h</span>
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={busyUserId === u.id}
                                onClick={() => handleResetMfa(u)}
                                className="px-2 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
                                title="Reset Lost Authenticator (MFA)"
                              >
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  <span>Reset MFA</span>
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={busyUserId === u.id}
                                onClick={() => handleToggleBlock(u)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer disabled:opacity-50 ${
                                  isBlocked 
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                                }`}
                                title={isBlocked ? 'Unblock Staff' : 'Block Staff Access'}
                              >
                                <span className="flex items-center gap-1">
                                  <Ban className="w-3 h-3" />
                                  <span>{isBlocked ? 'Unblock' : 'Block'}</span>
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={busyUserId === u.id}
                                onClick={() => handleDelete(u)}
                                className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
                                title="Delete Staff"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10.5px] text-[#77766F] font-semibold">
                              Protected
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};


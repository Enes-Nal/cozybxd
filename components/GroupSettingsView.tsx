'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Group } from '@/lib/types';
import { transformTeamToGroup } from '@/lib/utils/transformers';
import { useToast } from './Toast';

interface GroupSettingsViewProps {
  groupId: string;
  onBack?: () => void;
}

interface InviteCode {
  id: string;
  code: string;
  expiresAt: string | null;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  createdAt: string;
}

interface InviteCodeForm {
  expirationType: '2hours' | '2days' | '2weeks' | 'unlimited';
  maxUses: number | null;
}

const GroupSettingsView: React.FC<GroupSettingsViewProps> = ({ groupId, onBack }) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteCodeForm>({
    expirationType: '2weeks',
    maxUses: null,
  });
  const [showExpirationDropdown, setShowExpirationDropdown] = useState(false);
  const expirationDropdownRef = useRef<HTMLDivElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  // Fetch group data
  const { data: groupData, isLoading: groupLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${groupId}`);
      if (!res.ok) throw new Error('Failed to fetch group');
      return res.json();
    },
  });

  // Fetch invite codes
  const { data: inviteCodes = [], refetch: refetchInviteCodes } = useQuery<InviteCode[]>({
    queryKey: ['inviteCodes', groupId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${groupId}/invite-codes`);
      if (!res.ok) throw new Error('Failed to fetch invite codes');
      return res.json();
    },
  });

  const group: Group | null = groupData ? transformTeamToGroup(groupData) : null;

  const currentUser = group?.members.find(m => m.id === session?.user?.id);
  const isAdmin = currentUser?.role === 'Admin';

  // Toggle interest level voting mutation
  const toggleInterestLevelVotingMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch(`/api/teams/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestLevelVotingEnabled: enabled }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update setting');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      toast.showSuccess('Interest level voting setting updated');
    },
    onError: (error: Error) => {
      toast.showError(error.message || 'Failed to update setting');
    },
  });

  // Update group name/description mutation
  const updateGroupInfoMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string }) => {
      const res = await fetch(`/api/teams/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update group');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setIsEditingName(false);
      setIsEditingDescription(false);
      toast.showSuccess('Group information updated');
    },
    onError: (error: Error) => {
      toast.showError(error.message || 'Failed to update group');
    },
  });

  // Initialize edited values when group data loads
  useEffect(() => {
    if (group) {
      setEditedName(group.name);
      setEditedDescription(group.description || '');
    }
  }, [group]);

  // Generate invite code mutation
  const generateInviteCodeMutation = useMutation({
    mutationFn: async (form: InviteCodeForm) => {
      const res = await fetch(`/api/teams/${groupId}/invite-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expirationType: form.expirationType,
          maxUses: form.maxUses,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate invite code');
      }
      return res.json();
    },
    onSuccess: (data) => {
      refetchInviteCodes();
      setIsGeneratingCode(false);
      setInviteForm({ expirationType: '2weeks', maxUses: null });
      toast.showSuccess(`Invite code ${data.code} generated!`);
    },
    onError: (error: Error) => {
      toast.showError(error.message || 'Failed to generate invite code');
    },
  });

  // Deactivate invite code mutation
  const deactivateInviteCodeMutation = useMutation({
    mutationFn: async (codeId: string) => {
      const res = await fetch(`/api/teams/${groupId}/invite-codes/${codeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to deactivate invite code');
      }
      return res.json();
    },
    onSuccess: () => {
      refetchInviteCodes();
      toast.showSuccess('Invite code deactivated');
    },
    onError: (error: Error) => {
      toast.showError(error.message || 'Failed to deactivate invite code');
    },
  });

  const handleToggleInterestLevelVoting = (enabled: boolean) => {
    toggleInterestLevelVotingMutation.mutate(enabled);
  };

  const handleGenerateCode = () => {
    if (!isAdmin) return;
    generateInviteCodeMutation.mutate(inviteForm);
  };

  const handleDeactivateCode = (codeId: string) => {
    if (!isAdmin) return;
    if (confirm('Are you sure you want to deactivate this invite code?')) {
      deactivateInviteCodeMutation.mutate(codeId);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.showSuccess('Invite code copied to clipboard!');
  };

  const formatExpiration = (expiresAt: string | null): string => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} left`;
    return 'Expiring soon';
  };

  const isCodeExpired = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (expirationDropdownRef.current && !expirationDropdownRef.current.contains(event.target as Node)) {
        setShowExpirationDropdown(false);
      }
    };

    if (showExpirationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExpirationDropdown]);

  const expirationOptions = [
    { value: '2hours', label: '2 Hours' },
    { value: '2days', label: '2 Days' },
    { value: '2weeks', label: '2 Weeks' },
    { value: 'unlimited', label: 'Unlimited' },
  ];

  const selectedExpirationLabel = expirationOptions.find(opt => opt.value === inviteForm.expirationType)?.label || '2 Weeks';

  if (groupLoading) {
    return (
      <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading settings...</div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-400">Group not found</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Only admins can access group settings</div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto pb-20">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-6 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span className="text-sm font-medium">Back to Group</span>
        </button>
      )}
      
      <h2 className="text-3xl font-black uppercase tracking-tight mb-2 text-main">
        {group.name} Settings
      </h2>
      <p className="text-sm text-gray-400 mb-10">Manage group preferences and invite codes</p>
      
      <div className="space-y-8">
        {/* Group Information */}
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">
            Group Information
          </h3>
          <div className="glass p-6 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent space-y-6">
            {/* Group Name */}
            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block">Group Name</label>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 focus:bg-white/10 transition-all"
                    placeholder="Enter group name"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (editedName.trim()) {
                        updateGroupInfoMutation.mutate({ name: editedName.trim() });
                      }
                    }}
                    disabled={!editedName.trim() || updateGroupInfoMutation.isPending}
                    className="px-4 py-2.5 bg-accent text-black rounded-xl text-sm font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false);
                      setEditedName(group?.name || '');
                    }}
                    disabled={updateGroupInfoMutation.isPending}
                    className="px-4 py-2.5 bg-white/5 border border-white/10 text-gray-400 rounded-xl text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-bold">{group.name}</p>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
                    title="Edit name"
                  >
                    <i className="fa-solid fa-pencil text-xs"></i>
                  </button>
                </div>
              )}
            </div>

            {/* Group Description */}
            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block">Description</label>
              {isEditingDescription ? (
                <div className="space-y-2">
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 focus:bg-white/10 transition-all resize-none"
                    placeholder="Enter group description"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        updateGroupInfoMutation.mutate({ description: editedDescription.trim() || null });
                      }}
                      disabled={updateGroupInfoMutation.isPending}
                      className="px-4 py-2.5 bg-accent text-black rounded-xl text-sm font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingDescription(false);
                        setEditedDescription(group?.description || '');
                      }}
                      disabled={updateGroupInfoMutation.isPending}
                      className="px-4 py-2.5 bg-white/5 border border-white/10 text-gray-400 rounded-xl text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm text-gray-300">{group.description || 'No description'}</p>
                  <button
                    onClick={() => setIsEditingDescription(true)}
                    className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
                    title="Edit description"
                  >
                    <i className="fa-solid fa-pencil text-xs"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Interest Level Voting */}
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">
            Group Features
          </h3>
          <div className="glass p-6 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold mb-1">Interest Level Voting</p>
                <p className="text-xs text-gray-400">Allow members to set interest level when adding movies</p>
              </div>
              <button
                onClick={() => handleToggleInterestLevelVoting(!group.interestLevelVotingEnabled)}
                disabled={toggleInterestLevelVotingMutation.isPending}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  group.interestLevelVotingEnabled ? 'bg-accent' : 'bg-white/10'
                } disabled:opacity-50`}
              >
                <div
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    group.interestLevelVotingEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Invite Codes */}
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">
            Invite Codes
          </h3>
          
          {/* Generate New Code */}
          <div className="glass p-6 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent mb-6">
            <h4 className="text-sm font-bold mb-4">Generate New Invite Code</h4>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Expiration</label>
                <div className="relative" ref={expirationDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowExpirationDropdown(!showExpirationDropdown)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 focus:bg-white/10 transition-all flex items-center justify-between hover:bg-white/10"
                  >
                    <span className="text-white">{selectedExpirationLabel}</span>
                    <i className={`fa-solid fa-chevron-${showExpirationDropdown ? 'up' : 'down'} text-[10px] text-gray-400 transition-transform`}></i>
                  </button>
                  
                  {showExpirationDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-full glass border-white/10 rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200 shadow-2xl bg-[#111]">
                      {expirationOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setInviteForm({ ...inviteForm, expirationType: option.value as any });
                            setShowExpirationDropdown(false);
                          }}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
                            inviteForm.expirationType === option.value 
                              ? 'text-accent bg-white/5 font-bold' 
                              : 'text-gray-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Max Uses (leave empty for unlimited)</label>
                <input
                  type="number"
                  min="1"
                  value={inviteForm.maxUses || ''}
                  onChange={(e) => setInviteForm({ 
                    ...inviteForm, 
                    maxUses: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  placeholder="e.g., 5"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 focus:bg-white/10 transition-all"
                />
              </div>
              
              <button
                onClick={handleGenerateCode}
                disabled={generateInviteCodeMutation.isPending}
                className="w-full bg-accent text-black px-6 py-3 rounded-xl text-sm font-bold hover:brightness-110 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generateInviteCodeMutation.isPending ? 'Generating...' : 'Generate Code'}
              </button>
            </div>
          </div>

          {/* Active Codes List */}
          <div className="space-y-3">
            {inviteCodes.length === 0 ? (
              <div className="glass p-6 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent text-center text-gray-400 text-sm">
                No invite codes generated yet
              </div>
            ) : (
              inviteCodes.map((code) => (
                <div
                  key={code.id}
                  className={`glass p-6 rounded-[2rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent ${
                    !code.isActive || isCodeExpired(code.expiresAt) ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm font-mono tracking-widest uppercase">
                          {code.code}
                        </code>
                        {!code.isActive && (
                          <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full font-medium">
                            Deactivated
                          </span>
                        )}
                        {code.isActive && isCodeExpired(code.expiresAt) && (
                          <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full font-medium">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Expires: {formatExpiration(code.expiresAt)}</span>
                        <span>
                          Uses: {code.currentUses}
                          {code.maxUses ? ` / ${code.maxUses}` : ' / ∞'}
                        </span>
                        <span>Created: {new Date(code.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {code.isActive && !isCodeExpired(code.expiresAt) && (
                        <button
                          onClick={() => copyToClipboard(code.code)}
                          className="p-2 text-gray-400 hover:text-white transition-colors"
                          title="Copy code"
                        >
                          <i className="fa-solid fa-copy"></i>
                        </button>
                      )}
                      {code.isActive && (
                        <button
                          onClick={() => handleDeactivateCode(code.id)}
                          disabled={deactivateInviteCodeMutation.isPending}
                          className="p-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                          title="Deactivate code"
                        >
                          <i className="fa-solid fa-ban"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default GroupSettingsView;


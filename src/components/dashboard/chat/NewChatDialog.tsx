import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { chatTranslations, ChatLanguage } from "@/lib/chatTranslations";
import { Database } from "@/integrations/supabase/types";

type ChatTopicType = Database['public']['Enums']['chat_topic_type'] | undefined;

interface User {
  id: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

interface TopicReference {
  id: string;
  label: string;
}

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userRole: string;
  language: ChatLanguage;
  isGroupChat?: boolean;
  onChatCreated: (conversationId: string) => void;
}

const NewChatDialog = ({ 
  open, 
  onClose, 
  userId, 
  userRole, 
  language, 
  isGroupChat = false,
  onChatCreated 
}: NewChatDialogProps) => {
  const t = chatTranslations[language];
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [topicType, setTopicType] = useState<string>("general");
  const [topicReferences, setTopicReferences] = useState<TopicReference[]>([]);
  const [selectedReference, setSelectedReference] = useState<string>("");
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadingReferences, setLoadingReferences] = useState(false);

  // Get available topics based on user role
  const getAvailableTopics = () => {
    const baseTopics = [
      { value: 'general', label: t.topicGeneral },
    ];

    if (userRole === 'mover') {
      return [
        ...baseTopics,
        { value: 'reimbursement', label: t.topicReimbursement },
        { value: 'review_bonus', label: t.topicReviewBonus },
        { value: 'missing_payment', label: t.topicMissingPayment },
        { value: 'violence_incident', label: t.topicViolenceIncident },
      ];
    }

    // Admin and other roles get all topics
    return [
      ...baseTopics,
      { value: 'reimbursement', label: t.topicReimbursement },
      { value: 'review_bonus', label: t.topicReviewBonus },
      { value: 'missing_payment', label: t.topicMissingPayment },
      { value: 'violence_incident', label: t.topicViolenceIncident },
      { value: 'performance_report', label: t.topicPerformanceReport },
      { value: 'deductible', label: t.topicDeductible },
    ];
  };

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  useEffect(() => {
    if (topicType && topicType !== 'general') {
      fetchTopicReferences();
    } else {
      setTopicReferences([]);
      setSelectedReference("");
    }
  }, [topicType]);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .neq('id', userId);

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles = (profiles || []).map(profile => ({
        ...profile,
        roles: (roles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => r.role)
      }));

      // Filter users based on current user's role
      let filteredUsers = usersWithRoles;
      if (userRole === 'mover') {
        // Movers can only chat with admins, operations managers, reviews admins, accountants
        filteredUsers = usersWithRoles.filter(u => 
          u.roles.includes('admin') || 
          u.roles.includes('operations_manager') || 
          u.roles.includes('reviews_admin') ||
          u.roles.includes('accountant')
        );
      }

      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicReferences = async () => {
    setLoadingReferences(true);
    try {
      let references: TopicReference[] = [];
      
      if (userRole === 'mover') {
        // Movers can only see their own records
        switch (topicType) {
          case 'reimbursement':
            const { data: reimbursements } = await supabase
              .from('reimbursements')
              .select('id, reimbursement_number, job_number')
              .eq('mover_id', userId)
              .order('created_at', { ascending: false })
              .limit(20);
            references = (reimbursements || []).map(r => ({
              id: r.id,
              label: `${t.reimbursementForm}${r.reimbursement_number} - ${r.job_number}`
            }));
            break;
          case 'review_bonus':
            const { data: reviews } = await supabase
              .from('review_bonuses')
              .select('id, invoice_number, client_full_name')
              .eq('mover_id', userId)
              .order('created_at', { ascending: false })
              .limit(20);
            references = (reviews || []).map(r => ({
              id: r.id,
              label: `${t.reviewForm}${r.invoice_number} - ${r.client_full_name}`
            }));
            break;
          case 'missing_payment':
            const { data: payments } = await supabase
              .from('missing_payments')
              .select('id, job_number, customer_name')
              .eq('mover_id', userId)
              .order('created_at', { ascending: false })
              .limit(20);
            references = (payments || []).map(r => ({
              id: r.id,
              label: `${t.missingPaymentForm}${r.job_number} - ${r.customer_name}`
            }));
            break;
          case 'violence_incident':
            const { data: incidents } = await supabase
              .from('violence_incidents')
              .select('id, job_id, client_name')
              .eq('mover_id', userId)
              .order('created_at', { ascending: false })
              .limit(20);
            references = (incidents || []).map(r => ({
              id: r.id,
              label: `${t.violenceIncidentForm}${r.job_id} - ${r.client_name}`
            }));
            break;
        }
      } else {
        // Admin and other roles can see all records
        switch (topicType) {
          case 'reimbursement':
            const { data: reimbursements } = await supabase
              .from('reimbursements')
              .select('id, reimbursement_number, job_number, mover_full_name')
              .order('created_at', { ascending: false })
              .limit(20);
            references = (reimbursements || []).map(r => ({
              id: r.id,
              label: `${t.reimbursementForm}${r.reimbursement_number} - ${r.mover_full_name}`
            }));
            break;
          case 'review_bonus':
            const { data: reviews } = await supabase
              .from('review_bonuses')
              .select('id, invoice_number, foreman_name')
              .order('created_at', { ascending: false })
              .limit(20);
            references = (reviews || []).map(r => ({
              id: r.id,
              label: `${t.reviewForm}${r.invoice_number} - ${r.foreman_name}`
            }));
            break;
          case 'missing_payment':
            const { data: payments } = await supabase
              .from('missing_payments')
              .select('id, job_number, mover_full_name')
              .order('created_at', { ascending: false })
              .limit(20);
            references = (payments || []).map(r => ({
              id: r.id,
              label: `${t.missingPaymentForm}${r.job_number} - ${r.mover_full_name}`
            }));
            break;
          case 'violence_incident':
            const { data: incidents } = await supabase
              .from('violence_incidents')
              .select('id, job_id, mover_name')
              .order('created_at', { ascending: false })
              .limit(20);
            references = (incidents || []).map(r => ({
              id: r.id,
              label: `${t.violenceIncidentForm}${r.job_id} - ${r.mover_name}`
            }));
            break;
          case 'performance_report':
            const { data: reports } = await supabase
              .from('performance_reports')
              .select('id, title, worker_name')
              .order('created_at', { ascending: false })
              .limit(20);
            references = (reports || []).map(r => ({
              id: r.id,
              label: `${t.performanceReportForm}${r.title} - ${r.worker_name}`
            }));
            break;
          case 'deductible':
            const { data: deductibles } = await supabase
              .from('deductibles')
              .select('id, amount, mover_name')
              .order('created_at', { ascending: false })
              .limit(20);
            references = (deductibles || []).map(r => ({
              id: r.id,
              label: `${t.deductibleForm}$${r.amount} - ${r.mover_name}`
            }));
            break;
        }
      }

      setTopicReferences(references);
    } catch (error) {
      console.error('Error fetching topic references:', error);
    } finally {
      setLoadingReferences(false);
    }
  };

  const handleUserSelect = (user: User) => {
    if (isGroupChat) {
      setSelectedUsers(prev => {
        const isSelected = prev.some(u => u.id === user.id);
        if (isSelected) {
          return prev.filter(u => u.id !== user.id);
        }
        return [...prev, user];
      });
    } else {
      setSelectedUsers([user]);
    }
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      toast.error(t.recipientRequired);
      return;
    }

    if (isGroupChat && !groupName.trim()) {
      toast.error(t.groupNameRequired);
      return;
    }

    if (isGroupChat && selectedUsers.length < 2) {
      toast.error(t.selectAtLeast2);
      return;
    }

    setCreating(true);
    try {
      const selectedRef = topicReferences.find(r => r.id === selectedReference);
      
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: isGroupChat ? groupName : null,
          is_group: isGroupChat,
          topic_type: topicType as ChatTopicType,
          topic_reference_id: selectedReference || null,
          topic_reference_label: selectedRef?.label || null,
          created_by: userId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add all participants
      const participantIds = [userId, ...selectedUsers.map(u => u.id)];
      const participants = participantIds.map(id => ({
        conversation_id: conversation.id,
        user_id: id,
      }));

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (partError) throw partError;

      toast.success(isGroupChat ? t.groupCreated : t.chatCreated);
      onChatCreated(conversation.id);
      handleClose();
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error(t.errorCreatingChat);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setTopicType("general");
    setSelectedReference("");
    setGroupName("");
    setSearchQuery("");
    onClose();
  };

  const getRoleBadge = (roles: string[]) => {
    if (roles.includes('admin')) return t.admin;
    if (roles.includes('operations_manager')) return t.operationsManager;
    if (roles.includes('reviews_admin')) return t.reviewsAdmin;
    if (roles.includes('accountant')) return t.accountant;
    if (roles.includes('mover')) return t.mover;
    return '';
  };

  const filteredUsers = users.filter(user =>
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isGroupChat ? t.newGroupChat : t.newChat}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group name for group chats */}
          {isGroupChat && (
            <div className="space-y-2">
              <Label>{t.groupName}</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t.groupName}
              />
            </div>
          )}

          {/* User selection */}
          <div className="space-y-2">
            <Label>{isGroupChat ? t.selectRecipients : t.selectRecipient}</Label>
            
            {/* Selected users badges */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedUsers.map(user => (
                  <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                    {user.first_name} {user.last_name}
                    <button onClick={() => removeUser(user.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchUsers}
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-[150px] border rounded-md">
              {loading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredUsers.map(user => {
                    const isSelected = selectedUsers.some(u => u.id === user.id);
                    return (
                      <button
                        key={user.id}
                        className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors ${
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                        }`}
                        onClick={() => handleUserSelect(user)}
                      >
                        {isGroupChat && (
                          <Checkbox checked={isSelected} />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{user.first_name} {user.last_name}</p>
                          <p className="text-xs text-muted-foreground">{getRoleBadge(user.roles)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Topic selection */}
          <div className="space-y-2">
            <Label>{t.selectTopic}</Label>
            <Select value={topicType} onValueChange={setTopicType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableTopics().map(topic => (
                  <SelectItem key={topic.value} value={topic.value}>
                    {topic.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Topic reference selection */}
          {topicType !== 'general' && topicReferences.length > 0 && (
            <div className="space-y-2">
              <Label>{t.selectReference}</Label>
              <Select value={selectedReference} onValueChange={setSelectedReference}>
                <SelectTrigger>
                  <SelectValue placeholder={t.skipTopic} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.skipTopic}</SelectItem>
                  {topicReferences.map(ref => (
                    <SelectItem key={ref.id} value={ref.id}>
                      {ref.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingReferences && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t.loading}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              {t.cancel}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isGroupChat ? t.createGroup : t.startChat}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;

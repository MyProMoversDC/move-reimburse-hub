import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, X, Loader2, UserPlus, Send, Search } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MOVER_ATTRIBUTE_OPTIONS } from "@/components/dashboard/MoverDocumentsTab";

interface PendingUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  username: string;
  birth_date: string | null;
  nickname: string | null;
  use_nickname_in_chat: boolean;
  signup_status: string;
  created_at: string;
  role?: string;
  checkr_status?: string | null;
}

const approvalTranslations = {
  en: {
    title: "SignUp Approvals",
    noPending: "No pending sign-up requests",
    approve: "Approve",
    decline: "Decline",
    approved: "User approved successfully",
    declined: "User sign-up declined",
    name: "Name",
    email: "Email",
    phone: "Phone",
    username: "Username",
    dob: "Date of Birth",
    nickname: "Nickname",
    role: "Role",
    chatNickname: "Uses nickname in chat",
    submittedAt: "Submitted",
    mover: "Mover",
    office_staff: "Office Staff",
    pending: "Pending",
    sendToCheckr: "Send to Checkr",
    checkrSent: "Checkr invitation sent successfully",
    checkrAlreadySent: "Already sent to Checkr",
    checkrInvited: "Checkr Invited",
    checkrPending: "Checkr Pending",
    checkrClear: "Checkr Clear",
    checkrConsider: "Checkr Review",
    approvedStatus: "Approved",
    searchPlaceholder: "Search by name, email, or phone...",
  },
  es: {
    title: "Aprobaciones de Registro",
    noPending: "No hay solicitudes de registro pendientes",
    approve: "Aprobar",
    decline: "Rechazar",
    approved: "Usuario aprobado exitosamente",
    declined: "Registro de usuario rechazado",
    name: "Nombre",
    email: "Correo",
    phone: "Teléfono",
    username: "Usuario",
    dob: "Fecha de Nacimiento",
    nickname: "Apodo",
    role: "Rol",
    chatNickname: "Usa apodo en chat",
    submittedAt: "Enviado",
    mover: "Mudador",
    office_staff: "Personal de Oficina",
    pending: "Pendiente",
    sendToCheckr: "Enviar a Checkr",
    checkrSent: "Invitación de Checkr enviada exitosamente",
    checkrAlreadySent: "Ya enviado a Checkr",
    checkrInvited: "Checkr Invitado",
    checkrPending: "Checkr Pendiente",
    checkrClear: "Checkr Aprobado",
    checkrConsider: "Checkr Revisión",
    approvedStatus: "Aprobado",
    searchPlaceholder: "Buscar por nombre, correo o teléfono...",
  },
  ru: {
    title: "Одобрение Регистраций",
    noPending: "Нет ожидающих запросов на регистрацию",
    approve: "Одобрить",
    decline: "Отклонить",
    approved: "Пользователь одобрен",
    declined: "Регистрация пользователя отклонена",
    name: "Имя",
    email: "Почта",
    phone: "Телефон",
    username: "Пользователь",
    dob: "Дата Рождения",
    nickname: "Прозвище",
    role: "Роль",
    chatNickname: "Использует прозвище в чате",
    submittedAt: "Отправлено",
    mover: "Грузчик",
    office_staff: "Офисный Сотрудник",
    pending: "Ожидает",
    sendToCheckr: "Отправить в Checkr",
    checkrSent: "Приглашение Checkr отправлено",
    checkrAlreadySent: "Уже отправлено в Checkr",
    checkrInvited: "Checkr Приглашён",
    checkrPending: "Checkr Ожидание",
    checkrClear: "Checkr Одобрен",
    checkrConsider: "Checkr Проверка",
    approvedStatus: "Одобрен",
    searchPlaceholder: "Поиск по имени, почте или телефону...",
  },
};

const getCheckrBadge = (status: string | null | undefined, t: any) => {
  if (!status) return null;
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    invited: { label: t.checkrInvited, variant: "secondary" },
    pending: { label: t.checkrPending, variant: "outline" },
    clear: { label: t.checkrClear, variant: "default" },
    consider: { label: t.checkrConsider, variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
};

const AdminSignupApprovals = () => {
  const { language } = useLanguage();
  const t = approvalTranslations[language];
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [checkrProcessingId, setCheckrProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [moverAttribute, setMoverAttribute] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const { data: profiles, error } = await (supabase
        .from("profiles")
        .select("*") as any)
        .in("signup_status", ["pending", "approved"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch roles and checkr status for each user
      const usersWithDetails = await Promise.all(
        (profiles || []).map(async (profile: any) => {
          const [{ data: roles }, { data: checkrRecord }] = await Promise.all([
            supabase.from("user_roles").select("role").eq("user_id", profile.id),
            (supabase.from("checkr_candidates").select("status").eq("user_id", profile.id).maybeSingle() as any),
          ]);

          return {
            ...profile,
            role: roles?.[0]?.role || "mover",
            checkr_status: checkrRecord?.status || null,
          };
        })
      );

      setPendingUsers(usersWithDetails);
    } catch (error) {
      console.error("Error fetching pending users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    setProcessingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ signup_status: "approved" } as any)
        .eq("id", userId);

      if (error) throw error;

      toast.success(t.approved);
      setPendingUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, signup_status: "approved" } : u))
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (userId: string) => {
    setProcessingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ signup_status: "declined" } as any)
        .eq("id", userId);

      if (error) throw error;

      toast.success(t.declined);
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendToCheckr = async (userId: string) => {
    setCheckrProcessingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("send-checkr-invitation", {
        body: { userId },
      });

      if (error) {
        // Try to parse error body for details
        console.error("Checkr invoke error:", error);
        throw new Error("Failed to send Checkr invitation");
      }
      if (data && !data.ok) {
        if (data.error?.includes("already")) {
          toast.info(t.checkrAlreadySent);
        } else {
          const detail = data.details ? JSON.stringify(data.details) : "";
          throw new Error(data.error + (detail ? `: ${detail}` : ""));
        }
        return;
      }

      toast.success(t.checkrSent);
      setPendingUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, checkr_status: "invited" } : u))
      );
    } catch (error: any) {
      console.error("Checkr invitation error:", error);
      toast.error(error.message || "Failed to send Checkr invitation");
    } finally {
      setCheckrProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const filterBySearch = (users: PendingUser[]) => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) =>
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  };

  const pendingList = filterBySearch(pendingUsers.filter((u) => u.signup_status === "pending"));
  const approvedList = filterBySearch(pendingUsers.filter((u) => u.signup_status === "approved"));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t.title}</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {pendingList.length === 0 && approvedList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.noPending}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingList.map((user) => (
            <Card key={user.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {user.first_name} {user.last_name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {t[user.role as keyof typeof t] || user.role}
                    </Badge>
                    <Badge variant="secondary">{t.pending}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <UserDetails user={user} t={t} />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDecline(user.id)}
                    disabled={processingId === user.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {processingId === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <X className="h-4 w-4 mr-1" />
                    )}
                    {t.decline}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(user.id)}
                    disabled={processingId === user.id}
                  >
                    {processingId === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    {t.approve}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {approvedList.map((user) => (
            <Card key={user.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {user.first_name} {user.last_name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {t[user.role as keyof typeof t] || user.role}
                    </Badge>
                    <Badge variant="default">{t.approvedStatus}</Badge>
                    {getCheckrBadge(user.checkr_status, t)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <UserDetails user={user} t={t} />
                <div className="flex gap-2 justify-end">
                  {!user.checkr_status && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendToCheckr(user.id)}
                      disabled={checkrProcessingId === user.id}
                      className="text-blue-600 border-blue-600 hover:bg-blue-50"
                    >
                      {checkrProcessingId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      {t.sendToCheckr}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const UserDetails = ({ user, t }: { user: PendingUser; t: any }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
    <div>
      <span className="font-medium">{t.email}:</span> {user.email}
    </div>
    <div>
      <span className="font-medium">{t.phone}:</span> {user.phone}
    </div>
    <div>
      <span className="font-medium">{t.username}:</span> {user.username}
    </div>
    <div>
      <span className="font-medium">{t.dob}:</span>{" "}
      {user.birth_date ? format(new Date(user.birth_date), "MM/dd/yyyy") : "N/A"}
    </div>
    {user.nickname && (
      <div>
        <span className="font-medium">{t.nickname}:</span> {user.nickname}
        {user.use_nickname_in_chat && (
          <span className="text-xs text-muted-foreground ml-2">
            ({t.chatNickname})
          </span>
        )}
      </div>
    )}
    <div>
      <span className="font-medium">{t.submittedAt}:</span>{" "}
      {user.created_at ? format(new Date(user.created_at), "MM/dd/yyyy HH:mm") : "N/A"}
    </div>
  </div>
);

export default AdminSignupApprovals;

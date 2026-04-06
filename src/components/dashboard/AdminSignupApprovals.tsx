import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Loader2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

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
  },
};

const AdminSignupApprovals = () => {
  const { language } = useLanguage();
  const t = approvalTranslations[language];
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("signup_status" as any, "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch roles for each pending user
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile: any) => {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          return {
            ...profile,
            role: roles?.[0]?.role || "mover",
          };
        })
      );

      setPendingUsers(usersWithRoles);
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
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
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

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t.title}</h2>

      {pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.noPending}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingUsers.map((user) => (
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <span className="font-medium">{t.email}:</span>{" "}
                    {user.email}
                  </div>
                  <div>
                    <span className="font-medium">{t.phone}:</span>{" "}
                    {user.phone}
                  </div>
                  <div>
                    <span className="font-medium">{t.username}:</span>{" "}
                    {user.username}
                  </div>
                  <div>
                    <span className="font-medium">{t.dob}:</span>{" "}
                    {user.birth_date
                      ? format(new Date(user.birth_date), "MM/dd/yyyy")
                      : "N/A"}
                  </div>
                  {user.nickname && (
                    <div>
                      <span className="font-medium">{t.nickname}:</span>{" "}
                      {user.nickname}
                      {user.use_nickname_in_chat && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({t.chatNickname})
                        </span>
                      )}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">{t.submittedAt}:</span>{" "}
                    {user.created_at
                      ? format(new Date(user.created_at), "MM/dd/yyyy HH:mm")
                      : "N/A"}
                  </div>
                </div>

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
        </div>
      )}
    </div>
  );
};

export default AdminSignupApprovals;

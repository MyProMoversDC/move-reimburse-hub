import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Props {
  userId: string;
  language: string;
  refreshKey?: number;
}

interface Row {
  id: string;
  customer_name: string;
  amount: number;
  request_date: string;
  created_at: string;
  status: string | null;
  decline_reason: string | null;
  reviewed_at: string | null;
}

const labels: Record<string, Record<string, string>> = {
  en: { title: "My Submitted Refunds", empty: "No refund forms submitted yet", customer: "Customer", amount: "Amount", date: "Request Date", submitted: "Submitted", status: "Status", reason: "Decline reason", reviewed: "Reviewed", pending: "Pending", completed: "Refund Completed", declined: "Declined" },
  es: { title: "Mis Reembolsos Enviados", empty: "Aún no se han enviado formularios", customer: "Cliente", amount: "Monto", date: "Fecha de solicitud", submitted: "Enviado", status: "Estado", reason: "Razón del rechazo", reviewed: "Revisado", pending: "Pendiente", completed: "Reembolso Completado", declined: "Rechazado" },
  ru: { title: "Мои отправленные возвраты", empty: "Формы возврата ещё не отправлены", customer: "Клиент", amount: "Сумма", date: "Дата запроса", submitted: "Отправлено", status: "Статус", reason: "Причина отказа", reviewed: "Рассмотрено", pending: "В ожидании", completed: "Возврат выполнен", declined: "Отклонено" },
};

const CustomerRefundHistory = ({ userId, language, refreshKey }: Props) => {
  const t = labels[language] || labels.en;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("customer_refunds" as any)
        .select("id, customer_name, amount, request_date, created_at, status, decline_reason, reviewed_at")
        .eq("submitted_by", userId)
        .order("created_at", { ascending: false });
      setRows((data as any) || []);
      setLoading(false);
    };
    load();
  }, [userId, refreshKey]);

  const renderStatus = (s: string | null) => {
    const status = s || "pending";
    if (status === "completed") return <Badge className="bg-green-600 hover:bg-green-700">{t.completed}</Badge>;
    if (status === "declined") return <Badge variant="destructive">{t.declined}</Badge>;
    return <Badge variant="secondary">{t.pending}</Badge>;
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{t.title}</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="border rounded-md p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium">{r.customer_name} — ${Number(r.amount).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.date}: {format(new Date(r.request_date), "MM/dd/yyyy")} · {t.submitted}: {format(new Date(r.created_at), "MM/dd/yyyy hh:mm a")}
                    </p>
                  </div>
                  {renderStatus(r.status)}
                </div>
                {(r.status || "pending") === "declined" && r.decline_reason && (
                  <div className="text-xs bg-destructive/10 border border-destructive/30 rounded p-2">
                    <span className="font-semibold">{t.reason}:</span> {r.decline_reason}
                  </div>
                )}
                {r.reviewed_at && (r.status || "pending") !== "pending" && (
                  <p className="text-xs text-muted-foreground">{t.reviewed}: {format(new Date(r.reviewed_at), "MM/dd/yyyy hh:mm a")}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerRefundHistory;

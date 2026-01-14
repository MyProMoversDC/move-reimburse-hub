import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, History } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useLanguage } from "@/contexts/LanguageContext";

interface AddressHistory {
  id: string;
  address: string;
  changed_at: string;
}

interface AddressHistoryViewProps {
  employeeId: string;
  employeeName: string;
}

const translations = {
  en: {
    title: "Address History",
    address: "Address",
    changedAt: "Changed At (EST)",
    noHistory: "No address changes recorded",
    currentAddress: "Current Address",
  },
  es: {
    title: "Historial de Direcciones",
    address: "Dirección",
    changedAt: "Cambió el (EST)",
    noHistory: "Sin cambios de dirección registrados",
    currentAddress: "Dirección Actual",
  },
  ru: {
    title: "История Адресов",
    address: "Адрес",
    changedAt: "Изменено (EST)",
    noHistory: "Изменений адреса не зарегистрировано",
    currentAddress: "Текущий Адрес",
  },
};

const AddressHistoryView = ({ employeeId, employeeName }: AddressHistoryViewProps) => {
  const { language } = useLanguage();
  const t = translations[language];
  
  const [history, setHistory] = useState<AddressHistory[]>([]);
  const [currentAddress, setCurrentAddress] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAddressHistory();
  }, [employeeId]);

  const fetchAddressHistory = async () => {
    setLoading(true);
    
    // Fetch current address
    const { data: profile } = await supabase
      .from("profiles")
      .select("address")
      .eq("id", employeeId)
      .maybeSingle();

    if (profile) {
      setCurrentAddress(profile.address || "");
    }

    // Fetch address history
    const { data, error } = await supabase
      .from("address_history")
      .select("*")
      .eq("user_id", employeeId)
      .order("changed_at", { ascending: false });

    if (!error && data) {
      setHistory(data);
    }
    setLoading(false);
  };

  const formatToEST = (dateString: string) => {
    const date = new Date(dateString);
    const estDate = toZonedTime(date, "America/New_York");
    return format(estDate, "MM/dd/yyyy hh:mm a");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          {t.title} - {employeeName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentAddress && (
          <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-1">
              <MapPin className="h-4 w-4" />
              {t.currentAddress}
            </p>
            <p className="text-sm">{currentAddress}</p>
          </div>
        )}

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.address}</TableHead>
                <TableHead className="w-[180px]">{t.changedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    {t.noHistory}
                  </TableCell>
                </TableRow>
              ) : (
                history.map((entry, index) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{entry.address}</TableCell>
                    <TableCell className="text-xs">{formatToEST(entry.changed_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AddressHistoryView;

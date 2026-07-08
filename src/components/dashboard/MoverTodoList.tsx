import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Car, MapPin, FileText, AlertTriangle, IdCard } from "lucide-react";

interface MoverTodoListProps {
  userId: string;
  language: 'en' | 'es' | 'ru';
  onNavigateToSettings?: () => void;
}

interface TodoItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  type: 'license' | 'address' | 'medical_card' | 'document_decline' | 'other';
  action?: () => void;
}

const translations = {
  en: {
    todoList: "To-Do List",
    uploadDriversLicense: "Upload Driver's License",
    uploadDriversLicenseDesc: "You are assigned as a driver. Please upload your driver's license.",
    updateAddress: "Update Physical Address",
    updateAddressDesc: "Please provide your current physical address.",
    uploadMedicalCard: "Upload Medical Card",
    uploadMedicalCardDesc: "Please upload your medical card for compliance.",
    documentDeclined: "Document Declined",
    documentDeclinedDesc: "Your document was declined. Please review and re-upload.",
    goToSettings: "Go to Settings",
    allCompleted: "All tasks completed!",
    pendingTasks: "Pending Tasks",
  },
  es: {
    todoList: "Lista de Tareas",
    uploadDriversLicense: "Subir Licencia de Conducir",
    uploadDriversLicenseDesc: "Usted está asignado como conductor. Por favor suba su licencia de conducir.",
    updateAddress: "Actualizar Dirección Física",
    updateAddressDesc: "Por favor proporcione su dirección física actual.",
    uploadMedicalCard: "Subir Tarjeta Médica",
    uploadMedicalCardDesc: "Por favor suba su tarjeta médica para cumplimiento.",
    documentDeclined: "Documento Rechazado",
    documentDeclinedDesc: "Su documento fue rechazado. Por favor revise y vuelva a subir.",
    goToSettings: "Ir a Configuración",
    allCompleted: "¡Todas las tareas completadas!",
    pendingTasks: "Tareas Pendientes",
  },
  ru: {
    todoList: "Список Задач",
    uploadDriversLicense: "Загрузить Водительские Права",
    uploadDriversLicenseDesc: "Вы назначены водителем. Пожалуйста, загрузите ваши водительские права.",
    updateAddress: "Обновить Физический Адрес",
    updateAddressDesc: "Пожалуйста, укажите ваш текущий физический адрес.",
    uploadMedicalCard: "Загрузить Медицинскую Карту",
    uploadMedicalCardDesc: "Пожалуйста, загрузите вашу медицинскую карту для соответствия.",
    documentDeclined: "Документ Отклонен",
    documentDeclinedDesc: "Ваш документ был отклонен. Пожалуйста, проверьте и загрузите снова.",
    goToSettings: "Перейти в Настройки",
    allCompleted: "Все задачи выполнены!",
    pendingTasks: "Незавершенные Задачи",
  },
};

const MoverTodoList = ({ userId, language, onNavigateToSettings }: MoverTodoListProps) => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const t = translations[language];

  useEffect(() => {
    fetchTodoItems();
  }, [userId]);

  const fetchTodoItems = async () => {
    setLoading(true);
    const items: TodoItem[] = [];

    try {
      // Check if user is a driver and needs to upload license
      const { data: driverStatus } = await supabase
        .from("user_driver_status")
        .select("is_driver, license_url, medical_card_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (driverStatus?.is_driver && !driverStatus.license_url) {
        items.push({
          id: "upload_license",
          title: t.uploadDriversLicense,
          description: t.uploadDriversLicenseDesc,
          completed: false,
          type: "license",
          action: onNavigateToSettings,
        });
      }

      // Check if user has a medical card uploaded (for drivers)
      if (driverStatus?.is_driver && !driverStatus.medical_card_url) {
        items.push({
          id: "upload_medical",
          title: t.uploadMedicalCard,
          description: t.uploadMedicalCardDesc,
          completed: false,
          type: "medical_card",
          action: onNavigateToSettings,
        });
      }

      // Check if address is missing
      const { data: profile } = await supabase
        .from("profiles")
        .select("address")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.address || profile.address.trim() === "") {
        items.push({
          id: "update_address",
          title: t.updateAddress,
          description: t.updateAddressDesc,
          completed: false,
          type: "address",
          action: onNavigateToSettings,
        });
      }

      // Check for declined document reviews
      const { data: declinedDocs } = await supabase
        .from("driver_document_reviews")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "declined");

      if (declinedDocs && declinedDocs.length > 0) {
        declinedDocs.forEach((doc) => {
          items.push({
            id: `declined_${doc.id}`,
            title: `${t.documentDeclined}: ${doc.document_type}`,
            description: doc.decline_reason || t.documentDeclinedDesc,
            completed: false,
            type: "document_decline",
            action: onNavigateToSettings,
          });
        });
      }

      setTodos(items);
    } catch (error) {
      console.error("Error fetching todo items:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "license":
        return <Car className="h-4 w-4" />;
      case "address":
        return <MapPin className="h-4 w-4" />;
      case "medical_card":
        return <IdCard className="h-4 w-4" />;
      case "document_decline":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {language === 'ru' ? 'Загрузка...' : language === 'es' ? 'Cargando...' : 'Loading...'}
        </CardContent>
      </Card>
    );
  }

  // noop marker
        </CardContent>
      </Card>
    );
  }

  const pendingTodos = todos.filter((t) => !t.completed);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {t.todoList}
          {pendingTodos.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingTodos.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingTodos.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 py-4">
            <CheckCircle2 className="h-5 w-5" />
            <span>{t.allCompleted}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTodos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
              >
                <div className="mt-0.5">
                  {todo.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {getIcon(todo.type)}
                    <span className="font-medium text-sm">{todo.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{todo.description}</p>
                  {todo.action && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={todo.action}
                      className="mt-2"
                    >
                      {t.goToSettings}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MoverTodoList;
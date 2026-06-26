import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Upload, 
  File, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  FileText,
  AlertTriangle,
  Shield,
  Download,
  Eye,
  ClipboardList,
  Info,
  History,
  Wine
} from "lucide-react";
import AddressHistoryView from "./AddressHistoryView";
import AdminAlcoholTestList from "./AdminAlcoholTestList";
import UserSettings from "./UserSettings";
import ShiftSchedule from "./ShiftSchedule";
import EmployeeGeneralTab from "./EmployeeGeneralTab";
import KnowledgeBaseViewer from "./KnowledgeBaseViewer";
import EmployeeInfoTab from "./EmployeeInfoTab";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage as useLang } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { getSignedUrl } from "@/lib/storageUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MoverRatingsPage from "@/components/ratings/MoverRatingsPage";
import MobileShell, { type MobileShellNavItem } from "@/components/mobile/MobileShell";
import { Users as UsersIcon, Star, Clock, GraduationCap } from "lucide-react";


interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  username: string;
  avatar_url: string | null;
  license_expires: string | null;
  physical_expires: string | null;
}

interface HRDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  notes: string | null;
  created_at: string;
}

interface PerformanceReport {
  id: string;
  mover_name: string;
  job_id: string;
  incident_date: string;
  incident_description: string;
  report_type: string;
  created_at: string;
}

interface ViolenceIncident {
  id: string;
  mover_name: string;
  job_id: string;
  incident_date: string;
  incident_type: string;
  severity_level: string;
  incident_description: string;
  created_at: string;
}

interface HRDashboardProps {
  userId: string;
}

const hrTranslations = {
  en: {
    title: "HR Cabinet",
    searchPlaceholder: "Search users by name, email, or phone...",
    allUsers: "All Users",
    general: "General",
    employeeInfo: "Employee Info",
    documents: "Documents",
    incidents: "Incidents & Reports",
    name: "Name",
    email: "Email",
    phone: "Phone",
    noUsersFound: "No users found",
    selectUser: "Select a user to view details",
    userDocuments: "User Documents",
    uploadDocument: "Upload Document",
    noDocuments: "No documents uploaded for this user",
    fileName: "File Name",
    uploadedOn: "Uploaded On",
    notes: "Notes",
    actions: "Actions",
    delete: "Delete",
    view: "View",
    download: "Download",
    uploading: "Uploading...",
    upload: "Upload",
    documentNotes: "Document Notes",
    documentNotesPlaceholder: "Add notes about this document...",
    documentUploaded: "Document uploaded successfully",
    documentDeleted: "Document deleted successfully",
    confirmDelete: "Are you sure you want to delete this document?",
    performanceReports: "Performance/Misconduct Reports",
    violenceIncidents: "Violence Incidents",
    noPerformanceReports: "No performance reports for this user",
    noViolenceIncidents: "No violence incidents for this user",
    date: "Date",
    jobId: "Job ID",
    type: "Type",
    description: "Description",
    severity: "Severity",
    comingSoon: "Coming Soon",
    licenseExpiringSoon: "Driver's license expires within 90 days",
    physicalExpiringSoon: "Physical exam expires within 90 days",
    addressHistory: "Address History",
    alcoholTests: "Alcohol Tests",
  },
  es: {
    title: "Gabinete de RRHH",
    searchPlaceholder: "Buscar usuarios por nombre, correo o teléfono...",
    allUsers: "Todos los Usuarios",
    general: "General",
    employeeInfo: "Info del Empleado",
    documents: "Documentos",
    incidents: "Incidentes y Reportes",
    name: "Nombre",
    email: "Correo Electrónico",
    phone: "Teléfono",
    noUsersFound: "No se encontraron usuarios",
    selectUser: "Seleccione un usuario para ver detalles",
    userDocuments: "Documentos del Usuario",
    uploadDocument: "Subir Documento",
    noDocuments: "No hay documentos subidos para este usuario",
    fileName: "Nombre del Archivo",
    uploadedOn: "Subido el",
    notes: "Notas",
    actions: "Acciones",
    delete: "Eliminar",
    view: "Ver",
    download: "Descargar",
    uploading: "Subiendo...",
    upload: "Subir",
    documentNotes: "Notas del Documento",
    documentNotesPlaceholder: "Agregar notas sobre este documento...",
    documentUploaded: "Documento subido exitosamente",
    documentDeleted: "Documento eliminado exitosamente",
    confirmDelete: "¿Está seguro de que desea eliminar este documento?",
    performanceReports: "Reportes de Rendimiento/Conducta",
    violenceIncidents: "Incidentes de Violencia",
    noPerformanceReports: "No hay reportes de rendimiento para este usuario",
    noViolenceIncidents: "No hay incidentes de violencia para este usuario",
    date: "Fecha",
    jobId: "ID de Trabajo",
    type: "Tipo",
    description: "Descripción",
    severity: "Severidad",
    comingSoon: "Próximamente",
    licenseExpiringSoon: "La licencia de conducir vence en 90 días",
    physicalExpiringSoon: "El examen físico vence en 90 días",
    addressHistory: "Historial de Direcciones",
    alcoholTests: "Pruebas de Alcohol",
  },
  ru: {
    title: "Кабинет HR",
    searchPlaceholder: "Поиск пользователей по имени, email или телефону...",
    allUsers: "Все Пользователи",
    general: "Общее",
    employeeInfo: "Инфо Сотрудника",
    documents: "Документы",
    incidents: "Инциденты и Отчеты",
    name: "Имя",
    email: "Email",
    phone: "Телефон",
    noUsersFound: "Пользователи не найдены",
    selectUser: "Выберите пользователя для просмотра",
    userDocuments: "Документы Пользователя",
    uploadDocument: "Загрузить Документ",
    noDocuments: "Документы для этого пользователя не загружены",
    fileName: "Имя Файла",
    uploadedOn: "Загружено",
    notes: "Заметки",
    actions: "Действия",
    delete: "Удалить",
    view: "Просмотр",
    download: "Скачать",
    uploading: "Загрузка...",
    upload: "Загрузить",
    documentNotes: "Заметки к Документу",
    documentNotesPlaceholder: "Добавить заметки об этом документе...",
    documentUploaded: "Документ успешно загружен",
    documentDeleted: "Документ успешно удален",
    confirmDelete: "Вы уверены, что хотите удалить этот документ?",
    performanceReports: "Отчеты о Производительности/Нарушениях",
    violenceIncidents: "Инциденты Насилия",
    noPerformanceReports: "Нет отчетов о производительности для этого пользователя",
    noViolenceIncidents: "Нет инцидентов насилия для этого пользователя",
    date: "Дата",
    jobId: "ID Работы",
    type: "Тип",
    description: "Описание",
    severity: "Серьезность",
    comingSoon: "Скоро",
    licenseExpiringSoon: "Водительские права истекают в течение 90 дней",
    physicalExpiringSoon: "Медосмотр истекает в течение 90 дней",
    addressHistory: "История Адресов",
    alcoholTests: "Тесты на Алкоголь",
  },
};

// Helper to check if a date is within 90 days from now
const isExpiringWithin90Days = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  const expirationDate = new Date(dateStr);
  const today = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(today.getDate() + 90);
  return expirationDate <= ninetyDaysFromNow && expirationDate >= today;
};

const isExpired = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  const expirationDate = new Date(dateStr);
  const today = new Date();
  return expirationDate < today;
};

const hasLicenseAlert = (user: Profile): boolean => {
  return isExpiringWithin90Days(user.license_expires) || 
         isExpired(user.license_expires) ||
         isExpiringWithin90Days(user.physical_expires) || 
         isExpired(user.physical_expires);
};

const HRDashboard = ({ userId }: HRDashboardProps) => {
  const { language } = useLanguage();
  const t = hrTranslations[language];

  const [users, setUsers] = useState<Profile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<HRDocument[]>([]);
  const [performanceReports, setPerformanceReports] = useState<PerformanceReport[]>([]);
  const [violenceIncidents, setViolenceIncidents] = useState<ViolenceIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [documentNotes, setDocumentNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTopTab, setActiveTopTab] = useState<string>("hr-cabinet");


  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserDocuments(selectedUser.id);
      fetchUserIncidents(selectedUser.id);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            `${user.first_name} ${user.last_name}`.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query) ||
            user.phone?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, phone, username, avatar_url, license_expires, physical_expires")
        .order("first_name");

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDocuments = async (targetUserId: string) => {
    try {
      const { data, error } = await supabase
        .from("hr_documents")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  const fetchUserIncidents = async (targetUserId: string) => {
    try {
      // Fetch performance reports where worker_name matches the selected user's name
      const selectedUserProfile = users.find(u => u.id === targetUserId);
      const workerName = selectedUserProfile ? `${selectedUserProfile.first_name} ${selectedUserProfile.last_name}` : "";
      
      const { data: reports, error: reportsError } = await supabase
        .from("performance_reports")
        .select("id, title, incident_datetime, incident_description, incident_category, severity_level, created_at, worker_name")
        .eq("worker_name", workerName)
        .order("created_at", { ascending: false });

      if (reportsError) throw reportsError;
      const mappedReports = (reports || []).map(r => ({
        id: r.id,
        mover_name: r.worker_name,
        job_id: r.title,
        incident_date: r.incident_datetime,
        incident_description: r.incident_description,
        report_type: r.incident_category,
        created_at: r.created_at
      }));
      setPerformanceReports(mappedReports);

      // Fetch violence incidents where mover_id matches
      const { data: incidents, error: incidentsError } = await supabase
        .from("violence_incidents")
        .select("id, mover_name, job_id, incident_date, severity_level, incident_description, created_at")
        .eq("mover_id", targetUserId)
        .order("created_at", { ascending: false });

      if (incidentsError) throw incidentsError;
      const mappedIncidents = (incidents || []).map(i => ({
        id: i.id,
        mover_name: i.mover_name,
        job_id: i.job_id,
        incident_date: i.incident_date,
        incident_type: i.severity_level,
        severity_level: i.severity_level,
        incident_description: i.incident_description,
        created_at: i.created_at
      }));
      setViolenceIncidents(mappedIncidents);
    } catch (error) {
      console.error("Error fetching incidents:", error);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedUser) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${selectedUser.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("hr-documents")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("hr-documents")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("hr_documents").insert({
        user_id: selectedUser.id,
        file_name: selectedFile.name,
        file_url: fileName,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        notes: documentNotes || null,
        uploaded_by: userId,
      });

      if (insertError) throw insertError;

      toast.success(t.documentUploaded);
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setDocumentNotes("");
      fetchUserDocuments(selectedUser.id);
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: HRDocument) => {
    if (!confirm(t.confirmDelete)) return;

    try {
      // Delete from storage
      await supabase.storage.from("hr-documents").remove([doc.file_url]);

      // Delete from database
      const { error } = await supabase
        .from("hr_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast.success(t.documentDeleted);
      if (selectedUser) {
        fetchUserDocuments(selectedUser.id);
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleViewDocument = async (doc: HRDocument) => {
    try {
      const signedUrl = await getSignedUrl("hr-documents", doc.file_url);
      if (signedUrl) {
        window.open(signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error("Failed to open document");
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <div className="flex items-center gap-2">
          <UserSettings userId={userId} language={language} />
          <LanguageSelector language={language} onLanguageChange={() => {}} />
        </div>
      </div>

      <Tabs defaultValue="hr-cabinet" className="w-full">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <TabsList className="inline-flex min-w-max md:flex gap-1 h-auto p-1">
            <TabsTrigger value="hr-cabinet" className="text-xs md:text-sm px-2 md:px-3 py-1.5">HR Cabinet</TabsTrigger>
            <TabsTrigger value="mover-ratings" className="text-xs md:text-sm px-2 md:px-3 py-1.5">Mover Ratings</TabsTrigger>
            <TabsTrigger value="shift-schedule" className="text-xs md:text-sm px-2 md:px-3 py-1.5">Shift Schedule</TabsTrigger>
            <TabsTrigger value="knowledge-base" className="text-xs md:text-sm px-2 md:px-3 py-1.5">Knowledge Base</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="mover-ratings">
          <MoverRatingsPage readOnly />
        </TabsContent>


        <TabsContent value="hr-cabinet">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Users List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t.allUsers}</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Loading...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">{t.noUsersFound}</div>
              ) : (
                <div className="divide-y">
                  {filteredUsers.map((user) => {
                    const showAlert = hasLicenseAlert(user);
                    return (
                      <button
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                          selectedUser?.id === user.id ? "bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.avatar_url || undefined} alt={`${user.first_name} ${user.last_name}`} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {user.first_name?.[0]}{user.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            {showAlert && (
                              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-background" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">
                                {user.first_name} {user.last_name}
                              </p>
                              {showAlert && (
                                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* User Details */}
        <Card className="lg:col-span-2">
          {selectedUser ? (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={selectedUser.avatar_url || undefined} alt={`${selectedUser.first_name} ${selectedUser.last_name}`} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle>
                        {selectedUser.first_name} {selectedUser.last_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedUser.email || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedUser.phone || "N/A"}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="general">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="general" className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      <span className="hidden sm:inline">{t.general}</span>
                    </TabsTrigger>
                    <TabsTrigger value="employee-info" className="flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      <span className="hidden sm:inline">{t.employeeInfo}</span>
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">{t.documents}</span>
                    </TabsTrigger>
                    <TabsTrigger value="incidents" className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="hidden sm:inline">{t.incidents}</span>
                    </TabsTrigger>
                    <TabsTrigger value="address-history" className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      <span className="hidden sm:inline">{t.addressHistory}</span>
                    </TabsTrigger>
                    <TabsTrigger value="alcohol-tests" className="flex items-center gap-2">
                      <Wine className="h-4 w-4" />
                      <span className="hidden sm:inline">{t.alcoholTests}</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="mt-4">
                    <EmployeeGeneralTab
                      userId={userId}
                      employeeId={selectedUser.id}
                      employeeName={`${selectedUser.first_name} ${selectedUser.last_name}`}
                    />
                  </TabsContent>

                  <TabsContent value="employee-info" className="mt-4">
                    <EmployeeInfoTab
                      userId={userId}
                      employeeId={selectedUser.id}
                      employeeName={`${selectedUser.first_name} ${selectedUser.last_name}`}
                    />
                  </TabsContent>

                  <TabsContent value="documents" className="mt-4">
                    <div className="flex justify-end mb-4">
                      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Upload className="h-4 w-4 mr-2" />
                            {t.uploadDocument}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t.uploadDocument}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>File</Label>
                              <Input
                                type="file"
                                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>{t.documentNotes}</Label>
                              <Textarea
                                value={documentNotes}
                                onChange={(e) => setDocumentNotes(e.target.value)}
                                placeholder={t.documentNotesPlaceholder}
                                className="mt-1"
                              />
                            </div>
                            <Button
                              onClick={handleFileUpload}
                              disabled={!selectedFile || uploading}
                              className="w-full"
                            >
                              {uploading ? t.uploading : t.upload}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {documents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>{t.noDocuments}</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.fileName}</TableHead>
                            <TableHead>{t.uploadedOn}</TableHead>
                            <TableHead>{t.notes}</TableHead>
                            <TableHead className="text-right">{t.actions}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {documents.map((doc) => (
                            <TableRow key={doc.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <File className="h-4 w-4 text-muted-foreground" />
                                  {doc.file_name}
                                </div>
                              </TableCell>
                              <TableCell>
                                {format(new Date(doc.created_at), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {doc.notes || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewDocument(doc)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteDocument(doc)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  <TabsContent value="incidents" className="mt-4 space-y-6">
                    {/* Performance Reports */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {t.performanceReports}
                      </h4>
                      {performanceReports.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t.noPerformanceReports}</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t.date}</TableHead>
                              <TableHead>{t.jobId}</TableHead>
                              <TableHead>{t.type}</TableHead>
                              <TableHead>{t.description}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {performanceReports.map((report) => (
                              <TableRow key={report.id}>
                                <TableCell>
                                  {format(new Date(report.incident_date), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell>{report.job_id}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{report.report_type}</Badge>
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate">
                                  {report.incident_description}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    <Separator />

                    {/* Violence Incidents */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {t.violenceIncidents}
                      </h4>
                      {violenceIncidents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t.noViolenceIncidents}</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t.date}</TableHead>
                              <TableHead>{t.jobId}</TableHead>
                              <TableHead>{t.type}</TableHead>
                              <TableHead>{t.severity}</TableHead>
                              <TableHead>{t.description}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {violenceIncidents.map((incident) => (
                              <TableRow key={incident.id}>
                                <TableCell>
                                  {format(new Date(incident.incident_date), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell>{incident.job_id}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{incident.incident_type}</Badge>
                                </TableCell>
                                <TableCell>
                                  {getSeverityBadge(incident.severity_level)}
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate">
                                  {incident.incident_description}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="address-history" className="mt-4">
                    <AddressHistoryView
                      employeeId={selectedUser.id}
                      employeeName={`${selectedUser.first_name} ${selectedUser.last_name}`}
                    />
                  </TabsContent>

                  <TabsContent value="alcohol-tests" className="mt-4">
                    <AdminAlcoholTestList language={language} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center h-[600px] text-muted-foreground">
              <div className="text-center">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t.selectUser}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="shift-schedule">
          <ShiftSchedule userId={userId} language={language} />
        </TabsContent>

        <TabsContent value="knowledge-base" className="space-y-6">
          <KnowledgeBaseViewer userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HRDashboard;

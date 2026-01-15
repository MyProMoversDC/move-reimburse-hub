import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Search, Calendar, Eye, Download } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getSignedUrl } from "@/lib/storageUtils";

interface AlcoholTestReport {
  id: string;
  created_at: string;
  test_date: string;
  test_time: string;
  test_location: string;
  test_type: string;
  test_type_other_explanation: string | null;
  tester_id: string;
  tester_name: string;
  tester_job_title: string;
  worker_id: string;
  worker_name: string;
  worker_classification: string;
  worker_role: string;
  test_timing: string;
  bac_reading_first: number;
  second_test_required: boolean;
  bac_reading_second: number | null;
  final_result: string;
  photo_url: string;
  photo_file_name: string;
  actions_taken: string[];
  additional_notes: string | null;
}

interface AdminAlcoholTestListProps {
  language?: "en" | "es" | "ru";
}

const translations = {
  en: {
    title: "Alcohol Test Reports",
    filterByWorker: "Filter by Worker",
    allWorkers: "All Workers",
    startDate: "Start Date",
    endDate: "End Date",
    clearFilters: "Clear Filters",
    noReports: "No alcohol test reports found",
    submittedAt: "Submitted At",
    testDate: "Test Date",
    workerName: "Worker Name",
    testerName: "Tester",
    result: "Result",
    actions: "Actions",
    view: "View",
    pass: "Pass",
    fail: "Fail",
    refusal: "Refusal",
    reportDetails: "Alcohol Test Report Details",
    testDetails: "Test Details",
    testerInfo: "Tester Information",
    workerInfo: "Worker Information",
    testConditions: "Test Conditions",
    bacResults: "BAC Results",
    photoEvidence: "Photo Evidence",
    actionsTaken: "Actions Taken",
    testTime: "Test Time",
    testLocation: "Location",
    testType: "Type",
    jobTitle: "Job Title",
    classification: "Classification",
    role: "Role",
    timing: "Timing",
    workerConfirmed: "Worker confirmed no consumption",
    waitingPeriod: "15-min waiting period observed",
    firstReading: "First Reading",
    secondReading: "Second Reading",
    additionalNotes: "Additional Notes",
    yes: "Yes",
    no: "No",
    locations: {
      office: "Office",
      warehouse: "Warehouse",
      jobsite: "Job Site",
      other: "Other"
    },
    testTypes: {
      random: "Random",
      suspicion: "Reasonable Suspicion",
      postIncident: "Post-Incident",
      other: "Other"
    },
    classifications: {
      w2: "W-2",
      w9: "W-9",
      temporary: "Temporary / Other"
    },
    roles: {
      driver: "Driver",
      helper: "Helper / Mover",
      equipment: "Equipment Operator",
      warehouse: "Warehouse",
      office: "Office / Admin",
      other: "Other"
    },
    timings: {
      preDispatch: "Pre-dispatch",
      duringShift: "During shift",
      postShift: "Post-shift"
    },
    actionLabels: {
      cleared: "Cleared to work",
      removed: "Removed from duty",
      sentHome: "Sent home",
      transportation: "Transportation arranged",
      escalated: "Escalated to HR / Ownership"
    }
  },
  es: {
    title: "Informes de Prueba de Alcohol",
    filterByWorker: "Filtrar por Trabajador",
    allWorkers: "Todos los Trabajadores",
    startDate: "Fecha Inicio",
    endDate: "Fecha Fin",
    clearFilters: "Limpiar Filtros",
    noReports: "No se encontraron informes de prueba de alcohol",
    submittedAt: "Enviado El",
    testDate: "Fecha de Prueba",
    workerName: "Nombre del Trabajador",
    testerName: "Evaluador",
    result: "Resultado",
    actions: "Acciones",
    view: "Ver",
    pass: "Aprobado",
    fail: "Reprobado",
    refusal: "Rechazo",
    reportDetails: "Detalles del Informe de Prueba de Alcohol",
    testDetails: "Detalles de la Prueba",
    testerInfo: "Información del Evaluador",
    workerInfo: "Información del Trabajador",
    testConditions: "Condiciones de la Prueba",
    bacResults: "Resultados de BAC",
    photoEvidence: "Evidencia Fotográfica",
    actionsTaken: "Acciones Tomadas",
    testTime: "Hora de Prueba",
    testLocation: "Ubicación",
    testType: "Tipo",
    jobTitle: "Título del Puesto",
    classification: "Clasificación",
    role: "Rol",
    timing: "Momento",
    workerConfirmed: "Trabajador confirmó no consumo",
    waitingPeriod: "Período de espera de 15 min observado",
    firstReading: "Primera Lectura",
    secondReading: "Segunda Lectura",
    additionalNotes: "Notas Adicionales",
    yes: "Sí",
    no: "No",
    locations: {
      office: "Oficina",
      warehouse: "Almacén",
      jobsite: "Sitio de Trabajo",
      other: "Otro"
    },
    testTypes: {
      random: "Aleatorio",
      suspicion: "Sospecha Razonable",
      postIncident: "Post-Incidente",
      other: "Otro"
    },
    classifications: {
      w2: "W-2",
      w9: "W-9",
      temporary: "Temporal / Otro"
    },
    roles: {
      driver: "Conductor",
      helper: "Ayudante / Mudador",
      equipment: "Operador de Equipo",
      warehouse: "Almacén",
      office: "Oficina / Admin",
      other: "Otro"
    },
    timings: {
      preDispatch: "Pre-despacho",
      duringShift: "Durante turno",
      postShift: "Post-turno"
    },
    actionLabels: {
      cleared: "Autorizado para trabajar",
      removed: "Removido del servicio",
      sentHome: "Enviado a casa",
      transportation: "Transporte arreglado",
      escalated: "Escalado a RH / Propietarios"
    }
  },
  ru: {
    title: "Отчеты о Тестировании на Алкоголь",
    filterByWorker: "Фильтр по Работнику",
    allWorkers: "Все Работники",
    startDate: "Дата Начала",
    endDate: "Дата Окончания",
    clearFilters: "Очистить Фильтры",
    noReports: "Отчеты о тестировании на алкоголь не найдены",
    submittedAt: "Отправлено",
    testDate: "Дата Теста",
    workerName: "Имя Работника",
    testerName: "Тестирующий",
    result: "Результат",
    actions: "Действия",
    view: "Просмотр",
    pass: "Пройден",
    fail: "Не пройден",
    refusal: "Отказ",
    reportDetails: "Детали Отчета о Тестировании на Алкоголь",
    testDetails: "Детали Теста",
    testerInfo: "Информация о Тестирующем",
    workerInfo: "Информация о Работнике",
    testConditions: "Условия Теста",
    bacResults: "Результаты BAC",
    photoEvidence: "Фото Доказательство",
    actionsTaken: "Предпринятые Действия",
    testTime: "Время Теста",
    testLocation: "Место",
    testType: "Тип",
    jobTitle: "Должность",
    classification: "Классификация",
    role: "Роль",
    timing: "Время",
    workerConfirmed: "Работник подтвердил отсутствие употребления",
    waitingPeriod: "15-мин период ожидания соблюден",
    firstReading: "Первое Показание",
    secondReading: "Второе Показание",
    additionalNotes: "Дополнительные Примечания",
    yes: "Да",
    no: "Нет",
    locations: {
      office: "Офис",
      warehouse: "Склад",
      jobsite: "Рабочий Объект",
      other: "Другое"
    },
    testTypes: {
      random: "Случайный",
      suspicion: "Обоснованное Подозрение",
      postIncident: "После Инцидента",
      other: "Другой"
    },
    classifications: {
      w2: "W-2",
      w9: "W-9",
      temporary: "Временный / Другой"
    },
    roles: {
      driver: "Водитель",
      helper: "Помощник / Грузчик",
      equipment: "Оператор Оборудования",
      warehouse: "Склад",
      office: "Офис / Админ",
      other: "Другое"
    },
    timings: {
      preDispatch: "До выезда",
      duringShift: "Во время смены",
      postShift: "После смены"
    },
    actionLabels: {
      cleared: "Допущен к работе",
      removed: "Отстранен от работы",
      sentHome: "Отправлен домой",
      transportation: "Организована доставка",
      escalated: "Эскалировано в HR / Руководство"
    }
  }
};

const AdminAlcoholTestList = ({ language = "en" }: AdminAlcoholTestListProps) => {
  const t = translations[language];
  const [reports, setReports] = useState<AlcoholTestReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<AlcoholTestReport | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [filterWorkerId, setFilterWorkerId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  useEffect(() => {
    fetchReports();
    fetchWorkers();
  }, [filterWorkerId, filterStartDate, filterEndDate]);

  const fetchWorkers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name");
    
    if (data) {
      setWorkers(data.map((p) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`
      })));
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    let query = supabase
      .from("alcohol_test_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (filterWorkerId) {
      query = query.eq("worker_id", filterWorkerId);
    }
    if (filterStartDate) {
      query = query.gte("test_date", filterStartDate);
    }
    if (filterEndDate) {
      query = query.lte("test_date", filterEndDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching alcohol test reports:", error);
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  const handleViewReport = async (report: AlcoholTestReport) => {
    setSelectedReport(report);
    // Get signed URL for photo
    const signedUrl = await getSignedUrl("alcohol-test-photos", report.photo_url);
    setPhotoUrl(signedUrl);
  };

  const clearFilters = () => {
    setFilterWorkerId("");
    setFilterStartDate("");
    setFilterEndDate("");
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const zonedDate = toZonedTime(date, "America/New_York");
    return format(zonedDate, "MMM dd, yyyy hh:mm a");
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case "pass":
        return <Badge className="bg-green-500">{t.pass}</Badge>;
      case "fail":
        return <Badge variant="destructive">{t.fail}</Badge>;
      case "refusal":
        return <Badge className="bg-amber-500">{t.refusal}</Badge>;
      default:
        return <Badge>{result}</Badge>;
    }
  };

  const getLocationLabel = (location: string) => {
    return t.locations[location as keyof typeof t.locations] || location;
  };

  const getTestTypeLabel = (type: string) => {
    return t.testTypes[type as keyof typeof t.testTypes] || type;
  };

  const getClassificationLabel = (classification: string) => {
    return t.classifications[classification as keyof typeof t.classifications] || classification;
  };

  const getRoleLabel = (role: string) => {
    return t.roles[role as keyof typeof t.roles] || role;
  };

  const getTimingLabel = (timing: string) => {
    return t.timings[timing as keyof typeof t.timings] || timing;
  };

  const getActionLabel = (action: string) => {
    return t.actionLabels[action as keyof typeof t.actionLabels] || action;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>{t.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <Label>{t.filterByWorker}</Label>
            <SearchableSelect
              options={[
                { value: "", label: t.allWorkers },
                ...workers.map((w) => ({ value: w.id, label: w.name }))
              ]}
              value={filterWorkerId}
              onValueChange={setFilterWorkerId}
              placeholder={t.allWorkers}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.startDate}</Label>
            <Input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.endDate}</Label>
            <Input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={clearFilters}>
              {t.clearFilters}
            </Button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t.noReports}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.submittedAt}</TableHead>
                  <TableHead>{t.testDate}</TableHead>
                  <TableHead>{t.workerName}</TableHead>
                  <TableHead>{t.testerName}</TableHead>
                  <TableHead>{t.result}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(report.created_at)}
                    </TableCell>
                    <TableCell>{report.test_date}</TableCell>
                    <TableCell className="font-medium">{report.worker_name}</TableCell>
                    <TableCell>{report.tester_name}</TableCell>
                    <TableCell>{getResultBadge(report.final_result)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReport(report)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {t.view}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t.reportDetails}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              {selectedReport && (
                <div className="space-y-6">
                  {/* Test Details */}
                  <div className="space-y-2">
                    <h4 className="font-semibold border-b pb-1">{t.testDetails}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">{t.testDate}:</span> {selectedReport.test_date}</div>
                      <div><span className="text-muted-foreground">{t.testTime}:</span> {selectedReport.test_time}</div>
                      <div><span className="text-muted-foreground">{t.testLocation}:</span> {getLocationLabel(selectedReport.test_location)}</div>
                      <div><span className="text-muted-foreground">{t.testType}:</span> {getTestTypeLabel(selectedReport.test_type)}</div>
                      {selectedReport.test_type_other_explanation && (
                        <div className="col-span-2"><span className="text-muted-foreground">Details:</span> {selectedReport.test_type_other_explanation}</div>
                      )}
                    </div>
                  </div>

                  {/* Tester Info */}
                  <div className="space-y-2">
                    <h4 className="font-semibold border-b pb-1">{t.testerInfo}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">{t.testerName}:</span> {selectedReport.tester_name}</div>
                      <div><span className="text-muted-foreground">{t.jobTitle}:</span> {selectedReport.tester_job_title}</div>
                    </div>
                  </div>

                  {/* Worker Info */}
                  <div className="space-y-2">
                    <h4 className="font-semibold border-b pb-1">{t.workerInfo}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">{t.workerName}:</span> {selectedReport.worker_name}</div>
                      <div><span className="text-muted-foreground">{t.classification}:</span> {getClassificationLabel(selectedReport.worker_classification)}</div>
                      <div><span className="text-muted-foreground">{t.role}:</span> {getRoleLabel(selectedReport.worker_role)}</div>
                      <div><span className="text-muted-foreground">{t.timing}:</span> {getTimingLabel(selectedReport.test_timing)}</div>
                    </div>
                  </div>

                  {/* BAC Results */}
                  <div className="space-y-2">
                    <h4 className="font-semibold border-b pb-1">{t.bacResults}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">{t.firstReading}:</span> <span className="font-mono">{selectedReport.bac_reading_first}</span></div>
                      {selectedReport.second_test_required && selectedReport.bac_reading_second !== null && (
                        <div><span className="text-muted-foreground">{t.secondReading}:</span> <span className="font-mono">{selectedReport.bac_reading_second}</span></div>
                      )}
                      <div className="col-span-2">
                        <span className="text-muted-foreground">{t.result}:</span> {getResultBadge(selectedReport.final_result)}
                      </div>
                    </div>
                  </div>

                  {/* Photo Evidence */}
                  <div className="space-y-2">
                    <h4 className="font-semibold border-b pb-1">{t.photoEvidence}</h4>
                    {photoUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={photoUrl}
                          alt="BACtrack result"
                          className="max-h-64 rounded-lg border"
                        />
                        <a href={photoUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-1" />
                            {selectedReport.photo_file_name}
                          </Button>
                        </a>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Loading photo...</div>
                    )}
                  </div>

                  {/* Actions Taken */}
                  <div className="space-y-2">
                    <h4 className="font-semibold border-b pb-1">{t.actionsTaken}</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedReport.actions_taken.map((action, idx) => (
                        <Badge key={idx} variant="outline">
                          {getActionLabel(action)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Additional Notes */}
                  {selectedReport.additional_notes && (
                    <div className="space-y-2">
                      <h4 className="font-semibold border-b pb-1">{t.additionalNotes}</h4>
                      <p className="text-sm whitespace-pre-wrap">{selectedReport.additional_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AdminAlcoholTestList;

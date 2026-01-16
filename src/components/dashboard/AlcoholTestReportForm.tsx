import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertTriangle, FileText, Upload, X, CheckCircle2, Shield, Clock, Camera } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface AlcoholTestReportFormProps {
  userId: string;
  language: "en" | "es" | "ru";
  onSuccess?: () => void;
}

const translations = {
  en: {
    title: "Alcohol Testing Report Form",
    subtitle: "BACtrack Trace Breathalyzer Documentation",
    section1Title: "Mandatory Instructions",
    section1Desc: "Please read and acknowledge before proceeding",
    instruction1: "The test must follow MyProMovers Alcohol Testing SOP",
    instruction2: "The worker must wait 15 minutes after eating, drinking, or smoking",
    instruction3: "A new mouthpiece must be used",
    instruction4: "Results must be entered immediately after the test",
    instruction5: "A photo of the BACtrack result is required",
    sopConfirmation: "I confirm that I have read and followed the MyProMovers Alcohol Testing SOP.",
    proceedButton: "Proceed to Form",
    section2Title: "Test Details",
    testDate: "Date of Test",
    testTime: "Time of Test",
    testLocation: "Location of Test",
    testLocationOther: "Specify location",
    testType: "Type of Test",
    otherExplanation: "Please explain",
    section3Title: "Tester Information",
    testerName: "Tester Name",
    jobTitle: "Job Title",
    testerConfirmation: "I personally administered this test using the BACtrack Trace device.",
    section4Title: "Worker Being Tested",
    workerName: "Worker Name",
    workerClassification: "Worker Classification",
    workerRole: "Worker Role at Time of Test",
    testTiming: "Test Timing",
    section5Title: "Test Conditions",
    workerConfirmed: "The worker confirmed they had not eaten, smoked, or consumed alcohol in the last 15 minutes.",
    waitingPeriod: "The required 15-minute waiting period was observed before testing.",
    section6Title: "BAC Results",
    bacFirst: "BAC Reading — First Test",
    secondTestRequired: "Was a second confirmation test required?",
    bacSecond: "BAC Reading — Second Test",
    finalResult: "Final Result",
    resultPass: "Pass — No detectable alcohol",
    resultFail: "Fail — Alcohol detected",
    resultRefusal: "Refusal to test",
    section7Title: "Photo Upload",
    photoRequired: "Upload a clear photo of BACtrack Trace showing the result (Required)",
    section8Title: "Action Taken",
    actionsTaken: "Action After Test",
    additionalNotes: "Additional Notes",
    submit: "Submit Report",
    submitting: "Submitting...",
    success: "Alcohol test report submitted successfully",
    error: "Failed to submit report",
    required: "This field is required",
    photoRequiredError: "Photo upload is required",
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
    actions: {
      cleared: "Cleared to work",
      removed: "Removed from duty",
      sentHome: "Sent home",
      transportation: "Transportation arranged",
      escalated: "Escalated to HR / Ownership"
    }
  },
  es: {
    title: "Formulario de Informe de Prueba de Alcohol",
    subtitle: "Documentación del Alcoholímetro BACtrack Trace",
    section1Title: "Instrucciones Obligatorias",
    section1Desc: "Por favor lea y confirme antes de continuar",
    instruction1: "La prueba debe seguir el SOP de Pruebas de Alcohol de MyProMovers",
    instruction2: "El trabajador debe esperar 15 minutos después de comer, beber o fumar",
    instruction3: "Se debe usar una boquilla nueva",
    instruction4: "Los resultados deben ingresarse inmediatamente después de la prueba",
    instruction5: "Se requiere una foto del resultado de BACtrack",
    sopConfirmation: "Confirmo que he leído y seguido el SOP de Pruebas de Alcohol de MyProMovers.",
    proceedButton: "Continuar al Formulario",
    section2Title: "Detalles de la Prueba",
    testDate: "Fecha de la Prueba",
    testTime: "Hora de la Prueba",
    testLocation: "Ubicación de la Prueba",
    testLocationOther: "Especificar ubicación",
    testType: "Tipo de Prueba",
    otherExplanation: "Por favor explique",
    section3Title: "Información del Evaluador",
    testerName: "Nombre del Evaluador",
    jobTitle: "Título del Puesto",
    testerConfirmation: "Yo personalmente administré esta prueba usando el dispositivo BACtrack Trace.",
    section4Title: "Trabajador Evaluado",
    workerName: "Nombre del Trabajador",
    workerClassification: "Clasificación del Trabajador",
    workerRole: "Rol del Trabajador en el Momento de la Prueba",
    testTiming: "Momento de la Prueba",
    section5Title: "Condiciones de la Prueba",
    workerConfirmed: "El trabajador confirmó que no había comido, fumado o consumido alcohol en los últimos 15 minutos.",
    waitingPeriod: "Se observó el período de espera de 15 minutos requerido antes de la prueba.",
    section6Title: "Resultados de BAC",
    bacFirst: "Lectura de BAC — Primera Prueba",
    secondTestRequired: "¿Se requirió una segunda prueba de confirmación?",
    bacSecond: "Lectura de BAC — Segunda Prueba",
    finalResult: "Resultado Final",
    resultPass: "Aprobado — Sin alcohol detectable",
    resultFail: "Reprobado — Alcohol detectado",
    resultRefusal: "Rechazo a la prueba",
    section7Title: "Carga de Foto",
    photoRequired: "Suba una foto clara del BACtrack Trace mostrando el resultado (Requerido)",
    section8Title: "Acción Tomada",
    actionsTaken: "Acción Después de la Prueba",
    additionalNotes: "Notas Adicionales",
    submit: "Enviar Informe",
    submitting: "Enviando...",
    success: "Informe de prueba de alcohol enviado exitosamente",
    error: "Error al enviar el informe",
    required: "Este campo es requerido",
    photoRequiredError: "Se requiere cargar una foto",
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
    actions: {
      cleared: "Autorizado para trabajar",
      removed: "Removido del servicio",
      sentHome: "Enviado a casa",
      transportation: "Transporte arreglado",
      escalated: "Escalado a RH / Propietarios"
    }
  },
  ru: {
    title: "Форма Отчета о Тестировании на Алкоголь",
    subtitle: "Документация алкотестера BACtrack Trace",
    section1Title: "Обязательные Инструкции",
    section1Desc: "Пожалуйста, прочитайте и подтвердите перед продолжением",
    instruction1: "Тест должен соответствовать SOP MyProMovers по тестированию на алкоголь",
    instruction2: "Работник должен подождать 15 минут после еды, питья или курения",
    instruction3: "Необходимо использовать новый мундштук",
    instruction4: "Результаты должны быть введены сразу после теста",
    instruction5: "Требуется фото результата BACtrack",
    sopConfirmation: "Я подтверждаю, что прочитал и следовал SOP MyProMovers по тестированию на алкоголь.",
    proceedButton: "Перейти к Форме",
    section2Title: "Детали Теста",
    testDate: "Дата Теста",
    testTime: "Время Теста",
    testLocation: "Место Теста",
    testLocationOther: "Укажите место",
    testType: "Тип Теста",
    otherExplanation: "Пожалуйста, объясните",
    section3Title: "Информация о Тестирующем",
    testerName: "Имя Тестирующего",
    jobTitle: "Должность",
    testerConfirmation: "Я лично провел этот тест с использованием устройства BACtrack Trace.",
    section4Title: "Тестируемый Работник",
    workerName: "Имя Работника",
    workerClassification: "Классификация Работника",
    workerRole: "Роль Работника во Время Теста",
    testTiming: "Время Тестирования",
    section5Title: "Условия Теста",
    workerConfirmed: "Работник подтвердил, что не ел, не курил и не употреблял алкоголь в последние 15 минут.",
    waitingPeriod: "Требуемый 15-минутный период ожидания был соблюден перед тестированием.",
    section6Title: "Результаты BAC",
    bacFirst: "Показание BAC — Первый Тест",
    secondTestRequired: "Требовался ли второй подтверждающий тест?",
    bacSecond: "Показание BAC — Второй Тест",
    finalResult: "Итоговый Результат",
    resultPass: "Пройден — Алкоголь не обнаружен",
    resultFail: "Не пройден — Алкоголь обнаружен",
    resultRefusal: "Отказ от теста",
    section7Title: "Загрузка Фото",
    photoRequired: "Загрузите четкое фото BACtrack Trace с результатом (Обязательно)",
    section8Title: "Предпринятые Действия",
    actionsTaken: "Действие После Теста",
    additionalNotes: "Дополнительные Примечания",
    submit: "Отправить Отчет",
    submitting: "Отправка...",
    success: "Отчет о тестировании на алкоголь успешно отправлен",
    error: "Не удалось отправить отчет",
    required: "Это поле обязательно",
    photoRequiredError: "Требуется загрузка фото",
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
    actions: {
      cleared: "Допущен к работе",
      removed: "Отстранен от работы",
      sentHome: "Отправлен домой",
      transportation: "Организована доставка",
      escalated: "Эскалировано в HR / Руководство"
    }
  }
};

const formSchema = z.object({
  testDate: z.string().min(1),
  testTime: z.string().min(1),
  testLocation: z.string().min(1),
  testLocationOther: z.string().optional(),
  testType: z.string().min(1),
  testTypeOtherExplanation: z.string().optional(),
  testerJobTitle: z.string().min(1),
  testerConfirmedAdministered: z.boolean().refine(val => val === true),
  workerId: z.string().min(1),
  workerClassification: z.string().min(1),
  workerRole: z.string().min(1),
  testTiming: z.string().min(1),
  workerConfirmedNoConsumption: z.boolean().refine(val => val === true),
  waitingPeriodObserved: z.boolean().refine(val => val === true),
  bacReadingFirst: z.string().min(1),
  secondTestRequired: z.boolean(),
  bacReadingSecond: z.string().optional(),
  finalResult: z.string().min(1),
  actionsTaken: z.array(z.string()).min(1),
  additionalNotes: z.string().optional()
});

const AlcoholTestReportForm = ({ userId, language, onSuccess }: AlcoholTestReportFormProps) => {
  const t = translations[language];
  const [sopAcknowledged, setSopAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [testerName, setTesterName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      testDate: new Date().toISOString().split("T")[0],
      testTime: "",
      testLocation: "",
      testLocationOther: "",
      testType: "",
      testTypeOtherExplanation: "",
      testerJobTitle: "",
      testerConfirmedAdministered: false,
      workerId: "",
      workerClassification: "",
      workerRole: "",
      testTiming: "",
      workerConfirmedNoConsumption: false,
      waitingPeriodObserved: false,
      bacReadingFirst: "",
      secondTestRequired: false,
      bacReadingSecond: "",
      finalResult: "",
      actionsTaken: [],
      additionalNotes: ""
    }
  });

  const watchTestType = form.watch("testType");
  const watchTestLocation = form.watch("testLocation");
  const watchSecondTestRequired = form.watch("secondTestRequired");

  useEffect(() => {
    const fetchData = async () => {
      // Fetch tester name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        setTesterName(`${profile.first_name} ${profile.last_name}`);
      }

      // Fetch workers (movers)
      const { data: workerProfiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");

      if (workerProfiles) {
        setWorkers(
          workerProfiles.map((p) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`
          }))
        );
      }
    };

    fetchData();
  }, [userId]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!photoFile) {
      toast({
        title: t.error,
        description: t.photoRequiredError,
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      // Upload photo
      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}_${photoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("alcohol-test-photos")
        .upload(fileName, photoFile);

      if (uploadError) throw uploadError;

      const workerName = workers.find((w) => w.id === values.workerId)?.name || "";

      // Determine final location value
      const finalLocation = values.testLocation === "other" && values.testLocationOther
        ? values.testLocationOther
        : values.testLocation;

      // Insert report
      const { error: insertError } = await supabase
        .from("alcohol_test_reports")
        .insert({
          test_date: values.testDate,
          test_time: values.testTime,
          test_location: finalLocation,
          test_type: values.testType,
          test_type_other_explanation: values.testType === "other" ? values.testTypeOtherExplanation : null,
          tester_id: userId,
          tester_name: testerName,
          tester_job_title: values.testerJobTitle,
          tester_confirmed_administered: values.testerConfirmedAdministered,
          worker_id: values.workerId,
          worker_name: workerName,
          worker_classification: values.workerClassification,
          worker_role: values.workerRole,
          test_timing: values.testTiming,
          worker_confirmed_no_consumption: values.workerConfirmedNoConsumption,
          waiting_period_observed: values.waitingPeriodObserved,
          bac_reading_first: parseFloat(values.bacReadingFirst),
          second_test_required: values.secondTestRequired,
          bac_reading_second: values.secondTestRequired && values.bacReadingSecond 
            ? parseFloat(values.bacReadingSecond) 
            : null,
          final_result: values.finalResult,
          photo_url: fileName,
          photo_file_name: photoFile.name,
          actions_taken: values.actionsTaken,
          additional_notes: values.additionalNotes || null,
          sop_acknowledged: true
        });

      if (insertError) throw insertError;

      // Trigger notification if fail or refusal
      if (values.finalResult === "fail" || values.finalResult === "refusal") {
        await supabase.functions.invoke("send-alcohol-test-alert", {
          body: {
            workerName,
            testerName,
            testDate: values.testDate,
            testTime: values.testTime,
            finalResult: values.finalResult,
            bacReading: values.bacReadingFirst,
            actionsTaken: values.actionsTaken
          }
        });
      }

      toast({
        title: t.success,
        description: ""
      });

      form.reset();
      setPhotoFile(null);
      setPhotoPreview(null);
      setSopAcknowledged(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error submitting alcohol test report:", error);
      toast({
        title: t.error,
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const actionOptions = [
    { value: "cleared", label: t.actions.cleared },
    { value: "removed", label: t.actions.removed },
    { value: "sentHome", label: t.actions.sentHome },
    { value: "transportation", label: t.actions.transportation },
    { value: "escalated", label: t.actions.escalated }
  ];

  // Gated Section 1 - SOP Acknowledgment
  if (!sopAcknowledged) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="bg-gradient-to-r from-amber-500/10 to-red-500/10 border-b">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-600" />
            <CardTitle className="text-xl">{t.section1Title}</CardTitle>
          </div>
          <CardDescription>{t.section1Desc}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {t.instruction1}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-700 dark:text-amber-300">{t.instruction2}</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-700 dark:text-amber-300">{t.instruction3}</p>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-700 dark:text-amber-300">{t.instruction4}</p>
            </div>
            <div className="flex items-start gap-3">
              <Camera className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-700 dark:text-amber-300">{t.instruction5}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
            <Checkbox
              id="sop-acknowledgment"
              checked={sopAcknowledged}
              onCheckedChange={(checked) => setSopAcknowledged(checked === true)}
            />
            <Label htmlFor="sop-acknowledgment" className="font-medium cursor-pointer">
              {t.sopConfirmation}
            </Label>
          </div>

          <Button
            onClick={() => setSopAcknowledged(true)}
            disabled={!sopAcknowledged}
            className="w-full"
          >
            {t.proceedButton}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <CardTitle className="text-xl">{t.title}</CardTitle>
        </div>
        <CardDescription>{t.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Section 2: Test Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t.section2Title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="testDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.testDate} *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="testTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.testTime} *</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="testLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.testLocation} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="office">{t.locations.office}</SelectItem>
                            <SelectItem value="warehouse">{t.locations.warehouse}</SelectItem>
                            <SelectItem value="jobsite">{t.locations.jobsite}</SelectItem>
                            <SelectItem value="other">{t.locations.other}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchTestLocation === "other" && (
                    <FormField
                      control={form.control}
                      name="testLocationOther"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.testLocationOther} *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t.testLocationOther} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="testType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.testType} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="random">{t.testTypes.random}</SelectItem>
                          <SelectItem value="suspicion">{t.testTypes.suspicion}</SelectItem>
                          <SelectItem value="postIncident">{t.testTypes.postIncident}</SelectItem>
                          <SelectItem value="other">{t.testTypes.other}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {watchTestType === "other" && (
                <FormField
                  control={form.control}
                  name="testTypeOtherExplanation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.otherExplanation} *</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Section 3: Tester Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t.section3Title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.testerName}</Label>
                  <Input value={testerName} disabled className="bg-muted" />
                </div>
                <FormField
                  control={form.control}
                  name="testerJobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.jobTitle} *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="testerConfirmedAdministered"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-medium cursor-pointer">
                      {t.testerConfirmation} *
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Section 4: Worker Being Tested */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t.section4Title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="workerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.workerName} *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={workers.map((w) => ({ value: w.id, label: w.name }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder={t.workerName}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="workerClassification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.workerClassification} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="w2">{t.classifications.w2}</SelectItem>
                          <SelectItem value="w9">{t.classifications.w9}</SelectItem>
                          <SelectItem value="temporary">{t.classifications.temporary}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="workerRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.workerRole} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="driver">{t.roles.driver}</SelectItem>
                          <SelectItem value="helper">{t.roles.helper}</SelectItem>
                          <SelectItem value="equipment">{t.roles.equipment}</SelectItem>
                          <SelectItem value="warehouse">{t.roles.warehouse}</SelectItem>
                          <SelectItem value="office">{t.roles.office}</SelectItem>
                          <SelectItem value="other">{t.roles.other}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="testTiming"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.testTiming} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="preDispatch">{t.timings.preDispatch}</SelectItem>
                          <SelectItem value="duringShift">{t.timings.duringShift}</SelectItem>
                          <SelectItem value="postShift">{t.timings.postShift}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 5: Test Conditions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t.section5Title}</h3>
              <FormField
                control={form.control}
                name="workerConfirmedNoConsumption"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-medium cursor-pointer">
                      {t.workerConfirmed} *
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="waitingPeriodObserved"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-medium cursor-pointer">
                      {t.waitingPeriod} *
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Section 6: BAC Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t.section6Title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bacReadingFirst"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.bacFirst} *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          max="0.999"
                          placeholder="0.000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="secondTestRequired"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.secondTestRequired} *</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val === "yes")}
                        value={field.value ? "yes" : "no"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {watchSecondTestRequired && (
                <FormField
                  control={form.control}
                  name="bacReadingSecond"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.bacSecond} *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          max="0.999"
                          placeholder="0.000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="finalResult"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.finalResult} *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                          <RadioGroupItem value="pass" id="pass" />
                          <Label htmlFor="pass" className="flex-1 cursor-pointer">
                            <span className="text-green-600 font-medium">{t.resultPass}</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 border-red-200">
                          <RadioGroupItem value="fail" id="fail" />
                          <Label htmlFor="fail" className="flex-1 cursor-pointer">
                            <span className="text-red-600 font-medium">{t.resultFail}</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 border-amber-200">
                          <RadioGroupItem value="refusal" id="refusal" />
                          <Label htmlFor="refusal" className="flex-1 cursor-pointer">
                            <span className="text-amber-600 font-medium">{t.resultRefusal}</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Section 7: Photo Upload */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t.section7Title}</h3>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                {photoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={photoPreview}
                      alt="BACtrack result"
                      className="max-h-48 rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={removePhoto}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">{t.photoRequired}</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Section 8: Action Taken */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t.section8Title}</h3>
              <FormField
                control={form.control}
                name="actionsTaken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.actionsTaken} *</FormLabel>
                    <div className="space-y-2">
                      {actionOptions.map((action) => (
                        <div
                          key={action.value}
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={field.value.includes(action.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, action.value]);
                              } else {
                                field.onChange(
                                  field.value.filter((v) => v !== action.value)
                                );
                              }
                            }}
                          />
                          <Label className="cursor-pointer">{action.label}</Label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="additionalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.additionalNotes}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t.submitting : t.submit}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default AlcoholTestReportForm;

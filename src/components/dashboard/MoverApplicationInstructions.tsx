import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText, Video, Image as ImageIcon, File as FileIcon, Download, CheckCircle2, GraduationCap } from "lucide-react";

interface Material {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
}

const BUCKET = "application-instructions";

const translations = {
  en: {
    title: "Application Instructions",
    intro: "Please review all uploaded manuals and watch every training video below to learn how to use the application. Once you have finished studying every file, mark the training as completed.",
    empty: "No instructions have been uploaded yet. Please check back later.",
    view: "Open",
    markComplete: "I have completed studying all materials",
    completedTitle: "Training completed",
    completedBody: "Thank you — you've marked your app instruction training as completed. You will no longer receive the daily reminder.",
    reset: "Reset completion",
  },
  es: {
    title: "Instrucciones de la Aplicación",
    intro: "Por favor revise todos los manuales cargados y vea cada video de capacitación a continuación para aprender a usar la aplicación. Una vez que haya terminado de estudiar todos los archivos, marque la capacitación como completada.",
    empty: "Aún no se han subido instrucciones. Por favor vuelva más tarde.",
    view: "Abrir",
    markComplete: "He terminado de estudiar todos los materiales",
    completedTitle: "Capacitación completada",
    completedBody: "Gracias — ha marcado su capacitación como completada. Ya no recibirá el recordatorio diario.",
    reset: "Reiniciar finalización",
  },
  ru: {
    title: "Инструкции по приложению",
    intro: "Пожалуйста, изучите все загруженные руководства и просмотрите каждое обучающее видео ниже, чтобы научиться пользоваться приложением. После того как вы закончите изучение всех файлов, отметьте обучение как завершённое.",
    empty: "Инструкции ещё не загружены. Пожалуйста, зайдите позже.",
    view: "Открыть",
    markComplete: "Я закончил изучать все материалы",
    completedTitle: "Обучение завершено",
    completedBody: "Спасибо — вы отметили обучение как завершённое. Ежедневное напоминание больше не будет появляться.",
    reset: "Сбросить статус",
  },
};

const MoverApplicationInstructions = ({
  userId,
  language,
}: {
  userId: string;
  language: "en" | "es" | "ru";
}) => {
  const t = translations[language];
  const [materials, setMaterials] = useState<Material[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const load = async () => {
    setLoading(true);
    const [{ data: mats }, { data: comp }] = await Promise.all([
      supabase
        .from("application_instruction_materials")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("application_instruction_completions")
        .select("completed_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const list: Material[] = mats || [];
    setMaterials(list);
    setCompleted(!!comp?.completed_at);

    if (list.length > 0) {
      const paths = list.map((m) => m.file_url);
      const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      urls?.forEach((u, i) => {
        if (u.signedUrl) map[list[i].id] = u.signedUrl;
      });
      setSigned(map);
    }
    setLoading(false);
  };

  const markComplete = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("application_instruction_completions")
      .upsert(
        {
          user_id: userId,
          completed_at: new Date().toISOString(),
          last_reminded_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) toast.error("Failed to save");
    else {
      setCompleted(true);
      toast.success(t.completedTitle);
    }
  };

  const reset = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("application_instruction_completions")
      .update({ completed_at: null, last_reminded_at: null })
      .eq("user_id", userId);
    setSaving(false);
    if (!error) setCompleted(false);
  };

  const iconFor = (ft: string) => {
    if (ft.startsWith("video/")) return <Video className="h-5 w-5 text-primary" />;
    if (ft.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-primary" />;
    if (ft.includes("pdf") || ft.startsWith("text/")) return <FileText className="h-5 w-5 text-primary" />;
    return <FileIcon className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">{t.title}</h2>
      </div>

      <Alert className="border-primary bg-primary/10">
        <AlertTitle className="font-semibold text-foreground">{t.title}</AlertTitle>
        <AlertDescription className="text-foreground">{t.intro}</AlertDescription>
      </Alert>

      {completed && (
        <Alert className="border-green-600 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-foreground">{t.completedTitle}</AlertTitle>
          <AlertDescription className="text-foreground">
            {t.completedBody}
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
                {t.reset}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : materials.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">{t.empty}</Card>
      ) : (
        <div className="space-y-4">
          {materials.map((m) => {
            const url = signed[m.id];
            return (
              <Card key={m.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">{iconFor(m.file_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{m.title}</p>
                    {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1 truncate">{m.file_name}</p>
                  </div>
                  {url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-1" /> {t.view}
                      </a>
                    </Button>
                  )}
                </div>
                {url && m.file_type.startsWith("video/") && (
                  <video src={url} controls preload="metadata" className="w-full rounded-lg max-h-96 bg-muted" />
                )}
                {url && m.file_type.startsWith("image/") && (
                  <img src={url} alt={m.title} className="w-full rounded-lg max-h-96 object-contain bg-muted" />
                )}
                {url && m.file_type.includes("pdf") && (
                  <iframe src={url} className="w-full h-[500px] rounded-lg border" title={m.title} />
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!completed && materials.length > 0 && (
        <Card className="p-4 sticky bottom-2 border-primary">
          <Button className="w-full" size="lg" onClick={markComplete} disabled={saving}>
            <CheckCircle2 className="h-5 w-5 mr-2" />
            {t.markComplete}
          </Button>
        </Card>
      )}
    </div>
  );
};

export default MoverApplicationInstructions;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen } from "lucide-react";

interface Props {
  userId: string;
  language: "en" | "es" | "ru";
  /** Called once the popup has resolved (either action taken or nothing to show). */
  onDone: () => void;
  /** Navigate the mover to the Application Instructions tab. */
  onGoToTab: () => void;
}

const translations = {
  en: {
    title: "Learn how to use the app",
    body: "We've prepared manuals and short training videos to help you get comfortable with every part of the app. Please review them at your own pace. You'll get a friendly reminder once every 24 hours until you mark your training as completed.",
    go: "Go to Instructions",
    skip: "Skip for now",
  },
  es: {
    title: "Aprenda a usar la aplicación",
    body: "Hemos preparado manuales y videos cortos de capacitación para ayudarle a familiarizarse con cada parte de la aplicación. Revíselos a su propio ritmo. Recibirá un recordatorio amistoso cada 24 horas hasta que marque su capacitación como completada.",
    go: "Ir a las Instrucciones",
    skip: "Omitir por ahora",
  },
  ru: {
    title: "Изучите работу с приложением",
    body: "Мы подготовили руководства и короткие обучающие видео, чтобы помочь вам освоить все разделы приложения. Изучайте их в удобном темпе. Вы будете получать напоминание раз в 24 часа, пока не отметите обучение как завершённое.",
    go: "Перейти к инструкциям",
    skip: "Пропустить пока",
  },
};

const ApplicationInstructionsPopup = ({ userId, language, onDone, onGoToTab }: Props) => {
  const t = translations[language];
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from("application_instruction_completions")
        .select("completed_at, last_reminded_at")
        .eq("user_id", userId)
        .maybeSingle();

      // Already completed — never show again.
      if (data?.completed_at) {
        setChecked(true);
        onDone();
        return;
      }

      // Enforce 24h cooldown between reminders.
      if (data?.last_reminded_at) {
        const last = new Date(data.last_reminded_at).getTime();
        if (Date.now() - last < 24 * 60 * 60 * 1000) {
          setChecked(true);
          onDone();
          return;
        }
      }

      // Show + record reminder timestamp.
      await supabase
        .from("application_instruction_completions")
        .upsert(
          { user_id: userId, last_reminded_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      setOpen(true);
      setChecked(true);
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!checked) return null;

  const close = () => {
    setOpen(false);
    onDone();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {t.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="pt-2 text-base text-foreground">
            {t.body}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={close} className="w-full sm:w-auto">
            {t.skip}
          </Button>
          <Button
            onClick={() => {
              onGoToTab();
              close();
            }}
            className="w-full sm:w-auto"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            {t.go}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ApplicationInstructionsPopup;

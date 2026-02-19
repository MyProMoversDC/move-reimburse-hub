import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { pqt } from "@/lib/paymentQuestionTranslations";
import { Language } from "@/lib/translations";
import { Send, AlertTriangle, Upload, X } from "lucide-react";

const formSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  otherSubject: z.string().optional(),
  jobNumber: z.string().min(1, "Job number is required"),
  questionDetails: z.string().min(1, "Question details are required"),
}).refine((data) => {
  if (data.subject === "other" && (!data.otherSubject || data.otherSubject.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Please specify the subject",
  path: ["otherSubject"],
});

type FormValues = z.infer<typeof formSchema>;

interface PaymentQuestionFormProps {
  userId: string;
  language: Language;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PaymentQuestionForm = ({ userId, language, onSuccess, onCancel }: PaymentQuestionFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moverName, setMoverName] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      otherSubject: "",
      jobNumber: "",
      questionDetails: "",
    },
  });

  const watchedSubject = form.watch("subject");

  useEffect(() => {
    const fetchName = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .single();
      if (data) setMoverName(`${data.first_name} ${data.last_name}`);
    };
    fetchName();
  }, [userId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      // Insert the question
      const { data: question, error: insertError } = await supabase
        .from("payment_questions")
        .insert({
          mover_id: userId,
          mover_name: moverName,
          subject: values.subject,
          other_subject: values.subject === "other" ? values.otherSubject : null,
          job_number: values.jobNumber,
          question_details: values.questionDetails,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload attachments
      if (attachments.length > 0 && question) {
        for (const file of attachments) {
          const fileExt = file.name.split(".").pop();
          const filePath = `${userId}/${question.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("payment-question-attachments")
            .upload(filePath, file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }

          await supabase.from("payment_question_attachments").insert({
            question_id: question.id,
            file_url: filePath,
            file_name: file.name,
            file_type: file.type,
          });
        }
      }

      // Send email notification
      try {
        await supabase.functions.invoke("send-payment-question-notification", {
          body: {
            moverName,
            subject: values.subject === "other" ? values.otherSubject : values.subject,
            jobNumber: values.jobNumber,
            questionDetails: values.questionDetails,
            questionId: question.id,
          },
        });
      } catch (emailError) {
        console.error("Email notification error:", emailError);
      }

      toast.success(pqt("submitSuccess", language));
      form.reset();
      setAttachments([]);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting payment question:", error);
      toast.error(pqt("submitError", language));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          {pqt("formTitle", language)}
        </CardTitle>
        <CardDescription>{pqt("formDescription", language)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Mover Name - Read Only */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{pqt("moverName", language)}</label>
              <Input value={moverName} readOnly className="bg-muted" />
            </div>

            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{pqt("subject", language)} *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={pqt("selectSubject", language)} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="payment">{pqt("payment", language)}</SelectItem>
                      <SelectItem value="hours">{pqt("hours", language)}</SelectItem>
                      <SelectItem value="other">{pqt("other", language)}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Other Subject */}
            {watchedSubject === "other" && (
              <FormField
                control={form.control}
                name="otherSubject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{pqt("otherSubject", language)} *</FormLabel>
                    <FormControl>
                      <Input placeholder={pqt("otherSubjectPlaceholder", language)} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Job Number */}
            <FormField
              control={form.control}
              name="jobNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{pqt("jobNumber", language)} *</FormLabel>
                  <FormControl>
                    <Input placeholder={pqt("jobNumberPlaceholder", language)} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Question Details */}
            <FormField
              control={form.control}
              name="questionDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{pqt("questionDetails", language)} *</FormLabel>
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 p-3 rounded-lg border-2 border-amber-400 dark:border-amber-500 mb-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        {pqt("questionDisclaimer", language)}
                      </p>
                    </div>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder={pqt("questionPlaceholder", language)}
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attachments */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{pqt("attachments", language)}</label>
              <p className="text-xs text-muted-foreground">{pqt("attachmentsDescription", language)}</p>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors text-sm">
                  <Upload className="h-4 w-4" />
                  {pqt("attachments", language)}
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
              {attachments.length > 0 && (
                <div className="space-y-1 mt-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                      <span className="truncate flex-1">{file.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? pqt("submitting", language) : pqt("submit", language)}
            </Button>

            {onCancel && (
              <Button type="button" variant="outline" className="w-full md:hidden mt-2" onClick={onCancel}>
                {pqt("close", language)}
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default PaymentQuestionForm;

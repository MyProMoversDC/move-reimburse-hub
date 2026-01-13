import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image, Video, FileText, BarChart2, X, Plus, Loader2, Clock, Send, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import PostPreview from "./PostPreview";

interface ExistingAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

interface ExistingPoll {
  id: string;
  question: string;
  feed_post_poll_options: {
    id: string;
    option_text: string;
    sort_order: number;
  }[];
}

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
  editPost?: {
    id: string;
    content: string;
    feed_post_attachments?: ExistingAttachment[];
    feed_post_polls?: ExistingPoll | null;
  } | null;
  language: 'en' | 'es' | 'ru';
}

const translations = {
  en: {
    createPost: "Create Post",
    editPost: "Edit Post",
    content: "Content",
    placeholder: "What do you want to share with the team?",
    addPoll: "Add Poll",
    pollQuestion: "Poll Question",
    pollQuestionPlaceholder: "Ask a question...",
    pollOptions: "Options",
    optionPlaceholder: "Option",
    addOption: "Add Option",
    attachments: "Attachments",
    existingAttachments: "Current Attachments",
    newAttachments: "Add New Attachments",
    cancel: "Cancel",
    post: "Post Now",
    save: "Save Changes",
    uploading: "Uploading...",
    postSuccess: "Post created successfully",
    scheduledSuccess: "Post scheduled successfully",
    updateSuccess: "Post updated successfully",
    error: "Something went wrong",
    publishing: "Publishing",
    scheduling: "Scheduling",
    postNow: "Post immediately",
    schedulePost: "Schedule for later",
    selectDate: "Select date",
    selectTime: "Select time",
    preview: "Preview",
    schedule: "Schedule",
  },
  es: {
    createPost: "Crear Publicación",
    editPost: "Editar Publicación",
    content: "Contenido",
    placeholder: "¿Qué quieres compartir con el equipo?",
    addPoll: "Agregar Encuesta",
    pollQuestion: "Pregunta de la Encuesta",
    pollQuestionPlaceholder: "Haz una pregunta...",
    pollOptions: "Opciones",
    optionPlaceholder: "Opción",
    addOption: "Agregar Opción",
    attachments: "Adjuntos",
    existingAttachments: "Adjuntos Actuales",
    newAttachments: "Agregar Nuevos Adjuntos",
    cancel: "Cancelar",
    post: "Publicar Ahora",
    save: "Guardar Cambios",
    uploading: "Subiendo...",
    postSuccess: "Publicación creada exitosamente",
    scheduledSuccess: "Publicación programada exitosamente",
    updateSuccess: "Publicación actualizada exitosamente",
    error: "Algo salió mal",
    publishing: "Publicando",
    scheduling: "Programando",
    postNow: "Publicar inmediatamente",
    schedulePost: "Programar para después",
    selectDate: "Seleccionar fecha",
    selectTime: "Seleccionar hora",
    preview: "Vista Previa",
    schedule: "Programar",
  },
  ru: {
    createPost: "Создать Пост",
    editPost: "Редактировать Пост",
    content: "Содержание",
    placeholder: "Чем хотите поделиться с командой?",
    addPoll: "Добавить Опрос",
    pollQuestion: "Вопрос Опроса",
    pollQuestionPlaceholder: "Задайте вопрос...",
    pollOptions: "Варианты",
    optionPlaceholder: "Вариант",
    addOption: "Добавить Вариант",
    attachments: "Вложения",
    existingAttachments: "Текущие Вложения",
    newAttachments: "Добавить Новые Вложения",
    cancel: "Отмена",
    post: "Опубликовать Сейчас",
    save: "Сохранить Изменения",
    uploading: "Загрузка...",
    postSuccess: "Пост успешно создан",
    scheduledSuccess: "Пост успешно запланирован",
    updateSuccess: "Пост успешно обновлен",
    error: "Что-то пошло не так",
    publishing: "Публикация",
    scheduling: "Планирование",
    postNow: "Опубликовать сразу",
    schedulePost: "Запланировать на позже",
    selectDate: "Выбрать дату",
    selectTime: "Выбрать время",
    preview: "Предпросмотр",
    schedule: "Запланировать",
  },
};

const CreatePostDialog = ({ open, onOpenChange, userId, onSuccess, editPost, language }: CreatePostDialogProps) => {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachment[]>([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<string[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [existingPollId, setExistingPollId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Scheduling state
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("12:00");
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  const t = translations[language];
  const isEditing = !!editPost;

  // Reset state when dialog opens with editPost
  useEffect(() => {
    if (open && editPost) {
      setContent(editPost.content || "");
      setExistingAttachments(editPost.feed_post_attachments || []);
      setAttachmentsToDelete([]);
      setFiles([]);
      setShowPoll(!!editPost.feed_post_polls);
      setPollQuestion(editPost.feed_post_polls?.question || "");
      const sortedOptions = editPost.feed_post_polls?.feed_post_poll_options
        ?.sort((a, b) => a.sort_order - b.sort_order)
        .map(opt => opt.option_text) || ["", ""];
      setPollOptions(sortedOptions.length >= 2 ? sortedOptions : ["", ""]);
      setExistingPollId(editPost.feed_post_polls?.id || null);
    } else if (open && !editPost) {
      // Reset for new post
      setContent("");
      setExistingAttachments([]);
      setAttachmentsToDelete([]);
      setFiles([]);
      setShowPoll(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setExistingPollId(null);
      setPublishMode("now");
      setScheduledDate(undefined);
      setScheduledTime("12:00");
      setShowPreview(false);
    }
  }, [open, editPost]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (attachmentId: string) => {
    setAttachmentsToDelete((prev) => [...prev, attachmentId]);
    setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!content.trim() && files.length === 0 && existingAttachments.length === 0 && !showPoll) {
      return;
    }

    setLoading(true);

    try {
      let postId = editPost?.id;

      if (isEditing && postId) {
        // Update existing post content
        const { error } = await supabase
          .from("feed_posts")
          .update({ content: content.trim(), updated_at: new Date().toISOString() })
          .eq("id", postId);

        if (error) throw error;

        // Delete marked attachments from storage and database
        for (const attachmentId of attachmentsToDelete) {
          const attachment = editPost?.feed_post_attachments?.find(a => a.id === attachmentId);
          if (attachment) {
            // Extract path from URL
            const urlParts = attachment.file_url.split("/feed-attachments/");
            if (urlParts.length > 1) {
              const path = urlParts[1];
              await supabase.storage.from("feed-attachments").remove([path]);
            }
          }
          await supabase.from("feed_post_attachments").delete().eq("id", attachmentId);
        }

        // Upload new files
        for (const file of files) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${postId}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("feed-attachments")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("feed-attachments")
            .getPublicUrl(fileName);

          await supabase.from("feed_post_attachments").insert({
            post_id: postId,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          });
        }

        // Handle poll updates
        if (showPoll && pollQuestion.trim()) {
          const validOptions = pollOptions.filter((opt) => opt.trim());
          if (validOptions.length >= 2) {
            if (existingPollId) {
              // Update existing poll
              await supabase
                .from("feed_post_polls")
                .update({ question: pollQuestion.trim() })
                .eq("id", existingPollId);

              // Delete old options and create new ones
              await supabase.from("feed_post_poll_options").delete().eq("poll_id", existingPollId);

              const optionsToInsert = validOptions.map((opt, index) => ({
                poll_id: existingPollId,
                option_text: opt.trim(),
                sort_order: index,
              }));

              await supabase.from("feed_post_poll_options").insert(optionsToInsert);
            } else {
              // Create new poll
              const { data: pollData, error: pollError } = await supabase
                .from("feed_post_polls")
                .insert({ post_id: postId, question: pollQuestion.trim() })
                .select()
                .single();

              if (pollError) throw pollError;

              const optionsToInsert = validOptions.map((opt, index) => ({
                poll_id: pollData.id,
                option_text: opt.trim(),
                sort_order: index,
              }));

              await supabase.from("feed_post_poll_options").insert(optionsToInsert);
            }
          }
        } else if (!showPoll && existingPollId) {
          // Remove poll if it was disabled
          await supabase.from("feed_post_poll_options").delete().eq("poll_id", existingPollId);
          await supabase.from("feed_post_polls").delete().eq("id", existingPollId);
        }
      } else {
        // Create new post with scheduling support
        let scheduledAt: string | null = null;
        let isPublished = true;
        
        if (publishMode === "schedule" && scheduledDate) {
          const [hours, minutes] = scheduledTime.split(":").map(Number);
          const scheduledDateTime = new Date(scheduledDate);
          scheduledDateTime.setHours(hours, minutes, 0, 0);
          scheduledAt = scheduledDateTime.toISOString();
          isPublished = false;
        }
        
        const { data: postData, error: postError } = await supabase
          .from("feed_posts")
          .insert({ 
            content: content.trim(), 
            created_by: userId,
            scheduled_at: scheduledAt,
            is_published: isPublished,
          })
          .select()
          .single();

        if (postError) throw postError;
        postId = postData.id;

        // Upload files
        for (const file of files) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${postId}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("feed-attachments")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("feed-attachments")
            .getPublicUrl(fileName);

          await supabase.from("feed_post_attachments").insert({
            post_id: postId,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          });
        }

        // Create poll if enabled
        if (showPoll && pollQuestion.trim()) {
          const validOptions = pollOptions.filter((opt) => opt.trim());
          if (validOptions.length >= 2) {
            const { data: pollData, error: pollError } = await supabase
              .from("feed_post_polls")
              .insert({ post_id: postId, question: pollQuestion.trim() })
              .select()
              .single();

            if (pollError) throw pollError;

            const optionsToInsert = validOptions.map((opt, index) => ({
              poll_id: pollData.id,
              option_text: opt.trim(),
              sort_order: index,
            }));

            await supabase.from("feed_post_poll_options").insert(optionsToInsert);
          }
        }
      }

      const successMessage = isEditing 
        ? t.updateSuccess 
        : (publishMode === "schedule" ? t.scheduledSuccess : t.postSuccess);
      toast.success(successMessage);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error creating/updating post:", error);
      toast.error(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setContent("");
    setFiles([]);
    setExistingAttachments([]);
    setAttachmentsToDelete([]);
    setShowPoll(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setExistingPollId(null);
    setPublishMode("now");
    setScheduledDate(undefined);
    setScheduledTime("12:00");
    setShowPreview(false);
    onOpenChange(false);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (file.type.startsWith("video/")) return <Video className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const getExistingFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (fileType.startsWith("video/")) return <Video className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t.editPost : t.createPost}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Content */}
          <div className="space-y-2">
            <Label>{t.content}</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.placeholder}
              rows={4}
            />
          </div>

          {/* Existing Attachments (for editing) */}
          {isEditing && existingAttachments.length > 0 && (
            <div className="space-y-2">
              <Label>{t.existingAttachments}</Label>
              <div className="space-y-2">
                {existingAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getExistingFileIcon(attachment.file_type)}
                      <span className="text-sm truncate">{attachment.file_name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeExistingAttachment(attachment.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Attachments */}
          <div className="space-y-2">
            <Label>{isEditing ? t.newAttachments : t.attachments}</Label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-4 w-4 mr-2" />
                Add Files
              </Button>
            </div>

            {files.length > 0 && (
              <div className="space-y-2 mt-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(file)}
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Poll */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                {t.addPoll}
              </Label>
              <Switch checked={showPoll} onCheckedChange={setShowPoll} />
            </div>

            {showPoll && (
              <div className="space-y-3 p-3 border rounded-lg">
                <div className="space-y-2">
                  <Label>{t.pollQuestion}</Label>
                  <Input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder={t.pollQuestionPlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.pollOptions}</Label>
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        placeholder={`${t.optionPlaceholder} ${index + 1}`}
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePollOption(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPollOption}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t.addOption}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scheduling Options - Only for new posts */}
          {!isEditing && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <Label className="flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4" />
                {t.publishing}
              </Label>
              <RadioGroup value={publishMode} onValueChange={(v) => setPublishMode(v as "now" | "schedule")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="now" id="now" />
                  <Label htmlFor="now" className="font-normal cursor-pointer flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    {t.postNow}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="schedule" id="schedule" />
                  <Label htmlFor="schedule" className="font-normal cursor-pointer flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t.schedulePost}
                  </Label>
                </div>
              </RadioGroup>
              
              {publishMode === "schedule" && (
                <div className="flex flex-col sm:flex-row gap-3 mt-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal flex-1",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "PPP") : t.selectDate}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full sm:w-32"
                  />
                </div>
              )}
            </div>
          )}

          {/* Preview Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label className="flex items-center gap-2 cursor-pointer">
              <Eye className="h-4 w-4" />
              {t.preview}
            </Label>
            <Switch checked={showPreview} onCheckedChange={setShowPreview} />
          </div>

          {/* Post Preview */}
          {showPreview && (
            <PostPreview
              content={content}
              files={files}
              existingAttachments={existingAttachments}
              showPoll={showPoll}
              pollQuestion={pollQuestion}
              pollOptions={pollOptions}
              language={language}
            />
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {t.cancel}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || (publishMode === "schedule" && !scheduledDate)}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? t.save : (publishMode === "schedule" ? t.schedule : t.post)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog;
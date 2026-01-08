import { useState, useRef } from "react";
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
import { Image, Video, FileText, BarChart2, X, Plus, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
  editPost?: {
    id: string;
    content: string;
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
    cancel: "Cancel",
    post: "Post",
    save: "Save Changes",
    uploading: "Uploading...",
    postSuccess: "Post created successfully",
    updateSuccess: "Post updated successfully",
    error: "Something went wrong",
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
    cancel: "Cancelar",
    post: "Publicar",
    save: "Guardar Cambios",
    uploading: "Subiendo...",
    postSuccess: "Publicación creada exitosamente",
    updateSuccess: "Publicación actualizada exitosamente",
    error: "Algo salió mal",
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
    cancel: "Отмена",
    post: "Опубликовать",
    save: "Сохранить Изменения",
    uploading: "Загрузка...",
    postSuccess: "Пост успешно создан",
    updateSuccess: "Пост успешно обновлен",
    error: "Что-то пошло не так",
  },
};

const CreatePostDialog = ({ open, onOpenChange, userId, onSuccess, editPost, language }: CreatePostDialogProps) => {
  const [content, setContent] = useState(editPost?.content || "");
  const [files, setFiles] = useState<File[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[language];
  const isEditing = !!editPost;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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
    if (!content.trim() && files.length === 0 && !showPoll) {
      return;
    }

    setLoading(true);

    try {
      let postId = editPost?.id;

      if (isEditing) {
        // Update existing post
        const { error } = await supabase
          .from("feed_posts")
          .update({ content: content.trim() })
          .eq("id", postId);

        if (error) throw error;
      } else {
        // Create new post
        const { data: postData, error: postError } = await supabase
          .from("feed_posts")
          .insert({ content: content.trim(), created_by: userId })
          .select()
          .single();

        if (postError) throw postError;
        postId = postData.id;

        // Upload files
        for (const file of files) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${postId}/${Date.now()}.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
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

      toast.success(isEditing ? t.updateSuccess : t.postSuccess);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setContent("");
    setFiles([]);
    setShowPoll(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
    onOpenChange(false);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (file.type.startsWith("video/")) return <Video className="h-4 w-4" />;
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

          {/* File Attachments - only for new posts */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>{t.attachments}</Label>
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
          )}

          {/* Poll - only for new posts */}
          {!isEditing && (
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? t.save : t.post}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog;
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Image, FileText, Video } from "lucide-react";
import { format } from "date-fns";

interface PostPreviewProps {
  content: string;
  files: File[];
  existingAttachments: { id: string; file_url: string; file_name: string; file_type: string }[];
  showPoll: boolean;
  pollQuestion: string;
  pollOptions: string[];
  language: 'en' | 'es' | 'ru';
}

const translations = {
  en: {
    preview: "Preview",
    previewDesc: "This is how your post will appear to movers",
    justNow: "Just now",
  },
  es: {
    preview: "Vista Previa",
    previewDesc: "Así se verá tu publicación para los movers",
    justNow: "Ahora mismo",
  },
  ru: {
    preview: "Предпросмотр",
    previewDesc: "Так ваш пост будет выглядеть для мувера",
    justNow: "Только что",
  },
};

const PostPreview = ({
  content,
  files,
  existingAttachments,
  showPoll,
  pollQuestion,
  pollOptions,
  language,
}: PostPreviewProps) => {
  const t = translations[language];

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (fileType.startsWith("video/")) return <Video className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const renderFilePreview = (file: File, index: number) => {
    if (file.type.startsWith("image/")) {
      return (
        <img
          key={`new-${index}`}
          src={URL.createObjectURL(file)}
          alt={file.name}
          className="rounded-lg max-h-48 w-full object-cover"
        />
      );
    }
    if (file.type.startsWith("video/")) {
      return (
        <video
          key={`new-${index}`}
          src={URL.createObjectURL(file)}
          className="rounded-lg max-h-48 w-full bg-muted"
          controls
          preload="none"
        />
      );
    }
    return (
      <div
        key={`new-${index}`}
        className="flex items-center gap-2 p-3 bg-muted rounded-lg"
      >
        {getFileIcon(file.type)}
        <span className="truncate">{file.name}</span>
      </div>
    );
  };

  const renderExistingAttachment = (attachment: { id: string; file_url: string; file_name: string; file_type: string }) => {
    if (attachment.file_type.startsWith("image/")) {
      return (
        <img
          key={attachment.id}
          src={attachment.file_url}
          alt={attachment.file_name}
          className="rounded-lg max-h-48 w-full object-cover"
        />
      );
    }
    if (attachment.file_type.startsWith("video/")) {
      return (
        <video
          key={attachment.id}
          src={attachment.file_url}
          className="rounded-lg max-h-48 w-full bg-muted"
          controls
          preload="none"
        />
      );
    }
    return (
      <div
        key={attachment.id}
        className="flex items-center gap-2 p-3 bg-muted rounded-lg"
      >
        {getFileIcon(attachment.file_type)}
        <span className="truncate">{attachment.file_name}</span>
      </div>
    );
  };

  const validPollOptions = pollOptions.filter(opt => opt.trim());

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t.previewDesc}</p>
      <Card className="overflow-hidden border-2 border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">A</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">Admin</p>
              <p className="text-xs text-muted-foreground">{t.justNow}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {content && (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          )}

          {/* Attachments */}
          {(existingAttachments.length > 0 || files.length > 0) && (
            <div className="space-y-3">
              {existingAttachments.map(renderExistingAttachment)}
              {files.map(renderFilePreview)}
            </div>
          )}

          {/* Poll Preview */}
          {showPoll && pollQuestion.trim() && validPollOptions.length >= 2 && (
            <div className="border rounded-lg p-4 space-y-3">
              <p className="font-medium">{pollQuestion}</p>
              <div className="space-y-2">
                {validPollOptions.map((option, index) => (
                  <div
                    key={index}
                    className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition"
                  >
                    {option}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!content && files.length === 0 && existingAttachments.length === 0 && !showPoll && (
            <p className="text-muted-foreground text-center py-4">
              Start typing to see your post preview...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PostPreview;

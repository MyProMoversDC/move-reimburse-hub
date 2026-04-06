import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Folder,
  FileText,
  FileAudio,
  FileVideo,
  Image,
  ArrowLeft,
  File,
  Download,
  Eye,
} from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import { useLanguage } from "@/contexts/LanguageContext";

const translations = {
  en: {
    title: "Knowledge Base",
    noFolders: "No training materials available yet.",
    noMaterials: "No materials in this folder yet.",
    back: "Back to Folders",
    download: "Download",
    view: "View",
  },
  es: {
    title: "Base de Conocimientos",
    noFolders: "No hay materiales de capacitación disponibles aún.",
    noMaterials: "No hay materiales en esta carpeta aún.",
    back: "Volver a Carpetas",
    download: "Descargar",
    view: "Ver",
  },
  ru: {
    title: "База Знаний",
    noFolders: "Учебные материалы пока недоступны.",
    noMaterials: "В этой папке пока нет материалов.",
    back: "Назад к Папкам",
    download: "Скачать",
    view: "Просмотр",
  },
};

interface KBFolder {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface KBMaterial {
  id: string;
  folder_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
}

interface KnowledgeBaseViewerProps {
  userId: string;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith("image/")) return <Image className="h-5 w-5 text-green-500" />;
  if (fileType.startsWith("audio/")) return <FileAudio className="h-5 w-5 text-purple-500" />;
  if (fileType.startsWith("video/")) return <FileVideo className="h-5 w-5 text-blue-500" />;
  if (fileType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const KnowledgeBaseViewer = ({ userId }: KnowledgeBaseViewerProps) => {
  const { language } = useLanguage();
  const t = translations[language];

  const [folders, setFolders] = useState<KBFolder[]>([]);
  const [materials, setMaterials] = useState<KBMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<KBFolder | null>(null);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from("knowledge_base_folders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFolders(data || []);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async (folderId: string) => {
    setLoadingMaterials(true);
    try {
      const { data, error } = await supabase
        .from("knowledge_base_materials")
        .select("*")
        .eq("folder_id", folderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMaterials(data || []);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleOpenFolder = (folder: KBFolder) => {
    setSelectedFolder(folder);
    fetchMaterials(folder.id);
  };

  const handleDownload = async (material: KBMaterial) => {
    try {
      const { data, error } = await supabase.storage
        .from("knowledge-base")
        .createSignedUrl(material.file_url, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error: unknown) {
      toast.error(handleError(error));
    }
  };

  const renderPreview = (material: KBMaterial, signedUrl: string) => {
    if (material.file_type.startsWith("image/")) {
      return <img src={signedUrl} alt={material.file_name} className="max-h-48 rounded-md object-cover w-full" />;
    }
    if (material.file_type.startsWith("audio/")) {
      return <audio src={signedUrl} controls className="w-full mt-2" />;
    }
    if (material.file_type.startsWith("video/")) {
      return <video src={signedUrl} controls className="w-full max-h-48 rounded-md mt-2" />;
    }
    return null;
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  if (selectedFolder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedFolder(null); setMaterials([]); }}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t.back}
          </Button>
          <h2 className="text-xl md:text-2xl font-bold">{selectedFolder.name}</h2>
        </div>

        {selectedFolder.description && (
          <p className="text-muted-foreground">{selectedFolder.description}</p>
        )}

        {loadingMaterials ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : materials.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t.noMaterials}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {materials.map((mat) => (
              <Card key={mat.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {getFileIcon(mat.file_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mat.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(mat.file_size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(mat)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold">{t.title}</h2>

      {folders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t.noFolders}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {folders.map((folder) => (
            <Card
              key={folder.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleOpenFolder(folder)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Folder className="h-8 w-8 text-primary shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{folder.name}</h3>
                    {folder.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {folder.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(folder.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseViewer;

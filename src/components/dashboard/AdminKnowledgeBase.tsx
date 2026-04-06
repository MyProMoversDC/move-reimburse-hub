import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderPlus,
  Upload,
  Trash2,
  Share2,
  Folder,
  FileText,
  FileAudio,
  FileVideo,
  Image,
  ArrowLeft,
  File,
  Download,
} from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import { useLanguage } from "@/contexts/LanguageContext";

const translations = {
  en: {
    title: "Knowledge Base",
    createFolder: "Create Folder",
    folderName: "Folder Name",
    folderDescription: "Description (optional)",
    create: "Create",
    creating: "Creating...",
    uploadMaterials: "Upload Materials",
    upload: "Upload",
    uploading: "Uploading...",
    shareFolder: "Share Folder",
    share: "Share",
    sharing: "Sharing...",
    deleteFolder: "Delete Folder",
    deleteMaterial: "Delete Material",
    confirmDeleteFolder: "Are you sure you want to delete this folder and all its materials?",
    confirmDeleteMaterial: "Are you sure you want to delete this material?",
    cancel: "Cancel",
    delete: "Delete",
    noFolders: "No folders created yet. Create your first folder to get started.",
    noMaterials: "No materials uploaded yet.",
    materials: "materials",
    sharedWith: "Shared with",
    folderCreated: "Folder created successfully",
    materialsUploaded: "Materials uploaded successfully",
    folderShared: "Folder shared and users notified",
    folderDeleted: "Folder deleted successfully",
    materialDeleted: "Material deleted successfully",
    selectRoles: "Select roles to share with",
    back: "Back to Folders",
    accountant: "Accountant",
    operations_manager: "Operations Manager",
    reviews_admin: "Customer Review Manager",
    hr_manager: "HR Manager",
    office_staff: "Office Staff",
    fileLimit: "Maximum 10 files at once",
    supportedFormats: "Documents, Audio, Video, Images",
  },
  es: {
    title: "Base de Conocimientos",
    createFolder: "Crear Carpeta",
    folderName: "Nombre de la Carpeta",
    folderDescription: "Descripción (opcional)",
    create: "Crear",
    creating: "Creando...",
    uploadMaterials: "Subir Materiales",
    upload: "Subir",
    uploading: "Subiendo...",
    shareFolder: "Compartir Carpeta",
    share: "Compartir",
    sharing: "Compartiendo...",
    deleteFolder: "Eliminar Carpeta",
    deleteMaterial: "Eliminar Material",
    confirmDeleteFolder: "¿Está seguro de que desea eliminar esta carpeta y todos sus materiales?",
    confirmDeleteMaterial: "¿Está seguro de que desea eliminar este material?",
    cancel: "Cancelar",
    delete: "Eliminar",
    noFolders: "No se han creado carpetas aún. Cree su primera carpeta para comenzar.",
    noMaterials: "No se han subido materiales aún.",
    materials: "materiales",
    sharedWith: "Compartido con",
    folderCreated: "Carpeta creada exitosamente",
    materialsUploaded: "Materiales subidos exitosamente",
    folderShared: "Carpeta compartida y usuarios notificados",
    folderDeleted: "Carpeta eliminada exitosamente",
    materialDeleted: "Material eliminado exitosamente",
    selectRoles: "Seleccionar roles para compartir",
    back: "Volver a Carpetas",
    accountant: "Contador",
    operations_manager: "Gerente de Operaciones",
    reviews_admin: "Gerente de Reseñas",
    hr_manager: "Gerente de RRHH",
    office_staff: "Personal de Oficina",
    fileLimit: "Máximo 10 archivos a la vez",
    supportedFormats: "Documentos, Audio, Video, Imágenes",
  },
  ru: {
    title: "База Знаний",
    createFolder: "Создать Папку",
    folderName: "Название Папки",
    folderDescription: "Описание (необязательно)",
    create: "Создать",
    creating: "Создание...",
    uploadMaterials: "Загрузить Материалы",
    upload: "Загрузить",
    uploading: "Загрузка...",
    shareFolder: "Поделиться Папкой",
    share: "Поделиться",
    sharing: "Поделиться...",
    deleteFolder: "Удалить Папку",
    deleteMaterial: "Удалить Материал",
    confirmDeleteFolder: "Вы уверены, что хотите удалить эту папку и все её материалы?",
    confirmDeleteMaterial: "Вы уверены, что хотите удалить этот материал?",
    cancel: "Отмена",
    delete: "Удалить",
    noFolders: "Папки ещё не созданы. Создайте первую папку для начала.",
    noMaterials: "Материалы ещё не загружены.",
    materials: "материалы",
    sharedWith: "Доступ у",
    folderCreated: "Папка успешно создана",
    materialsUploaded: "Материалы успешно загружены",
    folderShared: "Папка доступна, пользователи уведомлены",
    folderDeleted: "Папка успешно удалена",
    materialDeleted: "Материал успешно удалён",
    selectRoles: "Выберите роли для доступа",
    back: "Назад к Папкам",
    accountant: "Бухгалтер",
    operations_manager: "Операционный Менеджер",
    reviews_admin: "Менеджер по Отзывам",
    hr_manager: "HR Менеджер",
    office_staff: "Офисный Персонал",
    fileLimit: "Максимум 10 файлов одновременно",
    supportedFormats: "Документы, Аудио, Видео, Изображения",
  },
};

const SHAREABLE_ROLES = [
  "accountant",
  "operations_manager",
  "reviews_admin",
  "hr_manager",
  "office_staff",
] as const;

interface KBFolder {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
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

interface KBShare {
  id: string;
  folder_id: string;
  shared_role: string;
}

interface AdminKnowledgeBaseProps {
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

const AdminKnowledgeBase = ({ userId }: AdminKnowledgeBaseProps) => {
  const { language } = useLanguage();
  const t = translations[language];

  const [folders, setFolders] = useState<KBFolder[]>([]);
  const [materials, setMaterials] = useState<KBMaterial[]>([]);
  const [shares, setShares] = useState<KBShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<KBFolder | null>(null);

  // Create folder dialog
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Share dialog
  const [showShare, setShowShare] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  // Delete dialogs
  const [folderToDelete, setFolderToDelete] = useState<KBFolder | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<KBMaterial | null>(null);

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      fetchMaterials(selectedFolder.id);
      fetchShares(selectedFolder.id);
    }
  }, [selectedFolder]);

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
    const { data, error } = await supabase
      .from("knowledge_base_materials")
      .select("*")
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(handleError(error));
      return;
    }
    setMaterials(data || []);
  };

  const fetchShares = async (folderId: string) => {
    const { data, error } = await supabase
      .from("knowledge_base_folder_shares")
      .select("*")
      .eq("folder_id", folderId);
    if (error) return;
    setShares(data || []);
    setSelectedRoles((data || []).map((s) => s.shared_role));
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const { error } = await supabase.from("knowledge_base_folders").insert({
        name: newFolderName.trim(),
        description: newFolderDesc.trim() || null,
        created_by: userId,
      });
      if (error) throw error;
      toast.success(t.folderCreated);
      setNewFolderName("");
      setNewFolderDesc("");
      setShowCreateFolder(false);
      fetchFolders();
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 10) {
      toast.error(t.fileLimit);
      setUploadFiles(files.slice(0, 10));
    } else {
      setUploadFiles(files);
    }
  };

  const handleUpload = async () => {
    if (!selectedFolder || uploadFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of uploadFiles) {
        const filePath = `${selectedFolder.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("knowledge-base")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("knowledge-base")
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase
          .from("knowledge_base_materials")
          .insert({
            folder_id: selectedFolder.id,
            file_name: file.name,
            file_url: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: userId,
          });
        if (insertError) throw insertError;
      }
      toast.success(t.materialsUploaded);
      setUploadFiles([]);
      setShowUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchMaterials(selectedFolder.id);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setUploading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedFolder) return;
    setSharing(true);
    try {
      // Delete existing shares
      await supabase
        .from("knowledge_base_folder_shares")
        .delete()
        .eq("folder_id", selectedFolder.id);

      // Insert new shares
      if (selectedRoles.length > 0) {
        const shareRows = selectedRoles.map((role) => ({
          folder_id: selectedFolder.id,
          shared_role: role,
          shared_by: userId,
        }));
        const { error } = await supabase
          .from("knowledge_base_folder_shares")
          .insert(shareRows);
        if (error) throw error;

        // Notify users with matching roles
        const { data: usersToNotify } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", selectedRoles as any[]);

        if (usersToNotify && usersToNotify.length > 0) {
          const uniqueUserIds = [...new Set(usersToNotify.map((u) => u.user_id))];
          const notifications = uniqueUserIds.map((uid) => ({
            user_id: uid,
            title: "New Training Materials",
            message: `Folder "${selectedFolder.name}" has been shared with you.`,
            notification_type: "knowledge_base",
            reference_type: "knowledge_base_folder",
            reference_id: selectedFolder.id,
          }));
          await supabase.from("mover_notifications").insert(notifications);
        }
      }

      toast.success(t.folderShared);
      setShowShare(false);
      fetchShares(selectedFolder.id);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setSharing(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      // Delete storage files
      const { data: mats } = await supabase
        .from("knowledge_base_materials")
        .select("file_url")
        .eq("folder_id", folderToDelete.id);
      if (mats && mats.length > 0) {
        await supabase.storage
          .from("knowledge-base")
          .remove(mats.map((m) => m.file_url));
      }

      const { error } = await supabase
        .from("knowledge_base_folders")
        .delete()
        .eq("id", folderToDelete.id);
      if (error) throw error;

      toast.success(t.folderDeleted);
      if (selectedFolder?.id === folderToDelete.id) {
        setSelectedFolder(null);
      }
      setFolderToDelete(null);
      fetchFolders();
    } catch (error: unknown) {
      toast.error(handleError(error));
    }
  };

  const handleDeleteMaterial = async () => {
    if (!materialToDelete || !selectedFolder) return;
    try {
      await supabase.storage
        .from("knowledge-base")
        .remove([materialToDelete.file_url]);
      const { error } = await supabase
        .from("knowledge_base_materials")
        .delete()
        .eq("id", materialToDelete.id);
      if (error) throw error;

      toast.success(t.materialDeleted);
      setMaterialToDelete(null);
      fetchMaterials(selectedFolder.id);
    } catch (error: unknown) {
      toast.error(handleError(error));
    }
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

  const getFolderMaterialCount = (folderId: string) => {
    // We only have materials for the selected folder, so use a simpler approach
    return undefined;
  };

  const getSharedRolesForFolder = (folderId: string) => {
    if (selectedFolder?.id === folderId) {
      return shares.map((s) => s.shared_role);
    }
    return [];
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  // Folder detail view
  if (selectedFolder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedFolder(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t.back}
            </Button>
            <h2 className="text-xl md:text-2xl font-bold">{selectedFolder.name}</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-1" />
              {t.uploadMaterials}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowShare(true)}>
              <Share2 className="h-4 w-4 mr-1" />
              {t.shareFolder}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setFolderToDelete(selectedFolder)}>
              <Trash2 className="h-4 w-4 mr-1" />
              {t.deleteFolder}
            </Button>
          </div>
        </div>

        {selectedFolder.description && (
          <p className="text-muted-foreground">{selectedFolder.description}</p>
        )}

        {shares.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">{t.sharedWith}:</span>
            {shares.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-xs">
                {t[s.shared_role as keyof typeof t] || s.shared_role}
              </Badge>
            ))}
          </div>
        )}

        {materials.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t.noMaterials}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {materials.map((mat) => (
              <Card key={mat.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {getFileIcon(mat.file_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mat.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(mat.file_size)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(mat)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setMaterialToDelete(mat)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.uploadMaterials}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.supportedFormats} • {t.fileLimit}</p>
              <Input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={handleFileSelect}
              />
              {uploadFiles.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {uploadFiles.length} file(s) selected
                </div>
              )}
              <Button onClick={handleUpload} disabled={uploading || uploadFiles.length === 0} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? t.uploading : t.upload}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Dialog */}
        <Dialog open={showShare} onOpenChange={setShowShare}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.shareFolder}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Label>{t.selectRoles}</Label>
              <div className="space-y-3">
                {SHAREABLE_ROLES.map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={(checked) => {
                        setSelectedRoles((prev) =>
                          checked
                            ? [...prev, role]
                            : prev.filter((r) => r !== role)
                        );
                      }}
                    />
                    <Label htmlFor={`role-${role}`} className="cursor-pointer">
                      {t[role as keyof typeof t] || role}
                    </Label>
                  </div>
                ))}
              </div>
              <Button onClick={handleShare} disabled={sharing} className="w-full">
                <Share2 className="h-4 w-4 mr-2" />
                {sharing ? t.sharing : t.share}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete folder dialog */}
        <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.deleteFolder}</AlertDialogTitle>
              <AlertDialogDescription>{t.confirmDeleteFolder}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground">
                {t.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete material dialog */}
        <AlertDialog open={!!materialToDelete} onOpenChange={(open) => !open && setMaterialToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.deleteMaterial}</AlertDialogTitle>
              <AlertDialogDescription>{t.confirmDeleteMaterial}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMaterial} className="bg-destructive text-destructive-foreground">
                {t.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Folder list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold">{t.title}</h2>
        <Button onClick={() => setShowCreateFolder(true)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          {t.createFolder}
        </Button>
      </div>

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
              onClick={() => setSelectedFolder(folder)}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderToDelete(folder);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.createFolder}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.folderName}</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t.folderName}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.folderDescription}</Label>
              <Textarea
                value={newFolderDesc}
                onChange={(e) => setNewFolderDesc(e.target.value)}
                placeholder={t.folderDescription}
              />
            </div>
            <Button
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
              className="w-full"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              {creatingFolder ? t.creating : t.create}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete folder dialog (from list) */}
      <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteFolder}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDeleteFolder}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground">
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminKnowledgeBase;

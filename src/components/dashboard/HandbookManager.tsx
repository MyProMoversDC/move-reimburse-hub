import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Share2, FileText, Download, Eye, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { handbookTranslations, HandbookLanguage } from "@/lib/handbookTranslations";

interface Handbook {
  id: string;
  version: number;
  file_url: string;
  file_name: string;
  file_type: string;
  is_shared: boolean;
  shared_at: string | null;
  ai_change_summary: string | null;
  created_at: string;
  previous_version_id: string | null;
}

interface HandbookManagerProps {
  language: HandbookLanguage;
}

const HandbookManager = ({ language }: HandbookManagerProps) => {
  const t = handbookTranslations[language];
  
  const [handbook, setHandbook] = useState<Handbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [acknowledgmentCount, setAcknowledgmentCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    fetchHandbook();
    fetchStats();
  }, []);

  const fetchHandbook = async () => {
    try {
      const { data, error } = await supabase
        .from("handbooks")
        .select("*")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setHandbook(data);
    } catch (error) {
      console.error("Error fetching handbook:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get latest shared handbook
      const { data: latestHandbook } = await supabase
        .from("handbooks")
        .select("id")
        .eq("is_shared", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestHandbook) {
        // Count acknowledgments
        const { count: ackCount } = await supabase
          .from("handbook_acknowledgments")
          .select("*", { count: "exact", head: true })
          .eq("handbook_id", latestHandbook.id);
        
        setAcknowledgmentCount(ackCount || 0);
      }

      // Count total users with mover role
      const { count: userCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "mover");

      setTotalUsers(userCount || 0);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF or DOC file");
      return;
    }

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from("handbooks")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("handbooks")
        .getPublicUrl(fileName);

      const newVersion = handbook ? handbook.version + 1 : 1;

      // Create handbook record
      const { data: newHandbook, error: insertError } = await supabase
        .from("handbooks")
        .insert({
          version: newVersion,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          uploaded_by: userData.user.id,
          previous_version_id: handbook?.id || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger AI analysis if there's a previous version
      if (handbook) {
        setAnalyzing(true);
        try {
          await supabase.functions.invoke("compare-handbooks", {
            body: {
              previousHandbookUrl: handbook.file_url,
              newHandbookUrl: urlData.publicUrl,
              handbookId: newHandbook.id,
            },
          });
        } catch (aiError) {
          console.error("AI analysis error:", aiError);
        }
        setAnalyzing(false);
      }

      toast.success(t.uploadSuccess);
      fetchHandbook();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleShare = async () => {
    if (!handbook) return;

    setSharing(true);
    try {
      const { error } = await supabase
        .from("handbooks")
        .update({ 
          is_shared: true, 
          shared_at: new Date().toISOString() 
        })
        .eq("id", handbook.id);

      if (error) throw error;

      toast.success(t.shareSuccess);
      fetchHandbook();
      fetchStats();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSharing(false);
    }
  };

  const formatDateEST = (date: string) => {
    return formatInTimeZone(new Date(date), 'America/New_York', 'MMM d, yyyy h:mm a') + ' EST';
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t.handbookManagement}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {handbook ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <p className="font-medium">{handbook.file_name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{t.version} {handbook.version}</Badge>
                  <span>•</span>
                  <span>{t.uploadedAt}: {formatDateEST(handbook.created_at)}</span>
                </div>
                {handbook.is_shared ? (
                  <p className="text-sm text-green-600">
                    ✓ {t.sharedAt}: {formatDateEST(handbook.shared_at!)}
                  </p>
                ) : (
                  <p className="text-sm text-orange-600">{t.notShared}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={handbook.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-1" />
                    {t.downloadHandbook}
                  </a>
                </Button>
                {handbook.ai_change_summary && (
                  <Button variant="outline" size="sm" onClick={() => setShowChanges(true)}>
                    <Eye className="h-4 w-4 mr-1" />
                    {t.viewChanges}
                  </Button>
                )}
              </div>
            </div>

            {handbook.is_shared && (
              <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
                <div className="text-sm">
                  <span className="font-medium">{acknowledgmentCount}</span> {t.usersAcknowledged}
                  {totalUsers > acknowledgmentCount && (
                    <span className="text-muted-foreground ml-2">
                      ({totalUsers - acknowledgmentCount} {t.pendingAcknowledgment})
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading || analyzing}
                  className="cursor-pointer"
                />
              </div>
              {!handbook.is_shared && (
                <Button onClick={handleShare} disabled={sharing}>
                  {sharing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4 mr-2" />
                  )}
                  {t.shareWithTeam}
                </Button>
              )}
            </div>

            {(uploading || analyzing) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {analyzing ? t.analyzing : t.uploading}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">{t.noHandbook}</p>
            <div>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
                disabled={uploading}
                className="max-w-xs mx-auto cursor-pointer"
              />
            </div>
            {uploading && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.uploading}
              </div>
            )}
          </div>
        )}

        <Dialog open={showChanges} onOpenChange={setShowChanges}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t.changesDetected}</DialogTitle>
            </DialogHeader>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap">
                {handbook?.ai_change_summary}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default HandbookManager;

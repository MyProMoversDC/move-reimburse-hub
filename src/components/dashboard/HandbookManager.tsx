import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Upload, Share2, FileText, Download, Eye, Users, Loader2, ChevronDown, ChevronUp, CheckCircle, Clock, History } from "lucide-react";
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

interface AcknowledgedUser {
  user_id: string;
  acknowledged_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface PendingUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const HandbookManager = ({ language }: HandbookManagerProps) => {
  const t = handbookTranslations[language];
  
  const [handbook, setHandbook] = useState<Handbook | null>(null);
  const [allHandbooks, setAllHandbooks] = useState<Handbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [selectedHandbookSummary, setSelectedHandbookSummary] = useState<string | null>(null);
  const [acknowledgmentCount, setAcknowledgmentCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [acknowledgedUsers, setAcknowledgedUsers] = useState<AcknowledgedUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchHandbooks();
    fetchStats();
  }, []);

  const fetchHandbooks = async () => {
    try {
      const { data, error } = await supabase
        .from("handbooks")
        .select("*")
        .order("version", { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setHandbook(data[0]); // Most recent
        setAllHandbooks(data);
      }
    } catch (error) {
      console.error("Error fetching handbooks:", error);
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

  const fetchUserDetails = async () => {
    if (!handbook?.id || !handbook.is_shared) return;
    
    setLoadingUsers(true);
    try {
      // Fetch users who acknowledged
      const { data: acknowledgments, error: ackError } = await supabase
        .from("handbook_acknowledgments")
        .select(`
          user_id,
          acknowledged_at,
          profiles!inner(first_name, last_name, email)
        `)
        .eq("handbook_id", handbook.id);

      if (ackError) throw ackError;

      const acknowledgedList: AcknowledgedUser[] = (acknowledgments || []).map((ack: any) => ({
        user_id: ack.user_id,
        acknowledged_at: ack.acknowledged_at,
        first_name: ack.profiles.first_name || '',
        last_name: ack.profiles.last_name || '',
        email: ack.profiles.email || '',
      }));

      setAcknowledgedUsers(acknowledgedList);

      // Get all movers
      const { data: allMovers, error: moverError } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles!inner(id, first_name, last_name, email)
        `)
        .eq("role", "mover");

      if (moverError) throw moverError;

      // Find pending users (movers who haven't acknowledged)
      const acknowledgedIds = new Set(acknowledgedList.map(u => u.user_id));
      const pendingList: PendingUser[] = (allMovers || [])
        .filter((m: any) => !acknowledgedIds.has(m.user_id))
        .map((m: any) => ({
          id: m.user_id,
          first_name: m.profiles.first_name || '',
          last_name: m.profiles.last_name || '',
          email: m.profiles.email || '',
        }));

      setPendingUsers(pendingList);
    } catch (error) {
      console.error("Error fetching user details:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleDetails = () => {
    if (!showUserDetails && acknowledgedUsers.length === 0 && pendingUsers.length === 0) {
      fetchUserDetails();
    }
    setShowUserDetails(!showUserDetails);
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
      fetchHandbooks();
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
      fetchHandbooks();
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

  const handleViewChanges = (summary: string | null) => {
    setSelectedHandbookSummary(summary);
    setShowChanges(true);
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Current Handbook Card */}
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
                    <Button variant="outline" size="sm" onClick={() => handleViewChanges(handbook.ai_change_summary)}>
                      <Eye className="h-4 w-4 mr-1" />
                      {t.viewChanges}
                    </Button>
                  )}
                </div>
              </div>

              {handbook.is_shared && (
                <Collapsible open={showUserDetails} onOpenChange={handleToggleDetails}>
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-blue-600" />
                          <div className="text-sm text-left">
                            <span className="font-medium">{acknowledgmentCount}</span> {t.usersAcknowledged}
                            {totalUsers > acknowledgmentCount && (
                              <span className="text-muted-foreground ml-2">
                                ({totalUsers - acknowledgmentCount} {t.pendingAcknowledgment})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{showUserDetails ? t.hideDetails : t.viewAcknowledgmentDetails}</span>
                          {showUserDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="p-4 space-y-4 bg-background">
                        {loadingUsers ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <>
                            {/* Confirmed Users */}
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                                <CheckCircle className="h-4 w-4" />
                                {t.confirmedUsers} ({acknowledgedUsers.length})
                              </h4>
                              {acknowledgedUsers.length > 0 ? (
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {acknowledgedUsers.map((user) => (
                                    <div key={user.user_id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/30 rounded text-sm">
                                      <span className="font-medium">
                                        {user.first_name} {user.last_name}
                                      </span>
                                      <span className="text-muted-foreground text-xs">
                                        {t.acknowledgedAt}: {formatDateEST(user.acknowledged_at)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">{t.notYetViewed}</p>
                              )}
                            </div>

                            {/* Pending Users */}
                            {pendingUsers.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                  <Clock className="h-4 w-4" />
                                  {t.pendingUsers} ({pendingUsers.length})
                                </h4>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {pendingUsers.map((user) => (
                                    <div key={user.id} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950/30 rounded text-sm">
                                      <span className="font-medium">
                                        {user.first_name} {user.last_name}
                                      </span>
                                      <span className="text-muted-foreground text-xs">
                                        {t.notYetViewed}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
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
        </CardContent>
      </Card>

      {/* Handbook History Card */}
      {allHandbooks.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {language === 'en' ? 'Handbook History' : language === 'es' ? 'Historial de Manuales' : 'История справочников'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allHandbooks.slice(1).map((hb) => (
                <div 
                  key={hb.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-medium truncate">{hb.file_name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">{t.version} {hb.version}</Badge>
                      <span className="hidden sm:inline">•</span>
                      <span>{formatDateEST(hb.created_at)}</span>
                      {hb.is_shared && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-green-600 text-xs">✓ Shared</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" asChild>
                      <a href={hb.file_url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4 mr-1" />
                        {language === 'en' ? 'View' : language === 'es' ? 'Ver' : 'Смотреть'}
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={hb.file_url} download={hb.file_name}>
                        <Download className="h-4 w-4 mr-1" />
                        {language === 'en' ? 'Download' : language === 'es' ? 'Descargar' : 'Скачать'}
                      </a>
                    </Button>
                    {hb.ai_change_summary && (
                      <Button variant="outline" size="sm" onClick={() => handleViewChanges(hb.ai_change_summary)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showChanges} onOpenChange={setShowChanges}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.changesDetected}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap">
              {selectedHandbookSummary}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HandbookManager;

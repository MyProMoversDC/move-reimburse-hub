import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Upload, Check, X, Eye, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

interface ConsentDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  version: number;
  is_active: boolean;
  uploaded_by: string;
  created_at: string;
}

interface Acknowledgment {
  user_id: string;
  acknowledged_at: string;
  profile?: {
    first_name: string;
    last_name: string;
  };
}

const ConsentDocumentManager = () => {
  const [documents, setDocuments] = useState<ConsentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [showAcknowledgments, setShowAcknowledgments] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [acknowledgments, setAcknowledgments] = useState<Acknowledgment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("consent_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/html'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF, DOC, DOCX, or HTML file");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be less than 20MB");
      return;
    }

    setUploading(true);
    try {
      // Get current max version
      const maxVersion = documents.length > 0 ? Math.max(...documents.map(d => d.version)) : 0;
      const newVersion = maxVersion + 1;

      const fileName = `consent_v${newVersion}_${Date.now()}.${file.name.split('.').pop()}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from("handbooks")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("handbooks")
        .getPublicUrl(fileName);

      // Insert record
      const { error: insertError } = await supabase
        .from("consent_documents")
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          version: newVersion,
          is_active: false,
          uploaded_by: "admin",
        });

      if (insertError) throw insertError;

      toast.success("Document uploaded successfully!");
      fetchDocuments();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleActivate = async (docId: string, activate: boolean) => {
    setActivating(docId);
    try {
      if (activate) {
        // Deactivate all other documents first
        await supabase
          .from("consent_documents")
          .update({ is_active: false })
          .neq("id", docId);
      }

      const { error } = await supabase
        .from("consent_documents")
        .update({ is_active: activate })
        .eq("id", docId);

      if (error) throw error;

      toast.success(activate ? "Document activated!" : "Document deactivated!");
      fetchDocuments();
    } catch (error) {
      console.error("Error updating document status:", error);
      toast.error("Failed to update document status");
    } finally {
      setActivating(null);
    }
  };

  const handleViewAcknowledgments = async (docId: string) => {
    setSelectedDocId(docId);
    setShowAcknowledgments(true);

    const { data: acks } = await supabase
      .from("consent_acknowledgments")
      .select("user_id, acknowledged_at")
      .eq("consent_document_id", docId);

    if (acks && acks.length > 0) {
      const userIds = acks.map(a => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

      const acksWithProfiles = acks.map(ack => ({
        ...ack,
        profile: profiles?.find(p => p.id === ack.user_id),
      }));
      setAcknowledgments(acksWithProfiles);
    } else {
      setAcknowledgments([]);
    }
  };

  const formatToEST = (dateString: string) => {
    const date = new Date(dateString);
    const estDate = toZonedTime(date, "America/New_York");
    return format(estDate, "MM/dd/yyyy hh:mm a");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Terms & Conditions Document Management
            </CardTitle>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx,.html"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Uploaded At (EST)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No consent documents uploaded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>v{doc.version}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{doc.file_name}</TableCell>
                      <TableCell className="text-sm">{formatToEST(doc.created_at)}</TableCell>
                      <TableCell>
                        {doc.is_active ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(doc.file_url, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewAcknowledgments(doc.id)}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          {doc.is_active ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleActivate(doc.id, false)}
                              disabled={activating === doc.id}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleActivate(doc.id, true)}
                              disabled={activating === doc.id}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Acknowledgments Dialog */}
      <Dialog open={showAcknowledgments} onOpenChange={setShowAcknowledgments}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Signed Users ({acknowledgments.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {acknowledgments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No signatures yet</p>
            ) : (
              <div className="space-y-2">
                {acknowledgments.map((ack) => (
                  <div
                    key={ack.user_id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                  >
                    <span>
                      {ack.profile
                        ? `${ack.profile.first_name} ${ack.profile.last_name}`
                        : "Unknown User"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatToEST(ack.acknowledged_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsentDocumentManager;

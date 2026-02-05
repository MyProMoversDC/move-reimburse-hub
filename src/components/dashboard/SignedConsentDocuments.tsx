import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Eye, Search, Download, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";

interface SignedDocument {
  id: string;
  user_id: string;
  consent_document_id: string;
  signature_url: string;
  signed_at: string;
  mover_name: string;
  document_name: string;
  signed_html_content?: string | null;
  consent_documents?: {
    file_url: string;
    file_name: string;
  };
}

const SignedConsentDocuments = () => {
  const [documents, setDocuments] = useState<SignedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDoc, setPreviewDoc] = useState<SignedDocument | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("signed_consent_documents")
      .select(`
        *,
        consent_documents (
          file_url,
          file_name
        )
      `)
      .order("signed_at", { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
    setLoading(false);
  };

  const formatToEST = (dateString: string) => {
    const date = new Date(dateString);
    const estDate = toZonedTime(date, "America/New_York");
    return format(estDate, "MM/dd/yyyy hh:mm a");
  };

  const filteredDocuments = documents.filter((doc) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      doc.mover_name.toLowerCase().includes(searchLower) ||
      doc.document_name.toLowerCase().includes(searchLower)
    );
  });

  const handleDownloadAsPdf = async (doc: SignedDocument) => {
    setDownloading(doc.id);
    
    try {
      if (doc.signed_html_content) {
        // Generate PDF from signed HTML content
        const container = document.createElement('div');
        container.innerHTML = doc.signed_html_content;
        container.style.padding = '20px';
        container.style.fontFamily = 'Arial, sans-serif';
        
        const fileName = `${doc.mover_name.replace(/\s+/g, "_")}_signed_consent_${format(new Date(doc.signed_at), 'yyyy-MM-dd')}.pdf`;
        
        await html2pdf()
          .set({
            margin: 10,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
              scale: 2,
              useCORS: true,
              allowTaint: true
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          })
          .from(container)
          .save();
        
        toast.success("PDF downloaded successfully!");
      } else {
        // Fall back to downloading separate files for legacy documents
        await handleDownloadLegacy(doc);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
      // Fall back to legacy download
      await handleDownloadLegacy(doc);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadLegacy = async (doc: SignedDocument) => {
    const documentUrl = doc.consent_documents?.file_url;
    if (!documentUrl) {
      toast.error("Original document not found");
      return;
    }

    try {
      // Download the original document
      const docLink = document.createElement("a");
      docLink.href = documentUrl;
      docLink.download = `${doc.mover_name.replace(/\s+/g, "_")}_consent_document.pdf`;
      docLink.target = "_blank";
      document.body.appendChild(docLink);
      docLink.click();
      document.body.removeChild(docLink);

      // Wait a moment then download the signature
      setTimeout(() => {
        const sigLink = document.createElement("a");
        sigLink.href = doc.signature_url;
        sigLink.download = `${doc.mover_name.replace(/\s+/g, "_")}_signature.png`;
        document.body.appendChild(sigLink);
        sigLink.click();
        document.body.removeChild(sigLink);
      }, 500);

      toast.success("Downloading document and signature...");
    } catch (error) {
      console.error("Error downloading:", error);
      toast.error("Failed to download files");
    }
  };

  const renderPreviewContent = (doc: SignedDocument) => {
    if (doc.signed_html_content) {
      // Render the signed HTML content directly
      return (
        <div 
          className="p-4 bg-white min-h-[50vh] prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: doc.signed_html_content }}
        />
      );
    }
    
    // Legacy preview with separate document and signature
    return (
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto">
        {/* Document Preview */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Document</h3>
          <div className="border rounded-lg overflow-hidden bg-muted/30 h-[50vh]">
            {doc.consent_documents?.file_url ? (
              doc.consent_documents.file_url.toLowerCase().endsWith('.pdf') ? (
                <object
                  data={doc.consent_documents.file_url}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  <iframe
                    src={`${doc.consent_documents.file_url}#toolbar=0`}
                    className="w-full h-full"
                    title="Consent Document"
                  />
                </object>
              ) : (
                <iframe
                  src={doc.consent_documents.file_url}
                  className="w-full h-full"
                  title="Consent Document"
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Original document not available
              </div>
            )}
          </div>
        </div>

        {/* Signature Preview */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Signature</h3>
          <div className="border rounded-lg p-4 bg-muted/30">
            <img
              src={doc.signature_url}
              alt={`${doc.mover_name}'s Signature`}
              className="max-h-[150px] mx-auto object-contain"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Signed on: {formatToEST(doc.signed_at)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Signed Consent Documents Library
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mover Name</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Signed At (EST)</TableHead>
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
              ) : filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No matching documents found" : "No signed consent documents yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.mover_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{doc.document_name}</TableCell>
                    <TableCell>
                      {doc.signed_html_content ? (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                          Embedded Signature
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Legacy
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{formatToEST(doc.signed_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewDoc(doc)}
                          title="View document & signature"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadAsPdf(doc)}
                          disabled={downloading === doc.id}
                          title={doc.signed_html_content ? "Download as PDF" : "Download files"}
                        >
                          {downloading === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Total signed documents: {filteredDocuments.length}
        </div>
      </CardContent>

      {/* Document + Signature Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Signed Document: {previewDoc?.mover_name}
            </DialogTitle>
          </DialogHeader>
          
          {previewDoc && (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
                {renderPreviewContent(previewDoc)}
              </div>

              {/* Info & Download Section */}
              <div className="pt-4 border-t space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Signed on: {formatToEST(previewDoc.signed_at)}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {!previewDoc.signed_html_content && previewDoc.consent_documents?.file_url && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        window.open(previewDoc.consent_documents?.file_url, '_blank');
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Open Original Document
                    </Button>
                  )}
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => handleDownloadAsPdf(previewDoc)}
                    disabled={downloading === previewDoc.id}
                  >
                    {downloading === previewDoc.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {previewDoc.signed_html_content ? "Download as PDF" : "Download All"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SignedConsentDocuments;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileSignature, Eye, Search, Download } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

interface SignedDocument {
  id: string;
  user_id: string;
  consent_document_id: string;
  signature_url: string;
  signed_at: string;
  mover_name: string;
  document_name: string;
}

const SignedConsentDocuments = () => {
  const [documents, setDocuments] = useState<SignedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("signed_consent_documents")
      .select("*")
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

  const handleDownloadSignature = (signatureUrl: string, moverName: string) => {
    const link = document.createElement("a");
    link.href = signatureUrl;
    link.download = `signature_${moverName.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mover Name</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Signed At (EST)</TableHead>
                <TableHead>Signature</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No matching documents found" : "No signed consent documents yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.mover_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{doc.document_name}</TableCell>
                    <TableCell className="text-sm">{formatToEST(doc.signed_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewSignature(doc.signature_url)}
                          title="View signature"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadSignature(doc.signature_url, doc.mover_name)}
                          title="Download signature"
                        >
                          <Download className="h-4 w-4" />
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

      {/* Signature Preview Dialog */}
      <Dialog open={!!previewSignature} onOpenChange={() => setPreviewSignature(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Signature Preview</DialogTitle>
          </DialogHeader>
          {previewSignature && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <img
                src={previewSignature}
                alt="Mover Signature"
                className="w-full max-h-[200px] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SignedConsentDocuments;

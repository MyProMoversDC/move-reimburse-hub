import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { handleError } from "@/lib/errorHandler";

interface Mover {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface SendMoverEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportTitle?: string;
}

const SendMoverEmailDialog = ({ open, onOpenChange, reportTitle }: SendMoverEmailDialogProps) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [selectedMovers, setSelectedMovers] = useState<string[]>([]);
  const [additionalMessage, setAdditionalMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingMovers, setFetchingMovers] = useState(true);

  useEffect(() => {
    if (open) {
      fetchMovers();
      setSelectedMovers([]);
      setAdditionalMessage("");
    }
  }, [open]);

  const fetchMovers = async () => {
    setFetchingMovers(true);
    try {
      // Get all users with mover role
      const { data: moverRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "mover");

      if (rolesError) throw rolesError;

      if (moverRoles && moverRoles.length > 0) {
        const moverIds = moverRoles.map(r => r.user_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", moverIds)
          .order("first_name");

        if (profilesError) throw profilesError;
        setMovers(profiles || []);
      } else {
        setMovers([]);
      }
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setFetchingMovers(false);
    }
  };

  const handleMoverToggle = (moverId: string) => {
    setSelectedMovers(prev => 
      prev.includes(moverId) 
        ? prev.filter(id => id !== moverId)
        : [...prev, moverId]
    );
  };

  const getSelectedMoverNames = () => {
    return selectedMovers
      .map(id => {
        const mover = movers.find(m => m.id === id);
        return mover ? `${mover.first_name} ${mover.last_name}` : "";
      })
      .filter(Boolean)
      .join(", ");
  };

  const handleSend = async () => {
    if (selectedMovers.length === 0) {
      toast.error("Please select at least one mover");
      return;
    }

    if (!additionalMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setLoading(true);
    try {
      const recipients = selectedMovers.map(id => {
        const mover = movers.find(m => m.id === id);
        return {
          email: mover!.email,
          name: `${mover!.first_name} ${mover!.last_name}`,
        };
      });

      const { data, error } = await supabase.functions.invoke("send-mover-email", {
        body: {
          recipients,
          additionalMessage: additionalMessage.trim(),
        },
      });

      if (error) throw error;

      toast.success(`Email sent to ${recipients.length} mover(s)`);
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Send Email to Mover(s)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mover Selection */}
          <div className="space-y-2">
            <Label>Select Mover(s) *</Label>
            {fetchingMovers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-40 border rounded-md p-3">
                <div className="space-y-2">
                  {movers.map((mover) => (
                    <div key={mover.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={mover.id}
                        checked={selectedMovers.includes(mover.id)}
                        onCheckedChange={() => handleMoverToggle(mover.id)}
                      />
                      <label
                        htmlFor={mover.id}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {mover.first_name} {mover.last_name} ({mover.email})
                      </label>
                    </div>
                  ))}
                  {movers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No movers found</p>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Email Preview */}
          <div className="space-y-2">
            <Label>Email Message</Label>
            <div className="border rounded-md p-4 bg-muted/30 space-y-3">
              <p className="text-sm">
                Dear <strong>{selectedMovers.length > 0 ? getSelectedMoverNames() : "[Mover Name]"}</strong>,
              </p>
              <p className="text-sm">
                I am reaching out to you on behalf of the MyProMovers management with a following statement:
              </p>
              <Textarea
                placeholder="Continue your message here..."
                value={additionalMessage}
                onChange={(e) => setAdditionalMessage(e.target.value)}
                className="min-h-[120px] bg-background"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading || selectedMovers.length === 0}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendMoverEmailDialog;

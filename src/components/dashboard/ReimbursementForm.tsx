import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { z } from "zod";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";

const reimbursementSchema = z.object({
  moverFullName: z.string().trim().min(1, "Mover full name is required").max(200),
  jobNumber: z.string().trim().min(1, "Job number is required").max(50),
  truckNumber: z.string().trim().min(1, "Truck number is required").max(50),
  customerName: z.string().trim().min(1, "Customer name is required").max(200),
  totalReimbursement: z.number().min(0.01, "Total reimbursement must be greater than 0"),
  zelleInfo: z.string().trim().min(1, "Zelle payment info is required").max(200),
  gasExpenses: z.number().min(0).optional(),
  roadExpenses: z.number().min(0).optional(),
  hotelExpenses: z.number().min(0).optional(),
  otherExpenses: z.number().min(0).optional(),
});

interface ReimbursementFormProps {
  userId: string;
  onSuccess: () => void;
  language: DashboardLanguage;
}

const ReimbursementForm = ({ userId, onSuccess, language }: ReimbursementFormProps) => {
  const [loading, setLoading] = useState(false);
  const t = dashboardTranslations[language];
  const [moverFullName, setMoverFullName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [truckNumber, setTruckNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [totalReimbursement, setTotalReimbursement] = useState("");
  const [zelleInfo, setZelleInfo] = useState("");
  const [gasExpenses, setGasExpenses] = useState("");
  const [roadExpenses, setRoadExpenses] = useState("");
  const [hotelExpenses, setHotelExpenses] = useState("");
  const [otherExpenses, setOtherExpenses] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      toast.error("Please attach at least one picture");
      return;
    }

    try {
      const validated = reimbursementSchema.parse({
        moverFullName: moverFullName.trim(),
        jobNumber: jobNumber.trim(),
        truckNumber: truckNumber.trim(),
        customerName: customerName.trim(),
        totalReimbursement: parseFloat(totalReimbursement),
        zelleInfo: zelleInfo.trim(),
        gasExpenses: gasExpenses ? parseFloat(gasExpenses) : undefined,
        roadExpenses: roadExpenses ? parseFloat(roadExpenses) : undefined,
        hotelExpenses: hotelExpenses ? parseFloat(hotelExpenses) : undefined,
        otherExpenses: otherExpenses ? parseFloat(otherExpenses) : undefined,
      });

      setLoading(true);

      // Insert reimbursement
      const { data: reimbursement, error: reimbursementError } = await supabase
        .from("reimbursements")
        .insert({
          mover_id: userId,
          mover_full_name: validated.moverFullName,
          job_number: validated.jobNumber,
          truck_number: validated.truckNumber,
          customer_name: validated.customerName,
          gas_expenses: validated.gasExpenses || 0,
          road_expenses: validated.roadExpenses || 0,
          hotel_expenses: validated.hotelExpenses || 0,
          other_expenses: validated.otherExpenses || 0,
          total_expenses: validated.totalReimbursement,
          zelle_info: validated.zelleInfo,
        })
        .select()
        .single();

      if (reimbursementError) throw reimbursementError;

      // Upload files
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split(".").pop();
        const fileName = `${userId}/${reimbursement.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("reimbursement-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("reimbursement-attachments")
          .getPublicUrl(fileName);

        return supabase.from("reimbursement_attachments").insert({
          reimbursement_id: reimbursement.id,
          file_url: publicUrl,
          file_name: file.name,
        });
      });

      await Promise.all(uploadPromises);

      // Send notification email
      await supabase.functions.invoke("send-reimbursement-notification", {
        body: {
          reimbursementNumber: String(reimbursement.reimbursement_number).padStart(5, "0"),
          moverFullName: validated.moverFullName,
          jobNumber: validated.jobNumber,
          truckNumber: validated.truckNumber,
          customerName: validated.customerName,
          gasExpenses: validated.gasExpenses || 0,
          roadExpenses: validated.roadExpenses || 0,
          hotelExpenses: validated.hotelExpenses || 0,
          otherExpenses: validated.otherExpenses || 0,
          totalExpenses: validated.totalReimbursement,
          zelleInfo: validated.zelleInfo,
          attachmentCount: files.length,
        },
      });

      toast.success(t.requestSubmitted);
      onSuccess();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to submit reimbursement");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="moverFullName">Mover Full Name *</Label>
          <Input
            id="moverFullName"
            value={moverFullName}
            onChange={(e) => setMoverFullName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobNumber">Job # *</Label>
          <Input
            id="jobNumber"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="truckNumber">Truck # *</Label>
          <Input
            id="truckNumber"
            value={truckNumber}
            onChange={(e) => setTruckNumber(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerName">Customer Name *</Label>
          <Input
            id="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="totalReimbursement">Total Requested Reimbursement ($) *</Label>
          <Input
            id="totalReimbursement"
            type="number"
            step="0.01"
            min="0.01"
            value={totalReimbursement}
            onChange={(e) => setTotalReimbursement(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gasExpenses">Gas Expenses ($)</Label>
          <Input
            id="gasExpenses"
            type="number"
            step="0.01"
            min="0"
            value={gasExpenses}
            onChange={(e) => setGasExpenses(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="roadExpenses">Road (Tolls) Expenses ($)</Label>
          <Input
            id="roadExpenses"
            type="number"
            step="0.01"
            min="0"
            value={roadExpenses}
            onChange={(e) => setRoadExpenses(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hotelExpenses">Hotel Expenses ($)</Label>
          <Input
            id="hotelExpenses"
            type="number"
            step="0.01"
            min="0"
            value={hotelExpenses}
            onChange={(e) => setHotelExpenses(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="otherExpenses">Other Expenses ($)</Label>
          <Input
            id="otherExpenses"
            type="number"
            step="0.01"
            min="0"
            value={otherExpenses}
            onChange={(e) => setOtherExpenses(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="zelleInfo">Zelle Payment Info (Email or Phone) *</Label>
        <Input
          id="zelleInfo"
          value={zelleInfo}
          onChange={(e) => setZelleInfo(e.target.value)}
          placeholder="email@example.com or phone number"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="attachments">Attach Pictures *</Label>
        <div className="flex items-center gap-2">
          <Input
            id="attachments"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById("attachments")?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Select Files
          </Button>
          <span className="text-sm text-muted-foreground">
            {files.length} file(s) selected
          </span>
        </div>

        {files.length > 0 && (
          <div className="space-y-2 mt-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-muted rounded"
              >
                <span className="text-sm truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Submitting..." : "Submit Reimbursement"}
      </Button>
    </form>
  );
};

export default ReimbursementForm;

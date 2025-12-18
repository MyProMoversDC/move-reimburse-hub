import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Column {
  key: string;
  label: string;
}

interface ColumnSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: Column[];
  selectedColumns: string[];
  onSelectedColumnsChange: (columns: string[]) => void;
  onExport: () => void;
  exporting: boolean;
}

const ColumnSelector = ({
  open,
  onOpenChange,
  columns,
  selectedColumns,
  onSelectedColumnsChange,
  onExport,
  exporting,
}: ColumnSelectorProps) => {
  const handleToggle = (key: string) => {
    if (selectedColumns.includes(key)) {
      onSelectedColumnsChange(selectedColumns.filter((col) => col !== key));
    } else {
      onSelectedColumnsChange([...selectedColumns, key]);
    }
  };

  const handleSelectAll = () => {
    onSelectedColumnsChange(columns.map((col) => col.key));
  };

  const handleDeselectAll = () => {
    onSelectedColumnsChange([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Columns for Export</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {columns.map((column) => (
              <div key={column.key} className="flex items-center space-x-2">
                <Checkbox
                  id={column.key}
                  checked={selectedColumns.includes(column.key)}
                  onCheckedChange={() => handleToggle(column.key)}
                />
                <Label htmlFor={column.key} className="cursor-pointer">
                  {column.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onExport}
            disabled={selectedColumns.length === 0 || exporting}
          >
            {exporting ? "Exporting..." : "Export Selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ColumnSelector;

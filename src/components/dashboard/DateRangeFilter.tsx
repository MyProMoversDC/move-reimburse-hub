import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onClear: () => void;
}

const DateRangeFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: DateRangeFilterProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs md:text-sm text-muted-foreground">Filter:</span>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal text-xs md:text-sm h-8 md:h-9 px-2 md:px-3",
              !startDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            {startDate ? format(startDate, "MM/dd/yy") : "Start"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={onStartDateChange}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <span className="text-xs md:text-sm text-muted-foreground">to</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal text-xs md:text-sm h-8 md:h-9 px-2 md:px-3",
              !endDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            {endDate ? format(endDate, "MM/dd/yy") : "End"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={endDate}
            onSelect={onEndDateChange}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {(startDate || endDate) && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 md:h-9 px-2">
          <X className="h-3 w-3 md:h-4 md:w-4" />
          <span className="hidden sm:inline ml-1">Clear</span>
        </Button>
      )}
    </div>
  );
};

export default DateRangeFilter;

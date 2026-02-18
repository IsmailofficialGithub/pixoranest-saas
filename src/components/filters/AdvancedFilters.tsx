import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Filter, X, CalendarIcon, Search } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface FilterConfig {
  status?: string;
  dateRange?: DateRange;
  scoreRange?: [number, number];
  campaign?: string;
  search?: string;
}

interface AdvancedFiltersProps {
  onFilterChange: (filters: FilterConfig) => void;
  campaigns?: Array<{ id: string; name: string }>;
}

export function AdvancedFilters({ onFilterChange, campaigns = [] }: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterConfig>({});

  const updateFilter = <K extends keyof FilterConfig>(key: K, value: FilterConfig[K] | undefined) => {
    const newFilters = { ...filters };
    if (value === undefined) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  const activeFilterCount = Object.keys(filters).filter(
    (key) => filters[key as keyof FilterConfig] !== undefined
  ).length;

  return (
    <div className="space-y-3">
      {/* Search Bar + Filter Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filters.search ?? ""}
            onChange={(e) => updateFilter("search", e.target.value || undefined)}
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-4 bg-popover z-50" align="end">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Filters</p>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs text-muted-foreground">
                  Clear all
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status ?? ""} onValueChange={(value) => updateFilter("status", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campaign Filter */}
            {campaigns.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Campaign</Label>
                <Select value={filters.campaign ?? ""} onValueChange={(value) => updateFilter("campaign", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All campaigns" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Range Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filters.dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange?.from ? (
                      filters.dateRange.to
                        ? `${format(filters.dateRange.from, "LLL dd, y")} - ${format(filters.dateRange.to, "LLL dd, y")}`
                        : format(filters.dateRange.from, "LLL dd, y")
                    ) : (
                      "Pick a date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                  <Calendar
                    mode="range"
                    selected={filters.dateRange}
                    onSelect={(range) => updateFilter("dateRange", range ?? undefined)}
                    numberOfMonths={2}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Lead Score Range */}
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Score Range</Label>
              <div className="px-1">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={filters.scoreRange ?? [0, 100]}
                  onValueChange={(value) => updateFilter("scoreRange", value as [number, number])}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{filters.scoreRange?.[0] ?? 0}</span>
                  <span>{filters.scoreRange?.[1] ?? 100}</span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("status", undefined)} />
            </Badge>
          )}
          {filters.campaign && (
            <Badge variant="secondary" className="gap-1">
              Campaign: {campaigns.find((c) => c.id === filters.campaign)?.name}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("campaign", undefined)} />
            </Badge>
          )}
          {filters.dateRange?.from && (
            <Badge variant="secondary" className="gap-1">
              Date: {format(filters.dateRange.from, "MMM dd")}
              {filters.dateRange.to ? ` - ${format(filters.dateRange.to, "MMM dd")}` : ""}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("dateRange", undefined)} />
            </Badge>
          )}
          {filters.scoreRange && (filters.scoreRange[0] !== 0 || filters.scoreRange[1] !== 100) && (
            <Badge variant="secondary" className="gap-1">
              Score: {filters.scoreRange[0]}–{filters.scoreRange[1]}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("scoreRange", undefined)} />
            </Badge>
          )}
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("search", undefined)} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

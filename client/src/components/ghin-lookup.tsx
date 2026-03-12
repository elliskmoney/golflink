import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Search, MapPin, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Golfer } from "@shared/schema";

function getHandicapColor(index: number | null): string {
  if (index === null) return "text-muted-foreground";
  if (index <= 5) return "text-emerald-700 dark:text-emerald-400";
  if (index <= 10) return "text-blue-700 dark:text-blue-400";
  if (index <= 18) return "text-amber-700 dark:text-amber-400";
  if (index <= 25) return "text-orange-700 dark:text-orange-400";
  return "text-red-700 dark:text-red-400";
}

function getSkillLabel(index: number | null): string {
  if (index === null) return "Unrated";
  if (index <= 5) return "Low Handicap";
  if (index <= 10) return "Single Digit";
  if (index <= 18) return "Mid Handicap";
  if (index <= 25) return "High Handicap";
  return "Beginner";
}

export function GhinLookup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [ghinNumber, setGhinNumber] = useState("");
  const [searchNumber, setSearchNumber] = useState<string | null>(null);

  const { data: golfer, isLoading, isError } = useQuery<Golfer>({
    queryKey: [`/api/golfers/ghin/${searchNumber}`],
    enabled: !!searchNumber,
  });

  const handleSearch = () => {
    if (ghinNumber.trim()) {
      setSearchNumber(ghinNumber.trim());
    }
  };

  const handleClose = () => {
    setGhinNumber("");
    setSearchNumber(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>GHIN Handicap Lookup</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter a GHIN number to look up a golfer's official USGA handicap index.
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="Enter GHIN number..."
              value={ghinNumber}
              onChange={e => setGhinNumber(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="tabular-nums min-h-[44px]"
              data-testid="ghin-input"
            />
            <Button
              onClick={handleSearch}
              disabled={!ghinNumber.trim()}
              className="min-h-[44px] min-w-[44px]"
              data-testid="ghin-search-btn"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* Results */}
          {isLoading && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-4 w-48" />
            </div>
          )}

          {isError && searchNumber && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-center">
              <p className="text-sm font-medium">GHIN number not found</p>
              <p className="text-xs mt-1">Check the number and try again.</p>
            </div>
          )}

          {golfer && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {golfer.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium flex items-center gap-1.5" data-testid="ghin-result-name">
                    {golfer.name}
                    {golfer.isVerified && <ShieldCheck className="w-4 h-4 text-primary" />}
                  </div>
                  {(golfer.city || golfer.state) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {[golfer.city, golfer.state].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-background rounded-md p-3 text-center">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Handicap Index
                </div>
                <div className={`text-2xl font-bold tabular-nums mt-1 ${getHandicapColor(golfer.handicapIndex)}`} data-testid="ghin-result-handicap">
                  {golfer.handicapIndex !== null ? golfer.handicapIndex.toFixed(1) : "N/A"}
                </div>
                <Badge variant="secondary" className="mt-2 text-xs">
                  <Award className="w-3 h-3 mr-1" />
                  {getSkillLabel(golfer.handicapIndex)}
                </Badge>
              </div>

              {golfer.homeCourse && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Home course: <span className="text-foreground font-medium">{golfer.homeCourse}</span>
                </div>
              )}
              {golfer.ghinNumber && (
                <div className="mt-1 text-xs text-muted-foreground">
                  GHIN: <span className="text-foreground font-medium tabular-nums">{golfer.ghinNumber}</span>
                </div>
              )}
            </div>
          )}

          {/* Example numbers */}
          {!searchNumber && (
            <div className="text-xs text-muted-foreground">
              <p className="mb-1 font-medium">Try these sample GHIN numbers:</p>
              <div className="flex flex-wrap gap-1.5">
                {["2847361", "9182734", "5739284", "3847291"].map(num => (
                  <button
                    key={num}
                    className="tabular-nums px-2 py-0.5 rounded bg-muted hover-elevate text-foreground"
                    onClick={() => { setGhinNumber(num); setSearchNumber(num); }}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

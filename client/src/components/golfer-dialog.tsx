import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, MapPin, Award } from "lucide-react";
import type { Golfer } from "@shared/schema";

function getHandicapColor(index: number | null): string {
  if (index === null) return "text-muted-foreground";
  if (index <= 5) return "text-emerald-700 dark:text-emerald-400";
  if (index <= 10) return "text-blue-700 dark:text-blue-400";
  if (index <= 18) return "text-amber-700 dark:text-amber-400";
  if (index <= 25) return "text-orange-700 dark:text-orange-400";
  return "text-red-700 dark:text-red-400";
}

function getSkillLevel(index: number | null): { label: string; description: string } {
  if (index === null) return { label: "Unrated", description: "No handicap on file" };
  if (index <= 0) return { label: "Plus Handicap", description: "Plays better than scratch" };
  if (index <= 5) return { label: "Low Handicap", description: "Excellent player, near scratch" };
  if (index <= 10) return { label: "Single Digit", description: "Strong, consistent player" };
  if (index <= 18) return { label: "Mid Handicap", description: "Solid recreational golfer" };
  if (index <= 25) return { label: "High Handicap", description: "Working on improving" };
  return { label: "Beginner", description: "New to the game" };
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export function GolferDialog({ golfer, onClose }: { golfer: Golfer | null; onClose: () => void }) {
  if (!golfer) return null;

  const skill = getSkillLevel(golfer.handicapIndex);
  const strokesOver = golfer.handicapIndex !== null ? Math.round(golfer.handicapIndex * 113 / 113) : null;

  return (
    <Dialog open={!!golfer} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">Golfer Profile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center text-center pt-2">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary mb-3">
            {getInitials(golfer.name)}
          </div>

          {/* Name & Verification */}
          <h2 className="text-lg font-semibold flex items-center gap-1.5" data-testid="golfer-name">
            {golfer.name}
            {golfer.isVerified && (
              <ShieldCheck className="w-4 h-4 text-primary" />
            )}
          </h2>

          {/* Location */}
          {(golfer.city || golfer.state) && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>{[golfer.city, golfer.state].filter(Boolean).join(", ")}</span>
            </div>
          )}

          {/* Handicap Display */}
          <div className="mt-4 w-full">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Handicap Index
              </div>
              <div className={`text-3xl font-bold tabular-nums ${getHandicapColor(golfer.handicapIndex)}`} data-testid="golfer-handicap">
                {golfer.handicapIndex !== null ? golfer.handicapIndex.toFixed(1) : "N/A"}
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <Badge variant="secondary" className="text-xs">
                  <Award className="w-3 h-3 mr-1" />
                  {skill.label}
                </Badge>
                {golfer.isVerified && (
                  <Badge variant="secondary" className="text-xs">
                    GHIN Verified
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 w-full mt-3">
            {golfer.ghinNumber && (
              <div className="bg-muted/50 rounded-lg p-3 text-left">
                <div className="text-xs text-muted-foreground">GHIN Number</div>
                <div className="text-sm font-medium tabular-nums" data-testid="golfer-ghin">{golfer.ghinNumber}</div>
              </div>
            )}
            {golfer.homeCourse && (
              <div className="bg-muted/50 rounded-lg p-3 text-left">
                <div className="text-xs text-muted-foreground">Home Course</div>
                <div className="text-sm font-medium truncate">{golfer.homeCourse}</div>
              </div>
            )}
          </div>

          {/* What this means section */}
          {golfer.handicapIndex !== null && (
            <div className="mt-3 w-full text-left bg-muted/30 rounded-lg p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">What this means</div>
              <p className="text-sm text-foreground">
                {skill.description}. On an average course (slope 113), expect to shoot around{" "}
                <span className="font-semibold">{72 + Math.round(golfer.handicapIndex)} strokes</span> for 18 holes.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChevronLeft, ChevronRight, Users, Clock, DollarSign, ShieldCheck, MapPin,
  Star, Target, Ruler, TrendingUp, Calendar, Check, Info, UserCircle2, ChevronDown
} from "lucide-react";
import type { Course, TeeTimeWithPlayers, Golfer, TeeSet } from "@shared/schema";
import { GolferDialog } from "@/components/golfer-dialog";
import { BookTeeTimeDialog } from "@/components/book-dialog";
import { GhinLookup } from "@/components/ghin-lookup";
import { apiRequest, queryClient } from "@/lib/queryClient";

function getHandicapColor(index: number | null): string {
  if (index === null) return "text-muted-foreground";
  if (index <= 5) return "text-emerald-700 dark:text-emerald-400";
  if (index <= 10) return "text-blue-700 dark:text-blue-400";
  if (index <= 18) return "text-amber-700 dark:text-amber-400";
  if (index <= 25) return "text-orange-700 dark:text-orange-400";
  return "text-red-700 dark:text-red-400";
}

function getInitials(name: string): string {
  if (name === "You") return "ME";
  const parts = name.split(/[\s-]+/).filter(n => n.length > 0);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function calculateExpectedScore(par: number, handicapIndex: number, slope: number): number {
  return Math.round(par + (handicapIndex * slope / 113));
}

function parseTees(course: Course): TeeSet[] {
  if (!course.tees) return [];
  try { return JSON.parse(course.tees) as TeeSet[]; } catch { return []; }
}

/** Recommended max yardage using smooth interpolation between USGA
 *  "Tee It Forward" anchor points (adjusted for real Scottsdale courses). */
function getRecommendedMaxYardage(handicapIndex: number): number {
  const anchors: [number, number][] = [
    [-5, 7600], [0, 7400], [5, 6800], [10, 6200],
    [15, 6000], [20, 5600], [25, 5200], [30, 4800], [36, 4400], [54, 3800],
  ];
  if (handicapIndex <= anchors[0][0]) return anchors[0][1];
  if (handicapIndex >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [h1, y1] = anchors[i];
    const [h2, y2] = anchors[i + 1];
    if (handicapIndex >= h1 && handicapIndex <= h2) {
      const t = (handicapIndex - h1) / (h2 - h1);
      return Math.round(y1 + t * (y2 - y1));
    }
  }
  return 5800;
}

/** Recommend the best tee based on yardage, slope, and course rating.
 *  Uses USGA Tee It Forward guidelines with slope-inflation guardrails.
 *  Picks the longest tee within the golfer's recommended yardage range
 *  whose slope doesn't inflate their course handicap beyond a comfort zone. */
function getRecommendedTeeIndex(tees: TeeSet[], handicapIndex: number): number {
  if (tees.length === 0) return 0;
  const maxYards = getRecommendedMaxYardage(handicapIndex);

  // Find longest tee within yardage limit that passes slope check
  for (let i = 0; i < tees.length; i++) {
    const tee = tees[i];
    if (tee.yardage > maxYards) continue;
    // Slope check: course handicap inflation
    const courseHcp = handicapIndex * tee.slopeRating / 113;
    const inflation = courseHcp - handicapIndex;
    const maxInflation = Math.max(3, handicapIndex * 0.3);
    if (inflation <= maxInflation) return i;
  }
  // Fallback: just use yardage
  for (let i = 0; i < tees.length; i++) {
    if (tees[i].yardage <= maxYards) return i;
  }
  return tees.length - 1;
}

function InfoBubble({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground/30 text-muted-foreground/60 hover:border-foreground/50 hover:text-foreground/70 transition-colors"
          aria-label={`What is ${title}?`}
        >
          <Info className="w-2.5 h-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="max-w-[240px] text-xs leading-relaxed p-3"
      >
        <p className="font-semibold text-foreground mb-1">{title}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function PlayerAvatar({ golfer, onClick }: { golfer: Golfer; onClick: () => void }) {
  const isCurrentUser = golfer.name === "You";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover-elevate transition-colors min-h-[44px]"
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            isCurrentUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          }`}>
            {getInitials(golfer.name)}
          </div>
          <div className="text-left min-w-0">
            <div className="text-sm font-medium truncate flex items-center gap-1">
              {isCurrentUser ? "You" : golfer.name}
              {golfer.isVerified && (
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
            </div>
            <div className={`text-xs font-semibold tabular-nums ${getHandicapColor(golfer.handicapIndex)}`}>
              {golfer.handicapIndex !== null ? golfer.handicapIndex.toFixed(1) : "N/A"} HCP
            </div>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <p className="font-medium">{isCurrentUser ? "You" : golfer.name}</p>
          <p className="text-muted-foreground">
            {golfer.handicapIndex !== null ? `${golfer.handicapIndex.toFixed(1)} Handicap Index` : "No handicap on file"}
            {golfer.isVerified ? " (GHIN Verified)" : ""}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function EmptySlot() {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 min-h-[44px]">
      <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/25 flex items-center justify-center shrink-0">
        <span className="text-xs text-muted-foreground/40">+</span>
      </div>
      <span className="text-xs text-muted-foreground/50">Open</span>
    </div>
  );
}

function TeeTimeRow({ teeTime, onSelectGolfer, onBook }: {
  teeTime: TeeTimeWithPlayers;
  onSelectGolfer: (g: Golfer) => void;
  onBook: (tt: TeeTimeWithPlayers) => void;
}) {
  const spotsLeft = (teeTime.maxPlayers || 4) - teeTime.players.length;
  const isFull = spotsLeft === 0;
  const greenFee = teeTime.pricePerPlayer ? teeTime.pricePerPlayer / 100 : 0;

  const avgHandicap = teeTime.players.length > 0
    ? teeTime.players.reduce((sum, p) => sum + (p.handicapIndex || 0), 0) / teeTime.players.length
    : null;

  return (
    <Card className={`transition-all ${isFull ? "opacity-50" : ""}`}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold tabular-nums tracking-tight">
                {formatTime12(teeTime.time)}
              </span>
              {greenFee > 0 && (
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  ${greenFee}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {avgHandicap !== null && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  Avg {avgHandicap.toFixed(1)}
                </Badge>
              )}
              <Badge variant={isFull ? "secondary" : spotsLeft === 1 ? "default" : "outline"} className="text-xs font-medium">
                {isFull ? "Full" : `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} open`}
              </Badge>
            </div>
          </div>

          {/* Players grid */}
          <div className="grid grid-cols-2 gap-1">
            {teeTime.players.map(player => (
              <PlayerAvatar
                key={player.id}
                golfer={player}
                onClick={() => onSelectGolfer(player)}
              />
            ))}
            {Array.from({ length: spotsLeft }).map((_, i) => (
              <EmptySlot key={`empty-${i}`} />
            ))}
          </div>

          {/* Book button */}
          {!isFull && (
            <Button
              className="w-full min-h-[44px] text-sm font-semibold"
              onClick={() => onBook(teeTime)}
            >
              Join This Group
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionCard({ teeTime, userHandicap, onSelectGolfer, onBook }: {
  teeTime: TeeTimeWithPlayers;
  userHandicap: number;
  onSelectGolfer: (g: Golfer) => void;
  onBook: (tt: TeeTimeWithPlayers) => void;
}) {
  const spotsLeft = (teeTime.maxPlayers || 4) - teeTime.players.length;
  const avgHcp = teeTime.players.length > 0
    ? teeTime.players.reduce((sum, p) => sum + (p.handicapIndex || 0), 0) / teeTime.players.length
    : 0;
  const greenFee = teeTime.pricePerPlayer ? teeTime.pricePerPlayer / 100 : 0;

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-lg font-bold tabular-nums">
                {formatTime12(teeTime.time)}
              </span>
              {greenFee > 0 && (
                <span className="text-sm text-muted-foreground tabular-nums">${greenFee}</span>
              )}
            </div>
            <Badge variant="outline" className="text-xs font-medium">
              {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} open
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
            Group avg handicap: <span className="font-semibold text-foreground">{avgHcp.toFixed(1)}</span>
            {" "}&mdash; close to yours ({userHandicap.toFixed(1)})
          </div>

          <div className="flex flex-wrap gap-1">
            {teeTime.players.map(player => (
              <button
                key={player.id}
                onClick={() => onSelectGolfer(player)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover-elevate transition-colors bg-muted/50"
              >
                <span className="font-medium">{player.name}</span>
                <span className={`tabular-nums font-semibold ${getHandicapColor(player.handicapIndex)}`}>
                  {player.handicapIndex !== null ? player.handicapIndex.toFixed(1) : "N/A"}
                </span>
              </button>
            ))}
          </div>

          <Button
            className="w-full min-h-[44px] text-sm font-semibold"
            onClick={() => onBook(teeTime)}
          >
            Join This Group
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TeeSheetSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function TeeSheet() {
  const today = new Date();
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedGolfer, setSelectedGolfer] = useState<Golfer | null>(null);
  const [bookingTeeTime, setBookingTeeTime] = useState<TeeTimeWithPlayers | null>(null);
  const [showGhinLookup, setShowGhinLookup] = useState(false);
  const [selectedTeeIndex, setSelectedTeeIndex] = useState<Record<string, number>>({});

  const selectedDate = format(addDays(today, dateOffset), "yyyy-MM-dd");
  const displayDate = format(addDays(today, dateOffset), "EEEE, MMM d");
  const shortDisplayDate = format(addDays(today, dateOffset), "EEE, MMM d");

  const { data: currentUser } = useQuery<Golfer>({
    queryKey: ["/api/current-user"],
  });

  const { data: demoProfiles } = useQuery<Golfer[]>({
    queryKey: ["/api/demo-profiles"],
  });

  const switchProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      await apiRequest("POST", "/api/switch-profile", { profileId });
    },
    onSuccess: () => {
      // Clear tee selections so recommendations recalculate for new handicap
      setSelectedTeeIndex({});
      queryClient.invalidateQueries({ queryKey: ["/api/current-user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suggested-tee-times"] });
    },
  });

  const { data: courses, isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const courseId = selectedCourseId || courses?.[0]?.id || "";

  const { data: teeTimes, isLoading: teeTimesLoading } = useQuery<TeeTimeWithPlayers[]>({
    queryKey: ["/api/tee-times", `?courseId=${courseId}&date=${selectedDate}`],
    enabled: !!courseId,
  });

  const { data: suggestedTimes } = useQuery<TeeTimeWithPlayers[]>({
    queryKey: ["/api/suggested-tee-times", `?courseId=${courseId}&date=${selectedDate}`],
    enabled: !!courseId,
  });

  const selectedCourse = courses?.find(c => c.id === courseId);

  // Parse tee sets for the selected course
  const teeSets = useMemo(() => {
    if (!selectedCourse) return [];
    return parseTees(selectedCourse);
  }, [selectedCourse]);

  // Recommended tee index based on handicap
  const recommendedTeeIdx = useMemo(() => {
    if (!currentUser?.handicapIndex || teeSets.length === 0) return 0;
    return getRecommendedTeeIndex(teeSets, currentUser.handicapIndex);
  }, [teeSets, currentUser]);

  // Current tee selection (defaults to recommended)
  const activeTeeIdx = selectedTeeIndex[courseId] ?? recommendedTeeIdx;
  const activeTee: TeeSet | null = teeSets[activeTeeIdx] || null;

  // Dynamic stats based on selected tee (falls back to course defaults)
  const displayPar = activeTee?.par ?? selectedCourse?.par ?? 72;
  const displayRating = activeTee?.courseRating ?? selectedCourse?.courseRating;
  const displaySlope = activeTee?.slopeRating ?? selectedCourse?.slopeRating;
  const displayYardage = activeTee?.yardage ?? selectedCourse?.yardage;

  const expectedScore = useMemo(() => {
    if (!currentUser?.handicapIndex || !displaySlope) return null;
    return calculateExpectedScore(
      displayPar,
      currentUser.handicapIndex,
      displaySlope
    );
  }, [displayPar, displaySlope, currentUser]);

  const morningTimes = useMemo(() => teeTimes?.filter(tt => {
    const hour = parseInt(tt.time.split(":")[0]);
    return hour < 12;
  }) || [], [teeTimes]);

  const afternoonTimes = useMemo(() => teeTimes?.filter(tt => {
    const hour = parseInt(tt.time.split(":")[0]);
    return hour >= 12;
  }) || [], [teeTimes]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="GolfLink logo">
                <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
                <circle cx="16" cy="12" r="3.5" fill="currentColor" className="text-primary" />
                <path d="M16 16 L16 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" />
                <path d="M16 26 L20 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-primary" />
              </svg>
              <span className="font-semibold text-base tracking-tight">GolfLink</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowGhinLookup(true)}
              className="min-h-[40px]"
            >
              GHIN Lookup
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-20">
        {/* Profile Switcher */}
        {currentUser && demoProfiles && (
          <Card className="mb-4 border-primary/20 bg-primary/[0.04]">
            <CardContent className="p-3">
              {/* Current profile info */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {getInitials(currentUser.name)}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Playing As</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{currentUser.name}</span>
                      <span className={`text-lg font-bold tabular-nums ${getHandicapColor(currentUser.handicapIndex)}`}>
                        {currentUser.handicapIndex !== null && currentUser.handicapIndex < 0 ? "+" : ""}{currentUser.handicapIndex !== null ? Math.abs(currentUser.handicapIndex).toFixed(1) : "N/A"} HCP
                      </span>
                      {currentUser.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* Profile chips */}
              <div className="flex gap-1.5 flex-wrap">
                {demoProfiles.map(profile => {
                  const isActive = profile.id === currentUser.id;
                  const hcpDisplay = profile.handicapIndex !== null && profile.handicapIndex < 0
                    ? `+${Math.abs(profile.handicapIndex).toFixed(1)}`
                    : profile.handicapIndex?.toFixed(1) ?? "N/A";
                  return (
                    <button
                      key={profile.id}
                      data-testid={`profile-${profile.id}`}
                      onClick={() => { if (!isActive) switchProfileMutation.mutate(profile.id); }}
                      disabled={switchProfileMutation.isPending}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all min-h-[36px] border ${
                        isActive
                          ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/20"
                          : "bg-background border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      <span className="whitespace-nowrap">{profile.name}</span>
                      <span className={`tabular-nums shrink-0 ${isActive ? "" : getHandicapColor(profile.handicapIndex)}`}>
                        {hcpDisplay}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Course Selector */}
        <div className="mb-4">
          {coursesLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={courseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses?.map(course => (
                  <SelectItem key={course.id} value={course.id}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{course.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums ml-2">
                        ${course.greenFeeMin || course.greenFee}–${course.greenFeeMax || course.greenFee}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Course Info Card */}
        {selectedCourse && (
          <Card className="mb-4 bg-muted/30">
            <CardContent className="p-4">
              {/* Tee Selector */}
              {teeSets.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider mb-2">Select Tees</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {teeSets.map((tee, idx) => {
                      const isActive = idx === activeTeeIdx;
                      const isRecommended = idx === recommendedTeeIdx;
                      return (
                        <button
                          key={tee.name}
                          onClick={() => setSelectedTeeIndex(prev => ({ ...prev, [courseId]: idx }))}
                          data-testid={`tee-btn-${idx}`}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all min-h-[36px] border ${
                            isActive
                              ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/20"
                              : "bg-background border-border text-muted-foreground hover:border-foreground/30"
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                            style={{ backgroundColor: tee.color === '#f5f5f5' ? '#e5e5e5' : tee.color }}
                          />
                          <span>{tee.name}</span>
                          {isRecommended && (
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${
                              isActive ? "text-primary" : "text-amber-600 dark:text-amber-400"
                            }`}>Best Fit</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Course Stats (updates with selected tee) */}
              <div className="grid grid-cols-5 gap-2 text-center mb-3">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Par</span>
                    <InfoBubble title="Par">
                      <p className="text-muted-foreground">The number of strokes an expert golfer is expected to need to complete the course. Most courses are par 70–72.</p>
                    </InfoBubble>
                  </div>
                  <div className="text-sm font-bold tabular-nums">{displayPar}</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Rating</span>
                    <InfoBubble title="Course Rating">
                      <p className="text-muted-foreground">The expected score for a scratch (0 handicap) golfer. A rating of {displayRating} means a scratch golfer would shoot about {displayRating} here. The higher this number compared to par, the harder the course plays.</p>
                    </InfoBubble>
                  </div>
                  <div className="text-sm font-bold tabular-nums">{displayRating}</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Slope</span>
                    <InfoBubble title="Slope Rating">
                      <p className="text-muted-foreground">Measures how much harder the course is for a bogey golfer vs. a scratch golfer. Ranges from 55 (easy) to 155 (extremely hard). Average is 113. A slope of {displaySlope} means this course is {displaySlope && displaySlope > 125 ? "tougher than average" : displaySlope && displaySlope < 105 ? "easier than average" : "about average"} for higher-handicap players.</p>
                    </InfoBubble>
                  </div>
                  <div className="text-sm font-bold tabular-nums">{displaySlope}</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Yards</span>
                    <InfoBubble title="Total Yardage">
                      <p className="text-muted-foreground">The total distance of all 18 holes from the selected tees. Shorter yardage generally means an easier round. Switch tees above to see different distances.</p>
                    </InfoBubble>
                  </div>
                  <div className="text-sm font-bold tabular-nums">{displayYardage?.toLocaleString()}</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Fee</span>
                    <InfoBubble title="Green Fee">
                      <p className="text-muted-foreground">The price per player for 18 holes. This typically includes a cart. Prices vary by time of day and season.</p>
                    </InfoBubble>
                  </div>
                  <div className="text-sm font-bold tabular-nums">${selectedCourse.greenFeeMin || selectedCourse.greenFee}–${selectedCourse.greenFeeMax || selectedCourse.greenFee}</div>
                </div>
              </div>

              {/* Expected Score */}
              {expectedScore !== null && currentUser && (
                <div className="bg-background rounded-lg p-3 border">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Your expected score from the {activeTee?.name || "selected"} tees</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums text-foreground">{expectedScore}</span>
                    <span className="text-sm text-muted-foreground">
                      ({expectedScore - displayPar > 0 ? "+" : ""}{expectedScore - displayPar} over par)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Based on {currentUser.name === "You" ? "your" : `${currentUser.name}'s`} {currentUser.handicapIndex !== null && currentUser.handicapIndex < 0 ? "+" : ""}{currentUser.handicapIndex !== null ? Math.abs(currentUser.handicapIndex).toFixed(1) : ""} handicap &times; {displaySlope} slope / 113
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Date Navigator */}
        <div className="flex items-center justify-between mb-5">
          <Button
            variant="secondary"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => setDateOffset(d => Math.max(0, d - 1))}
            disabled={dateOffset === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <div className="flex items-center gap-1.5 justify-center">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-bold">
                {dateOffset === 0 ? "Today" : dateOffset === 1 ? "Tomorrow" : ""}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">{displayDate}</span>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => setDateOffset(d => d + 1)}
            disabled={dateOffset >= 6}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Tee Times List */}
        {teeTimesLoading ? (
          <TeeSheetSkeleton />
        ) : (
          <>
            {/* Recommended For You */}
            {suggestedTimes && suggestedTimes.length > 0 && currentUser && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    Recommended For You
                  </h2>
                </div>
                <div className="space-y-2">
                  {suggestedTimes.map(tt => (
                    <SuggestionCard
                      key={tt.id}
                      teeTime={tt}
                      userHandicap={currentUser.handicapIndex || 15}
                      onSelectGolfer={setSelectedGolfer}
                      onBook={setBookingTeeTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Morning Tee Times */}
            {morningTimes.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">
                  Morning Tee Times
                </h2>
                <div className="space-y-2">
                  {morningTimes.map(tt => (
                    <TeeTimeRow
                      key={tt.id}
                      teeTime={tt}
                      onSelectGolfer={setSelectedGolfer}
                      onBook={setBookingTeeTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Afternoon Tee Times */}
            {afternoonTimes.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">
                  Afternoon Tee Times
                </h2>
                <div className="space-y-2">
                  {afternoonTimes.map(tt => (
                    <TeeTimeRow
                      key={tt.id}
                      teeTime={tt}
                      onSelectGolfer={setSelectedGolfer}
                      onBook={setBookingTeeTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {(!teeTimes || teeTimes.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-medium text-foreground mb-1">No tee times available</h3>
                <p className="text-sm text-muted-foreground">
                  Try selecting a different date or course.
                </p>
              </div>
            )}
          </>
        )}

      </main>

      {/* Dialogs */}
      <GolferDialog
        golfer={selectedGolfer}
        onClose={() => setSelectedGolfer(null)}
      />
      <BookTeeTimeDialog
        teeTime={bookingTeeTime}
        onClose={() => setBookingTeeTime(null)}
        currentUser={currentUser || null}
      />
      <GhinLookup
        open={showGhinLookup}
        onClose={() => setShowGhinLookup(false)}
      />
    </div>
  );
}

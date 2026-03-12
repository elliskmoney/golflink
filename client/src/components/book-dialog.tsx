import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Clock, Users, ShieldCheck, CreditCard, CheckCircle2, ChevronRight, Target, ArrowLeft } from "lucide-react";
import type { TeeTimeWithPlayers, Golfer, Course } from "@shared/schema";

function getHandicapColor(index: number | null): string {
  if (index === null) return "text-muted-foreground";
  if (index <= 5) return "text-emerald-700 dark:text-emerald-400";
  if (index <= 10) return "text-blue-700 dark:text-blue-400";
  if (index <= 18) return "text-amber-700 dark:text-amber-400";
  return "text-orange-700 dark:text-orange-400";
}

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function calculateExpectedScore(par: number, handicapIndex: number, slope: number): number {
  return Math.round(par + (handicapIndex * slope / 113));
}

type BookingStep = "summary" | "payment" | "confirmation";

export function BookTeeTimeDialog({
  teeTime,
  onClose,
  currentUser,
}: {
  teeTime: TeeTimeWithPlayers | null;
  onClose: () => void;
  currentUser: Golfer | null;
}) {
  const [step, setStep] = useState<BookingStep>("summary");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const { toast } = useToast();

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser || !teeTime) return;
      await apiRequest("POST", "/api/bookings", {
        teeTimeId: teeTime.id,
        golferId: currentUser.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tee-times"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suggested-tee-times"] });
      setStep("confirmation");
    },
    onError: (err: Error) => {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setStep("summary");
    setCardNumber("");
    setExpiry("");
    setCvv("");
    setCardName("");
    onClose();
  };

  if (!teeTime || !currentUser) return null;

  const spotsLeft = (teeTime.maxPlayers || 4) - teeTime.players.length;
  const greenFee = teeTime.pricePerPlayer ? teeTime.pricePerPlayer / 100 : 0;
  const course = teeTime.course;
  const expectedScore = course && currentUser.handicapIndex !== null
    ? calculateExpectedScore(course.par || 72, currentUser.handicapIndex, course.slopeRating || 113)
    : null;

  // Format card number with spaces
  const handleCardNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    setCardNumber(groups ? groups.join(" ") : cleaned);
  };

  // Format expiry as MM/YY
  const handleExpiryChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length > 2) {
      setExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
    } else {
      setExpiry(cleaned);
    }
  };

  const isPaymentValid = cardNumber.replace(/\s/g, "").length >= 15 && expiry.length >= 4 && cvv.length >= 3 && cardName.trim().length > 0;

  return (
    <Dialog open={!!teeTime} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {step === "summary" && "Booking Summary"}
            {step === "payment" && "Payment"}
            {step === "confirmation" && "Confirmed!"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Booking Summary */}
        {step === "summary" && (
          <div className="space-y-4">
            {/* Course & Time Info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="font-semibold text-sm">{course.name}</div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{formatDate(teeTime.date)}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatTime12(teeTime.time)}
                </span>
              </div>
            </div>

            {/* Current players in group */}
            {teeTime.players.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                  Playing With
                </div>
                <div className="space-y-2">
                  {teeTime.players.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-md px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{p.name}</span>
                        {p.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <span className={`tabular-nums font-semibold ${getHandicapColor(p.handicapIndex)}`}>
                        {p.handicapIndex !== null ? p.handicapIndex.toFixed(1) : "N/A"} HCP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spots remaining */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Open spots after booking</span>
              <Badge variant="secondary">{spotsLeft - 1} remaining</Badge>
            </div>

            {/* Price */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Green Fee</span>
                <span className="text-xl font-bold tabular-nums">${greenFee.toFixed(2)}</span>
              </div>
            </div>

            <Button
              className="w-full min-h-[48px] text-sm font-semibold"
              onClick={() => setStep("payment")}
            >
              Proceed to Payment
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Payment Form */}
        {step === "payment" && (
          <div className="space-y-4">
            <button
              onClick={() => setStep("summary")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to summary
            </button>

            {/* Total */}
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Due</div>
              <div className="text-2xl font-bold tabular-nums mt-1">${greenFee.toFixed(2)}</div>
            </div>

            {/* Card Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Card Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={e => handleCardNumberChange(e.target.value)}
                    className="pl-10 tabular-nums min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Expiration</label>
                  <Input
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={e => handleExpiryChange(e.target.value)}
                    className="tabular-nums min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">CVV</label>
                  <Input
                    placeholder="123"
                    value={cvv}
                    onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="tabular-nums min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Name on Card</label>
                <Input
                  placeholder="John Smith"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
            </div>

            <Button
              className="w-full min-h-[48px] text-sm font-semibold"
              disabled={!isPaymentValid || bookMutation.isPending}
              onClick={() => bookMutation.mutate()}
            >
              {bookMutation.isPending ? "Processing..." : `Pay $${greenFee.toFixed(2)}`}
            </Button>

            <p className="text-[11px] text-center text-muted-foreground">
              This is a demo — no real charges will be made
            </p>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === "confirmation" && (
          <div className="space-y-5 text-center">
            {/* Animated checkmark */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-in zoom-in duration-300">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold">You're booked!</h3>
              <p className="text-sm text-muted-foreground mt-1">See you on the course</p>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Course</span>
                <span className="font-medium">{course.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{formatDate(teeTime.date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium tabular-nums">{formatTime12(teeTime.time)}</span>
              </div>

              {teeTime.players.length > 0 && (
                <div className="border-t pt-2 mt-2">
                  <div className="text-xs text-muted-foreground mb-1">Playing with</div>
                  {teeTime.players.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-0.5">
                      <span>{p.name}</span>
                      <span className={`tabular-nums font-semibold text-xs ${getHandicapColor(p.handicapIndex)}`}>
                        {p.handicapIndex !== null ? p.handicapIndex.toFixed(1) : "N/A"} HCP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expected score */}
            {expectedScore !== null && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center justify-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Your expected score:</span>
                  <span className="text-lg font-bold tabular-nums">{expectedScore}</span>
                </div>
              </div>
            )}

            <Button
              variant="secondary"
              className="w-full min-h-[44px]"
              onClick={handleClose}
            >
              View Tee Sheet
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import {
  type Golfer, type InsertGolfer,
  type Course, type InsertCourse,
  type TeeTime, type InsertTeeTime,
  type Booking, type InsertBooking,
  type TeeTimeWithPlayers,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Golfers
  getGolfer(id: string): Promise<Golfer | undefined>;
  getGolferByGhin(ghinNumber: string): Promise<Golfer | undefined>;
  getAllGolfers(): Promise<Golfer[]>;
  createGolfer(golfer: InsertGolfer): Promise<Golfer>;
  getCurrentUser(): Promise<Golfer>;
  switchProfile(profileId: string): Promise<Golfer | undefined>;
  getDemoProfiles(): Promise<Golfer[]>;

  // Courses
  getCourse(id: string): Promise<Course | undefined>;
  getAllCourses(): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;

  // Tee Times
  getTeeTime(id: string): Promise<TeeTime | undefined>;
  getTeeTimesByDate(courseId: string, date: string): Promise<TeeTimeWithPlayers[]>;
  createTeeTime(teeTime: InsertTeeTime): Promise<TeeTime>;
  getSuggestedTeeTimes(courseId: string, date: string, userHandicap: number): Promise<TeeTimeWithPlayers[]>;

  // Bookings
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookingsForTeeTime(teeTimeId: string): Promise<Golfer[]>;
  removeBooking(teeTimeId: string, golferId: string): Promise<void>;
}

// Simple seeded PRNG for deterministic random
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class MemStorage implements IStorage {
  private golfers: Map<string, Golfer> = new Map();
  private courses: Map<string, Course> = new Map();
  private teeTimes: Map<string, TeeTime> = new Map();
  private bookings: Map<string, Booking> = new Map();
  private currentUserId: string = "";
  private demoProfileIds: string[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    const rand = mulberry32(42);

    // Seed 12 real Scottsdale-area courses with verified tee data
    // Default par/rating/slope/yardage = back tees. Full tee sets in JSON.
    // greenFee = typical mid-range price, greenFeeMin/greenFeeMax = daily range
    const courseData: InsertCourse[] = [
      { name: "TPC Scottsdale (Stadium)", city: "Scottsdale", state: "AZ", holes: 18, par: 71, slopeRating: 142, courseRating: 74.7, yardage: 7261, greenFee: 250, greenFeeMin: 179, greenFeeMax: 395,
        tees: JSON.stringify([
          { name: "Championship", color: "#1a1a1a", par: 71, courseRating: 74.7, slopeRating: 142, yardage: 7261 },
          { name: "Players", color: "#1e40af", par: 71, courseRating: 71.5, slopeRating: 131, yardage: 6614 },
          { name: "Resort", color: "#f5f5f5", par: 71, courseRating: 68.9, slopeRating: 123, yardage: 6110 },
          { name: "Forward", color: "#dc2626", par: 71, courseRating: 70.8, slopeRating: 122, yardage: 5464 },
        ]) },
      { name: "Grayhawk Golf Club (Raptor)", city: "Scottsdale", state: "AZ", holes: 18, par: 72, slopeRating: 143, courseRating: 74.0, yardage: 7135, greenFee: 225, greenFeeMin: 159, greenFeeMax: 325,
        tees: JSON.stringify([
          { name: "Black", color: "#1a1a1a", par: 72, courseRating: 74.0, slopeRating: 143, yardage: 7135 },
          { name: "Palo Verde", color: "#16a34a", par: 72, courseRating: 71.2, slopeRating: 135, yardage: 6526 },
          { name: "Saguaro", color: "#f5f5f5", par: 72, courseRating: 68.5, slopeRating: 126, yardage: 5938 },
          { name: "Forward", color: "#dc2626", par: 72, courseRating: 65.7, slopeRating: 115, yardage: 5305 },
        ]) },
      { name: "Troon North (Monument)", city: "Scottsdale", state: "AZ", holes: 18, par: 72, slopeRating: 147, courseRating: 73.5, yardage: 7070, greenFee: 275, greenFeeMin: 175, greenFeeMax: 375,
        tees: JSON.stringify([
          { name: "Gold", color: "#ca8a04", par: 72, courseRating: 73.5, slopeRating: 147, yardage: 7070 },
          { name: "Silver", color: "#9ca3af", par: 72, courseRating: 69.8, slopeRating: 132, yardage: 6220 },
          { name: "Copper", color: "#b45309", par: 72, courseRating: 67.4, slopeRating: 125, yardage: 5821 },
          { name: "Turquoise", color: "#0891b2", par: 72, courseRating: 64.0, slopeRating: 113, yardage: 5100 },
        ]) },
      { name: "We-Ko-Pa (Saguaro)", city: "Fort McDowell", state: "AZ", holes: 18, par: 71, slopeRating: 137, courseRating: 72.0, yardage: 6966, greenFee: 210, greenFeeMin: 139, greenFeeMax: 289,
        tees: JSON.stringify([
          { name: "Saguaro", color: "#1a1a1a", par: 71, courseRating: 72.0, slopeRating: 137, yardage: 6966 },
          { name: "Purple", color: "#7c3aed", par: 71, courseRating: 70.2, slopeRating: 132, yardage: 6603 },
          { name: "White", color: "#f5f5f5", par: 71, courseRating: 68.8, slopeRating: 125, yardage: 6252 },
          { name: "Composite", color: "#16a34a", par: 71, courseRating: 66.9, slopeRating: 120, yardage: 5786 },
        ]) },
      { name: "Talking Stick (O'odham)", city: "Scottsdale", state: "AZ", holes: 18, par: 70, slopeRating: 124, courseRating: 72.6, yardage: 7133, greenFee: 165, greenFeeMin: 89, greenFeeMax: 199,
        tees: JSON.stringify([
          { name: "Black", color: "#1a1a1a", par: 70, courseRating: 72.6, slopeRating: 124, yardage: 7133 },
          { name: "Gold", color: "#ca8a04", par: 70, courseRating: 69.9, slopeRating: 119, yardage: 6510 },
          { name: "Gold/Jade", color: "#16a34a", par: 70, courseRating: 67.0, slopeRating: 116, yardage: 5945 },
          { name: "Jade", color: "#059669", par: 70, courseRating: 65.2, slopeRating: 111, yardage: 5532 },
        ]) },
      { name: "Talking Stick (Piipaash)", city: "Scottsdale", state: "AZ", holes: 18, par: 71, slopeRating: 126, courseRating: 72.0, yardage: 6833, greenFee: 165, greenFeeMin: 89, greenFeeMax: 199,
        tees: JSON.stringify([
          { name: "Black", color: "#1a1a1a", par: 71, courseRating: 72.0, slopeRating: 126, yardage: 6833 },
          { name: "Gold", color: "#ca8a04", par: 71, courseRating: 69.7, slopeRating: 120, yardage: 6430 },
          { name: "Gold/Jade", color: "#16a34a", par: 71, courseRating: 67.4, slopeRating: 117, yardage: 6040 },
          { name: "Jade", color: "#059669", par: 71, courseRating: 64.9, slopeRating: 108, yardage: 5331 },
        ]) },
      { name: "Papago Golf Club", city: "Phoenix", state: "AZ", holes: 18, par: 72, slopeRating: 130, courseRating: 75.0, yardage: 7380, greenFee: 130, greenFeeMin: 45, greenFeeMax: 130,
        tees: JSON.stringify([
          { name: "Black", color: "#1a1a1a", par: 72, courseRating: 75.0, slopeRating: 130, yardage: 7380 },
          { name: "Blue", color: "#1e40af", par: 72, courseRating: 72.0, slopeRating: 125, yardage: 6882 },
          { name: "White", color: "#f5f5f5", par: 72, courseRating: 70.1, slopeRating: 120, yardage: 6465 },
          { name: "Green", color: "#16a34a", par: 72, courseRating: 66.9, slopeRating: 115, yardage: 5797 },
        ]) },
      { name: "McCormick Ranch (Palm)", city: "Scottsdale", state: "AZ", holes: 18, par: 72, slopeRating: 132, courseRating: 73.2, yardage: 7044, greenFee: 130, greenFeeMin: 59, greenFeeMax: 149,
        tees: JSON.stringify([
          { name: "Blue", color: "#1e40af", par: 72, courseRating: 73.2, slopeRating: 132, yardage: 7044 },
          { name: "White", color: "#f5f5f5", par: 72, courseRating: 70.1, slopeRating: 127, yardage: 6279 },
          { name: "Brown", color: "#92400e", par: 72, courseRating: 67.7, slopeRating: 120, yardage: 5820 },
          { name: "Red", color: "#dc2626", par: 72, courseRating: 68.7, slopeRating: 117, yardage: 5333 },
        ]) },
      { name: "McCormick Ranch (Pine)", city: "Scottsdale", state: "AZ", holes: 18, par: 72, slopeRating: 130, courseRating: 74.4, yardage: 7187, greenFee: 120, greenFeeMin: 49, greenFeeMax: 139,
        tees: JSON.stringify([
          { name: "Blue", color: "#1e40af", par: 72, courseRating: 74.4, slopeRating: 130, yardage: 7187 },
          { name: "White", color: "#f5f5f5", par: 72, courseRating: 70.5, slopeRating: 127, yardage: 6371 },
          { name: "Brown", color: "#92400e", par: 72, courseRating: 68.7, slopeRating: 120, yardage: 5993 },
          { name: "Red", color: "#dc2626", par: 72, courseRating: 70.2, slopeRating: 115, yardage: 5333 },
        ]) },
      { name: "Silverado Golf Club", city: "Scottsdale", state: "AZ", holes: 18, par: 70, slopeRating: 114, courseRating: 67.8, yardage: 6313, greenFee: 65, greenFeeMin: 29, greenFeeMax: 79,
        tees: JSON.stringify([
          { name: "Gold", color: "#ca8a04", par: 70, courseRating: 67.8, slopeRating: 114, yardage: 6313 },
          { name: "White", color: "#f5f5f5", par: 70, courseRating: 65.3, slopeRating: 106, yardage: 5734 },
          { name: "Green", color: "#16a34a", par: 70, courseRating: 63.7, slopeRating: 102, yardage: 5323 },
          { name: "Red", color: "#dc2626", par: 70, courseRating: 62.4, slopeRating: 97, yardage: 4896 },
        ]) },
      { name: "Stonecreek Golf Club", city: "Paradise Valley", state: "AZ", holes: 18, par: 71, slopeRating: 131, courseRating: 72.8, yardage: 6871, greenFee: 100, greenFeeMin: 49, greenFeeMax: 129,
        tees: JSON.stringify([
          { name: "Championship", color: "#1a1a1a", par: 71, courseRating: 72.8, slopeRating: 131, yardage: 6871 },
          { name: "Back", color: "#1e40af", par: 71, courseRating: 69.9, slopeRating: 128, yardage: 6322 },
          { name: "Middle", color: "#f5f5f5", par: 71, courseRating: 68.1, slopeRating: 125, yardage: 5937 },
          { name: "Forward", color: "#dc2626", par: 71, courseRating: 68.4, slopeRating: 119, yardage: 5018 },
        ]) },
      { name: "Dove Valley Ranch", city: "Cave Creek", state: "AZ", holes: 18, par: 72, slopeRating: 133, courseRating: 73.1, yardage: 7095, greenFee: 90, greenFeeMin: 39, greenFeeMax: 109,
        tees: JSON.stringify([
          { name: "Black", color: "#1a1a1a", par: 72, courseRating: 73.1, slopeRating: 133, yardage: 7095 },
          { name: "Gold", color: "#ca8a04", par: 72, courseRating: 70.2, slopeRating: 124, yardage: 6475 },
          { name: "White", color: "#f5f5f5", par: 72, courseRating: 67.8, slopeRating: 118, yardage: 5925 },
          { name: "Green", color: "#16a34a", par: 72, courseRating: 65.5, slopeRating: 112, yardage: 5376 },
        ]) },
    ];
    const courseIds: string[] = [];
    for (const c of courseData) {
      const id = randomUUID();
      courseIds.push(id);
      this.courses.set(id, { ...c, id });
    }

    // Seed 5 demo profiles with varying handicaps
    // The first profile is the default "current user"
    const demoProfiles = [
      { name: "You", ghinNumber: "7654321", handicapIndex: 15.2, homeCourse: "Papago Golf Club", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Pro Pete", ghinNumber: "1001001", handicapIndex: 2.0, homeCourse: "TPC Scottsdale (Stadium)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Low-Hcp Laura", ghinNumber: "2002002", handicapIndex: 8.4, homeCourse: "Troon North (Monument)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Mid-Range Mike", ghinNumber: "3003003", handicapIndex: 18.0, homeCourse: "Talking Stick (O'odham)", city: "Phoenix", state: "AZ", isVerified: true },
      { name: "Casual Casey", ghinNumber: "4004004", handicapIndex: 25.0, homeCourse: "Silverado Golf Club", city: "Mesa", state: "AZ", isVerified: false },
    ];

    for (const dp of demoProfiles) {
      const id = randomUUID();
      this.demoProfileIds.push(id);
      this.golfers.set(id, { ...dp, id, avatarUrl: null, ghinNumber: dp.ghinNumber ?? null });
    }
    const currentUserId = this.demoProfileIds[0];
    this.currentUserId = currentUserId;

    // Seed 35 diverse golfers
    const golferData: InsertGolfer[] = [
      { name: "Mike Thompson", ghinNumber: "2847361", handicapIndex: 8.2, homeCourse: "TPC Scottsdale (Stadium)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Sarah Chen", ghinNumber: "9182734", handicapIndex: 12.5, homeCourse: "Grayhawk Golf Club (Raptor)", city: "Phoenix", state: "AZ", isVerified: true },
      { name: "James Rodriguez", ghinNumber: "5739284", handicapIndex: 4.1, homeCourse: "Troon North (Monument)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Emily Davis", ghinNumber: "3847291", handicapIndex: 18.7, homeCourse: "We-Ko-Pa (Saguaro)", city: "Mesa", state: "AZ", isVerified: true },
      { name: "Tom Wilson", ghinNumber: "6291048", handicapIndex: 22.3, homeCourse: "Papago Golf Club", city: "Tempe", state: "AZ", isVerified: false },
      { name: "Rachel Kim", ghinNumber: "8374651", handicapIndex: 6.8, homeCourse: "Grayhawk Golf Club (Raptor)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Chris Brown", ghinNumber: "1928374", handicapIndex: 15.1, homeCourse: "Papago Golf Club", city: "Chandler", state: "AZ", isVerified: true },
      { name: "David Park", ghinNumber: "4716283", handicapIndex: 2.3, homeCourse: "Troon North (Monument)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Lisa Garcia", ghinNumber: "7384921", handicapIndex: 27.4, homeCourse: "Silverado Golf Club", city: "Gilbert", state: "AZ", isVerified: false },
      { name: "Alex Morgan", ghinNumber: "5128374", handicapIndex: 10.9, homeCourse: "TPC Scottsdale (Stadium)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Kevin Zhang", handicapIndex: 14.2, homeCourse: "McCormick Ranch (Palm)", city: "Phoenix", state: "AZ", isVerified: false },
      { name: "Megan Scott", ghinNumber: "2938471", handicapIndex: 9.6, homeCourse: "Troon North (Monument)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Brian O'Connor", ghinNumber: "6182947", handicapIndex: 20.1, homeCourse: "Talking Stick (O'odham)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Jennifer Lee", ghinNumber: "3917284", handicapIndex: 16.3, homeCourse: "Stonecreek Golf Club", city: "Paradise Valley", state: "AZ", isVerified: true },
      { name: "Marcus Johnson", ghinNumber: "8472936", handicapIndex: -1.2, homeCourse: "TPC Scottsdale (Stadium)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Nicole Patel", ghinNumber: "5293847", handicapIndex: 11.8, homeCourse: "McCormick Ranch (Pine)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Ryan Martinez", handicapIndex: 25.6, homeCourse: "Silverado Golf Club", city: "Chandler", state: "AZ", isVerified: false },
      { name: "Sophia Wang", ghinNumber: "7419283", handicapIndex: 7.4, homeCourse: "Grayhawk Golf Club (Raptor)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Daniel Foster", ghinNumber: "2847195", handicapIndex: 13.9, homeCourse: "Dove Valley Ranch", city: "Cave Creek", state: "AZ", isVerified: true },
      { name: "Ashley Cooper", ghinNumber: "6381924", handicapIndex: 19.5, homeCourse: "Papago Golf Club", city: "Phoenix", state: "AZ", isVerified: true },
      { name: "Tyler Brooks", handicapIndex: 30.2, homeCourse: "Silverado Golf Club", city: "Mesa", state: "AZ", isVerified: false },
      { name: "Chloe Anderson", ghinNumber: "4927183", handicapIndex: 5.3, homeCourse: "We-Ko-Pa (Saguaro)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Nathan Reed", ghinNumber: "8193724", handicapIndex: 17.8, homeCourse: "Talking Stick (Piipaash)", city: "Tempe", state: "AZ", isVerified: true },
      { name: "Isabella Torres", ghinNumber: "3628174", handicapIndex: 21.4, homeCourse: "McCormick Ranch (Palm)", city: "Gilbert", state: "AZ", isVerified: true },
      { name: "Jack Sullivan", ghinNumber: "7284916", handicapIndex: 3.7, homeCourse: "TPC Scottsdale (Stadium)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Olivia Harper", handicapIndex: 28.9, homeCourse: "Dove Valley Ranch", city: "Cave Creek", state: "AZ", isVerified: false },
      { name: "Ethan Nguyen", ghinNumber: "5917382", handicapIndex: 10.1, homeCourse: "Stonecreek Golf Club", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Grace Mitchell", ghinNumber: "4382917", handicapIndex: 14.7, homeCourse: "Papago Golf Club", city: "Phoenix", state: "AZ", isVerified: true },
      { name: "Sam Taylor", ghinNumber: "8291473", handicapIndex: 36.0, homeCourse: "Silverado Golf Club", city: "Glendale", state: "AZ", isVerified: false },
      { name: "Maya Hernandez", ghinNumber: "6174829", handicapIndex: 8.9, homeCourse: "Talking Stick (O'odham)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Connor Walsh", ghinNumber: "3849271", handicapIndex: 1.5, homeCourse: "Troon North (Monument)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Zoe Campbell", handicapIndex: 23.7, homeCourse: "McCormick Ranch (Pine)", city: "Phoenix", state: "AZ", isVerified: false },
      { name: "Lucas Ramirez", ghinNumber: "7291834", handicapIndex: 16.8, homeCourse: "We-Ko-Pa (Saguaro)", city: "Mesa", state: "AZ", isVerified: true },
      { name: "Ava Robinson", ghinNumber: "5824917", handicapIndex: 12.1, homeCourse: "Grayhawk Golf Club (Raptor)", city: "Scottsdale", state: "AZ", isVerified: true },
      { name: "Derek Collins", ghinNumber: "4918273", handicapIndex: 0.4, homeCourse: "TPC Scottsdale (Stadium)", city: "Scottsdale", state: "AZ", isVerified: true },
    ];
    const golferIds: string[] = [currentUserId];
    for (const g of golferData) {
      const id = randomUUID();
      golferIds.push(id);
      this.golfers.set(id, { ...g, id, avatarUrl: null, ghinNumber: g.ghinNumber ?? null });
    }

    // Generate tee times: today + next 6 days, every 10 min from 6:00 to 16:00
    const today = new Date();
    const dates: string[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(today.getTime() + d * 86400000);
      dates.push(dt.toISOString().split("T")[0]);
    }

    const times: string[] = [];
    for (let h = 6; h <= 15; h++) {
      for (let m = 0; m < 60; m += 10) {
        const hh = h.toString().padStart(2, "0");
        const mm = m.toString().padStart(2, "0");
        times.push(`${hh}:${mm}`);
      }
    }
    // Add 16:00
    times.push("16:00");

    for (const courseId of courseIds) {
      const course = this.courses.get(courseId)!;
      const greenFeeCents = (course.greenFee || 100) * 100;

      for (const date of dates) {
        for (const time of times) {
          const teeTimeId = randomUUID();
          this.teeTimes.set(teeTimeId, {
            id: teeTimeId,
            courseId,
            date,
            time,
            maxPlayers: 4,
            pricePerPlayer: greenFeeCents,
          });
        }
      }
    }

    // Seed bookings — heavier in morning, realistic distribution
    // Skip all demo profiles from random booking assignment
    const demoSet = new Set(this.demoProfileIds);
    const otherGolferIds = golferIds.filter(id => !demoSet.has(id));
    const teeTimeArr = Array.from(this.teeTimes.values());
    const usedPairs = new Set<string>();

    for (const tt of teeTimeArr) {
      const hour = parseInt(tt.time.split(":")[0]);
      // Morning tee times (6-10) are more popular
      let bookingChance: number;
      if (hour < 8) {
        bookingChance = 0.6;
      } else if (hour < 10) {
        bookingChance = 0.7;
      } else if (hour < 12) {
        bookingChance = 0.5;
      } else if (hour < 14) {
        bookingChance = 0.4;
      } else {
        bookingChance = 0.3;
      }

      // Decide how many players (0-3)
      const r = rand();
      let numPlayers: number;
      if (r > bookingChance) {
        numPlayers = 0; // empty
      } else if (r < bookingChance * 0.15) {
        numPlayers = 3; // nearly full
      } else if (r < bookingChance * 0.45) {
        numPlayers = 2;
      } else {
        numPlayers = 1;
      }

      // Some slots full (4/4)
      if (rand() < 0.05 && hour >= 7 && hour <= 10) {
        numPlayers = 4;
      }

      // Assign random golfers
      const shuffled = [...otherGolferIds].sort(() => rand() - 0.5);
      for (let i = 0; i < Math.min(numPlayers, shuffled.length); i++) {
        const gId = shuffled[i];
        const pairKey = `${tt.id}-${gId}`;
        if (usedPairs.has(pairKey)) continue;
        usedPairs.add(pairKey);
        const bookingId = randomUUID();
        this.bookings.set(bookingId, { id: bookingId, teeTimeId: tt.id, golferId: gId });
      }
    }
  }

  // Golfers
  async getGolfer(id: string) { return this.golfers.get(id); }
  async getGolferByGhin(ghinNumber: string) {
    return Array.from(this.golfers.values()).find(g => g.ghinNumber === ghinNumber);
  }
  async getAllGolfers() { return Array.from(this.golfers.values()); }
  async getCurrentUser(): Promise<Golfer> {
    return this.golfers.get(this.currentUserId)!;
  }
  async createGolfer(data: InsertGolfer): Promise<Golfer> {
    const id = randomUUID();
    const golfer: Golfer = { ...data, id, avatarUrl: data.avatarUrl ?? null, ghinNumber: data.ghinNumber ?? null };
    this.golfers.set(id, golfer);
    return golfer;
  }

  // Courses
  async getCourse(id: string) { return this.courses.get(id); }
  async getAllCourses() { return Array.from(this.courses.values()); }
  async createCourse(data: InsertCourse): Promise<Course> {
    const id = randomUUID();
    const course: Course = { ...data, id };
    this.courses.set(id, course);
    return course;
  }

  // Tee Times
  async getTeeTime(id: string) { return this.teeTimes.get(id); }
  async getTeeTimesByDate(courseId: string, date: string): Promise<TeeTimeWithPlayers[]> {
    const teeTimes = Array.from(this.teeTimes.values())
      .filter(tt => tt.courseId === courseId && tt.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));

    const course = this.courses.get(courseId)!;
    const results: TeeTimeWithPlayers[] = [];

    for (const tt of teeTimes) {
      const players = await this.getBookingsForTeeTime(tt.id);
      results.push({ ...tt, course, players });
    }
    return results;
  }

  async getSuggestedTeeTimes(courseId: string, date: string, userHandicap: number): Promise<TeeTimeWithPlayers[]> {
    const allTimes = await this.getTeeTimesByDate(courseId, date);

    const suggestions = allTimes
      .filter(tt => {
        const spotsLeft = (tt.maxPlayers || 4) - tt.players.length;
        if (spotsLeft <= 0) return false;
        if (tt.players.length === 0) return false; // Must have at least 1 player
        return true;
      })
      .map(tt => {
        const avgHcp = tt.players.reduce((sum, p) => sum + (p.handicapIndex || 20), 0) / tt.players.length;
        const diff = Math.abs(avgHcp - userHandicap);
        return { tt, avgHcp, diff };
      })
      .filter(x => x.diff <= 8) // Within ~8 strokes
      .sort((a, b) => {
        // Prefer groups with 1-2 players (more social) and closer handicap
        const socialA = a.tt.players.length >= 1 && a.tt.players.length <= 2 ? 0 : 5;
        const socialB = b.tt.players.length >= 1 && b.tt.players.length <= 2 ? 0 : 5;
        return (a.diff + socialA) - (b.diff + socialB);
      })
      .slice(0, 4)
      .map(x => x.tt);

    return suggestions;
  }

  async createTeeTime(data: InsertTeeTime): Promise<TeeTime> {
    const id = randomUUID();
    const teeTime: TeeTime = { ...data, id };
    this.teeTimes.set(id, teeTime);
    return teeTime;
  }

  // Bookings
  async createBooking(data: InsertBooking): Promise<Booking> {
    const id = randomUUID();
    const booking: Booking = { ...data, id };
    this.bookings.set(id, booking);
    return booking;
  }
  async getBookingsForTeeTime(teeTimeId: string): Promise<Golfer[]> {
    const bookingEntries = Array.from(this.bookings.values()).filter(b => b.teeTimeId === teeTimeId);
    const golfers: Golfer[] = [];
    for (const b of bookingEntries) {
      const g = this.golfers.get(b.golferId);
      if (g) golfers.push(g);
    }
    return golfers;
  }
  async removeBooking(teeTimeId: string, golferId: string): Promise<void> {
    for (const [key, b] of this.bookings.entries()) {
      if (b.teeTimeId === teeTimeId && b.golferId === golferId) {
        this.bookings.delete(key);
        return;
      }
    }
  }

  async switchProfile(profileId: string): Promise<Golfer | undefined> {
    if (this.demoProfileIds.includes(profileId)) {
      this.currentUserId = profileId;
      return this.golfers.get(profileId);
    }
    return undefined;
  }

  async getDemoProfiles(): Promise<Golfer[]> {
    return this.demoProfileIds.map(id => this.golfers.get(id)!).filter(Boolean);
  }
}

export const storage = new MemStorage();

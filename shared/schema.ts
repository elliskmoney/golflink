import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Golfers
export const golfers = pgTable("golfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ghinNumber: text("ghin_number"),
  handicapIndex: real("handicap_index"),
  homeCourse: text("home_course"),
  city: text("city"),
  state: text("state"),
  avatarUrl: text("avatar_url"),
  isVerified: boolean("is_verified").default(false),
});

export const insertGolferSchema = createInsertSchema(golfers).omit({ id: true });
export type InsertGolfer = z.infer<typeof insertGolferSchema>;
export type Golfer = typeof golfers.$inferSelect;

// Tee Set type (stored as JSON on course)
export type TeeSet = {
  name: string;       // e.g. "Championship", "White", "Gold"
  color: string;      // CSS color for the tee marker dot
  par: number;
  courseRating: number;
  slopeRating: number;
  yardage: number;
};

// Courses
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  holes: integer("holes").default(18),
  par: integer("par").default(72),
  slopeRating: real("slope_rating"),
  courseRating: real("course_rating"),
  yardage: integer("yardage"),
  greenFee: integer("green_fee"),
  greenFeeMin: integer("green_fee_min"),
  greenFeeMax: integer("green_fee_max"),
  tees: text("tees"), // JSON string of TeeSet[]
});

export const insertCourseSchema = createInsertSchema(courses).omit({ id: true });
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;

// Tee Times
export const teeTimes = pgTable("tee_times", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  date: text("date").notNull(), // "2026-03-15"
  time: text("time").notNull(), // "08:30"
  maxPlayers: integer("max_players").default(4),
  pricePerPlayer: integer("price_per_player"), // cents
});

export const insertTeeTimeSchema = createInsertSchema(teeTimes).omit({ id: true });
export type InsertTeeTime = z.infer<typeof insertTeeTimeSchema>;
export type TeeTime = typeof teeTimes.$inferSelect;

// Bookings (golfer <-> tee time)
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teeTimeId: varchar("tee_time_id").notNull(),
  golferId: varchar("golfer_id").notNull(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// Extended types for API responses
export type TeeTimeWithPlayers = TeeTime & {
  course: Course;
  players: Golfer[];
};

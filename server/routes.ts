import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGolferSchema, insertBookingSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Current user
  app.get("/api/current-user", async (_req, res) => {
    const user = await storage.getCurrentUser();
    res.json(user);
  });

  // Courses
  app.get("/api/courses", async (_req, res) => {
    const courses = await storage.getAllCourses();
    res.json(courses);
  });

  app.get("/api/courses/:id", async (req, res) => {
    const course = await storage.getCourse(req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  });

  // Tee Times
  app.get("/api/tee-times", async (req, res) => {
    const { courseId, date } = req.query;
    if (!courseId || !date) {
      return res.status(400).json({ error: "courseId and date are required" });
    }
    const teeTimes = await storage.getTeeTimesByDate(courseId as string, date as string);
    res.json(teeTimes);
  });

  // Suggested tee times
  app.get("/api/suggested-tee-times", async (req, res) => {
    const { courseId, date } = req.query;
    if (!courseId || !date) {
      return res.status(400).json({ error: "courseId and date are required" });
    }
    const user = await storage.getCurrentUser();
    const suggestions = await storage.getSuggestedTeeTimes(
      courseId as string,
      date as string,
      user.handicapIndex || 15
    );
    res.json(suggestions);
  });

  // Demo profiles
  app.get("/api/demo-profiles", async (_req, res) => {
    const profiles = await storage.getDemoProfiles();
    res.json(profiles);
  });

  app.post("/api/switch-profile", async (req, res) => {
    const { profileId } = req.body;
    if (!profileId) return res.status(400).json({ error: "profileId is required" });
    const user = await storage.switchProfile(profileId);
    if (!user) return res.status(404).json({ error: "Profile not found" });
    res.json(user);
  });

  // Golfers
  app.get("/api/golfers", async (_req, res) => {
    const golfers = await storage.getAllGolfers();
    res.json(golfers);
  });

  app.get("/api/golfers/:id", async (req, res) => {
    const golfer = await storage.getGolfer(req.params.id);
    if (!golfer) return res.status(404).json({ error: "Golfer not found" });
    res.json(golfer);
  });

  app.get("/api/golfers/ghin/:ghinNumber", async (req, res) => {
    const golfer = await storage.getGolferByGhin(req.params.ghinNumber);
    if (!golfer) return res.status(404).json({ error: "GHIN number not found" });
    res.json(golfer);
  });

  app.post("/api/golfers", async (req, res) => {
    const result = insertGolferSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    const golfer = await storage.createGolfer(result.data);
    res.status(201).json(golfer);
  });

  // Bookings
  app.post("/api/bookings", async (req, res) => {
    const result = insertBookingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error });

    // Check if tee time exists
    const teeTime = await storage.getTeeTime(result.data.teeTimeId);
    if (!teeTime) return res.status(404).json({ error: "Tee time not found" });

    // Check max players
    const currentPlayers = await storage.getBookingsForTeeTime(teeTime.id);
    if (currentPlayers.length >= (teeTime.maxPlayers || 4)) {
      return res.status(400).json({ error: "Tee time is full" });
    }

    // Check if golfer already booked
    if (currentPlayers.some(p => p.id === result.data.golferId)) {
      return res.status(400).json({ error: "Golfer already booked for this tee time" });
    }

    const booking = await storage.createBooking(result.data);
    res.status(201).json(booking);
  });

  app.delete("/api/bookings/:teeTimeId/:golferId", async (req, res) => {
    await storage.removeBooking(req.params.teeTimeId, req.params.golferId);
    res.status(204).send();
  });

  return httpServer;
}

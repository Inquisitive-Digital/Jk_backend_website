import express from "express";
import {
    createCalendarEvent,
    getAllCalendarEvents,
    getCalendarEventsByMonth,
    getCalendarEventById,
    updateCalendarEvent,
    deleteCalendarEvent,
    bulkCreateCalendarEvents,
} from "../controllers/calendarEventController.js";
import { protectAdmin } from "../middlewares/adminAuth.js";

const router = express.Router();

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// Get all calendar events (optionally ?month=April&year=2026)
router.get("/", getAllCalendarEvents);

// Get events for a specific month
router.get("/month/:month", getCalendarEventsByMonth);

// Get single event by ID
router.get("/:id", getCalendarEventById);

// ─── ADMIN ROUTES (require valid admin JWT) ───────────────────────────────────

// Create calendar event
router.post("/", protectAdmin, createCalendarEvent);

// Bulk create calendar events (for seeding)
router.post("/bulk", protectAdmin, bulkCreateCalendarEvents);

// Update calendar event
router.put("/:id", protectAdmin, updateCalendarEvent);

// Delete calendar event
router.delete("/:id", protectAdmin, deleteCalendarEvent);

export default router;

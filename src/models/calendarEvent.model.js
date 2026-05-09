import mongoose from "mongoose";

const calendarEventSchema = new mongoose.Schema(
    {
        // ── Display name shown on the calendar card ───────────────────────
        name: {
            type: String,
            required: [true, "Event name is required"],
            trim: true,
        },
        // ── Human-readable date string shown in the UI (e.g. "3rd - 6th April 2026") ──
        date: {
            type: String,
            required: [true, "Event date display string is required"],
            trim: true,
        },
        // ── Calendar grouping ─────────────────────────────────────────────
        month: {
            type: String,
            required: [true, "Month is required"],
            enum: [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December",
            ],
        },
        year: {
            type: Number,
            required: [true, "Year is required"],
            default: 2026,
        },
        // ── Optional link to a Blog document ─────────────────────────────
        linkedBlog: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Blog",
            default: null,
        },
        // ── Blog slug (when linking by slug instead of ObjectId) ──────────
        blogSlug: {
            type: String,
            trim: true,
            lowercase: true,
            default: null,
        },
        // ── Metadata ─────────────────────────────────────────────────────
        description: {
            type: String,
            trim: true,
        },
        location: {
            type: String,
            trim: true,
        },
        // ── Category for grouping ────────────────────────────────────────
        category: {
            type: String,
            trim: true,
            enum: ["Sports", "Corporate", "Entertainment", "Exhibition", "Cultural", "General"],
            default: "General",
        },
        // ── Admin controls ───────────────────────────────────────────────
        isActive: {
            type: Boolean,
            default: true,
        },
        priority: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for fast calendar lookups
calendarEventSchema.index({ month: 1, year: 1, isActive: 1 });
calendarEventSchema.index({ linkedBlog: 1 });

const CalendarEvent = mongoose.model("CalendarEvent", calendarEventSchema);
export default CalendarEvent;

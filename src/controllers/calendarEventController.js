import CalendarEvent from "../models/calendarEvent.model.js";
import Blog from "../models/blog.model.js";

// ─── CREATE a new calendar event ─────────────────────────────────────────────
export const createCalendarEvent = async (req, res) => {
    try {
        const {
            name, date, month, year,
            linkedBlog, blogSlug,
            description, location, category,
            isActive, priority,
        } = req.body;

        const eventData = {
            name,
            date,
            month,
            year: year || 2026,
            description,
            location,
            category: category || "General",
            isActive: isActive !== undefined ? isActive : true,
            priority: priority || 0,
        };

        // Link to blog by ObjectId
        if (linkedBlog) {
            eventData.linkedBlog = linkedBlog;
            // Also fetch the slug so the frontend can link directly
            const blog = await Blog.findById(linkedBlog).select("slug");
            if (blog) eventData.blogSlug = blog.slug;
        }

        // Or link by slug only
        if (blogSlug && !linkedBlog) {
            eventData.blogSlug = blogSlug;
            const blog = await Blog.findOne({ slug: blogSlug }).select("_id");
            if (blog) eventData.linkedBlog = blog._id;
        }

        const event = await CalendarEvent.create(eventData);

        res.status(201).json({
            success: true,
            message: "Calendar event created successfully",
            event,
        });
    } catch (error) {
        console.error("Error creating calendar event:", error);
        res.status(500).json({
            success: false,
            message: "Error creating calendar event",
            error: error.message,
        });
    }
};

// ─── GET ALL calendar events (optionally filter by month/year) ───────────────
export const getAllCalendarEvents = async (req, res) => {
    try {
        const { month, year, includeInactive } = req.query;

        const filter = {};
        if (!includeInactive) filter.isActive = true;
        if (month) filter.month = month;
        if (year) filter.year = parseInt(year);

        const events = await CalendarEvent.find(filter)
            .populate("linkedBlog", "title slug heroImageUrl")
            .sort({ priority: 1, createdAt: 1 })
            .select("-__v");

        // Group by month for the calendar view
        const grouped = {};
        const monthOrder = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ];

        for (const evt of events) {
            if (!grouped[evt.month]) {
                grouped[evt.month] = { month: evt.month, events: [] };
            }
            grouped[evt.month].events.push(evt);
        }

        // Return in month order
        const calendarData = monthOrder
            .filter((m) => grouped[m])
            .map((m) => grouped[m]);

        res.status(200).json({
            success: true,
            count: events.length,
            events,         // flat list
            calendarData,   // grouped by month (for EventCalendar page)
        });
    } catch (error) {
        console.error("Error fetching calendar events:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching calendar events",
            error: error.message,
        });
    }
};

// ─── GET calendar events for a SINGLE MONTH ──────────────────────────────────
export const getCalendarEventsByMonth = async (req, res) => {
    try {
        const { month } = req.params;
        const { year } = req.query;

        const filter = { month, isActive: true };
        if (year) filter.year = parseInt(year);

        const events = await CalendarEvent.find(filter)
            .populate("linkedBlog", "title slug heroImageUrl")
            .sort({ priority: 1, createdAt: 1 })
            .select("-__v");

        res.status(200).json({
            success: true,
            count: events.length,
            month,
            events,
        });
    } catch (error) {
        console.error("Error fetching monthly events:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching monthly events",
            error: error.message,
        });
    }
};

// ─── GET single calendar event by ID ─────────────────────────────────────────
export const getCalendarEventById = async (req, res) => {
    try {
        const event = await CalendarEvent.findById(req.params.id)
            .populate("linkedBlog", "title slug heroImageUrl")
            .select("-__v");

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Calendar event not found",
            });
        }

        res.status(200).json({ success: true, event });
    } catch (error) {
        console.error("Error fetching calendar event:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching calendar event",
            error: error.message,
        });
    }
};

// ─── UPDATE a calendar event ─────────────────────────────────────────────────
export const updateCalendarEvent = async (req, res) => {
    try {
        const event = await CalendarEvent.findById(req.params.id);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Calendar event not found",
            });
        }

        const updateData = { ...req.body };

        // Re-sync blog link if linkedBlog changed
        if (updateData.linkedBlog) {
            const blog = await Blog.findById(updateData.linkedBlog).select("slug");
            if (blog) updateData.blogSlug = blog.slug;
        } else if (updateData.blogSlug && !updateData.linkedBlog) {
            const blog = await Blog.findOne({ slug: updateData.blogSlug }).select("_id");
            if (blog) updateData.linkedBlog = blog._id;
        }

        // Allow unlinking blog
        if (updateData.linkedBlog === "" || updateData.linkedBlog === null) {
            updateData.linkedBlog = null;
            updateData.blogSlug = null;
        }

        const updatedEvent = await CalendarEvent.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate("linkedBlog", "title slug heroImageUrl");

        res.status(200).json({
            success: true,
            message: "Calendar event updated successfully",
            event: updatedEvent,
        });
    } catch (error) {
        console.error("Error updating calendar event:", error);
        res.status(500).json({
            success: false,
            message: "Error updating calendar event",
            error: error.message,
        });
    }
};

// ─── DELETE a calendar event ─────────────────────────────────────────────────
export const deleteCalendarEvent = async (req, res) => {
    try {
        const event = await CalendarEvent.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Calendar event not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Calendar event deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting calendar event:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting calendar event",
            error: error.message,
        });
    }
};

// ─── BULK CREATE calendar events (for seeding) ──────────────────────────────
export const bulkCreateCalendarEvents = async (req, res) => {
    try {
        const { events } = req.body;

        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide an array of events",
            });
        }

        const created = await CalendarEvent.insertMany(events, { ordered: false });

        res.status(201).json({
            success: true,
            message: `${created.length} calendar events created`,
            count: created.length,
        });
    } catch (error) {
        console.error("Error bulk creating calendar events:", error);
        res.status(500).json({
            success: false,
            message: "Error bulk creating calendar events",
            error: error.message,
        });
    }
};

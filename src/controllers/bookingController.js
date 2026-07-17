import { Booking } from "../models/booking.model.js";
import {
    sendWelcomeEmail,
    sendLeadNotificationToAdmin,
    sendBookingConfirmation,
    sendNewBookingToAdmin,
} from "../utils/emailService.js";

// ================================================================
// LONDON-TIME UTILITY — Hostinger-safe (works on ANY server TZ)
// Both sides go through the same Europe/London pipeline so
// the server's own OS timezone cancels out completely.
// Handles GMT (winter) and BST (summer) automatically.
// ================================================================
const getLondonNowMs = () => {
    const londonWallClock = new Date().toLocaleString("en-US", {
        timeZone: "Europe/London",
    });
    return new Date(londonWallClock).getTime();
};

// pickupDate = "YYYY-MM-DD"  (string, e.g. "2026-06-18")
// pickupTime = "HH:MM" OR "HH:MM AM/PM"  (e.g. "14:30" or "02:30 PM")
const to24h = (timeStr) => {
    if (!timeStr) return "00:00";
    if (!timeStr.includes(" ")) return timeStr; // already 24h ("14:30")
    const [time, period] = timeStr.split(" ");
    let [h, m] = time.split(":").map(Number);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const getProposedLondonMs = (pickupDate, pickupTime) => {
    // The pickupDate and pickupTime are ALREADY in London time.
    // By parsing it directly as a naive date string, it gets the same local server offset
    // as the londonNowMs (which parses the London wall clock string).
    // This perfectly cancels out the server's OS timezone.
    const time24 = to24h(pickupTime);
    return new Date(`${pickupDate}T${time24}:00`).getTime();
};

/**
 * Create a new booking (called when user clicks Proceed on Step 3)
 * This saves the booking as a lead and sends welcome/notification emails
 * Emails are sent asynchronously so the response is fast
 */
export const createBooking = async (req, res) => {
    try {
        const {
            // Journey info
            pickup,
            dropoff,
            pickupDate,
            pickupTime,
            serviceType,
            journeyInfo,
            // Vehicle info
            vehicleId,
            vehicleDetails,
            pricing,
            // Passenger details
            passengerDetails,
            // Guest details
            isBookingForSomeoneElse,
            guestDetails,
            // Airport pickup
            isAirportPickup,
            flightDetails,
            // Additional
            specialInstructions,
            // Payment details
            paymentStatus,
            paymentIntentId,
            // User (if logged in)
            userId,
            // Flag to skip emails (for updates)
            skipEmails,
        } = req.body;

        // ================================================================
        // LONDON-TIME PAST-BOOKING GUARD
        // Rejects any booking whose pickup time has already passed in London.
        // Safe on Hostinger regardless of server OS timezone.
        // ================================================================
        if (pickupDate && pickupTime) {
            const londonNowMs  = getLondonNowMs();
            const proposedMs   = getProposedLondonMs(pickupDate, pickupTime);

            if (proposedMs < londonNowMs) {
                return res.status(400).json({
                    success: false,
                    error:   "Invalid Booking Window",
                    message: "The requested pickup time has already passed in London. Please select a future time.",
                });
            }
        }

        // Create booking with all details
        const booking = await Booking.create({
            pickup,
            dropoff,
            pickupDate,
            pickupTime,
            serviceType,
            journeyInfo,
            vehicleId,
            vehicleDetails,
            pricing,
            passengerDetails,
            isBookingForSomeoneElse,
            guestDetails: isBookingForSomeoneElse ? guestDetails : null,
            isAirportPickup,
            flightDetails: isAirportPickup ? flightDetails : null,
            specialInstructions,
            status: paymentStatus === "paid" ? "confirmed" : "pending",
            paymentStatus: paymentStatus || "pending",
            paymentIntentId,
            userId,
        });

        // Send emails only for new leads (not updates) and when emails are not skipped
        if (!skipEmails && paymentStatus !== "paid") {
            // Prepare booking data for emails
            const emailBookingData = {
                ...booking.toObject(),
                pickup: pickup,
                dropoff: dropoff,
            };

            // Send welcome email to user (async, don't wait)
            sendWelcomeEmail(emailBookingData).catch((err) => {
                console.error("Background email error (welcome):", err);
            });

            // Send lead notification to admin (async, don't wait)
            sendLeadNotificationToAdmin(emailBookingData).catch((err) => {
                console.error("Background email error (admin lead):", err);
            });
        }

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            data: booking,
        });
    } catch (error) {
        console.error("Error creating booking:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to create booking",
            error: error.message,
        });
    }
};

/**
 * Get booking by ID
 */
export const getBooking = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        res.status(200).json({
            success: true,
            data: booking,
        });
    } catch (error) {
        console.error("Error fetching booking:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch booking",
            error: error.message,
        });
    }
};

/**
 * Update booking status (for admin or after payment update)
 * Sends confirmation emails when payment status changes to 'paid'
 */
export const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, paymentStatus, paymentIntentId } = req.body;

        const updateData = {};
        if (status) updateData.status = status;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;
        if (paymentIntentId) updateData.paymentIntentId = paymentIntentId;

        // If payment is now paid, also set status to confirmed
        if (paymentStatus === "paid" && !status) {
            updateData.status = "confirmed";
        }

        const booking = await Booking.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // Send confirmation emails when payment is successful
        if (paymentStatus === "paid") {
            // Prepare booking data for emails
            const emailBookingData = booking.toObject();

            // Send booking confirmation to user (async, don't wait)
            sendBookingConfirmation(emailBookingData).catch((err) => {
                console.error("Background email error (confirmation):", err);
            });

            // Send new booking alert to admin (async, don't wait)
            sendNewBookingToAdmin(emailBookingData, { paymentIntentId }).catch((err) => {
                console.error("Background email error (admin booking):", err);
            });
        }

        res.status(200).json({
            success: true,
            message: "Booking updated successfully",
            data: booking,
        });
    } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update booking",
            error: error.message,
        });
    }
};

/**
 * Update booking details (when user goes back and re-submits from step 3)
 * Always updates the full booking payload — including location, vehicle, pricing, date/time.
 * Sends welcome email only if the passenger email address changed.
 */
export const updateBookingDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            // Passenger / flight / instructions
            passengerDetails,
            flightDetails,
            specialInstructions,
            isBookingForSomeoneElse,
            guestDetails,
            isAirportPickup,
            originalEmail, // The original email to compare against
            // Journey fields (updated when user goes back and changes location / car / date)
            pickup,
            dropoff,
            pickupDate,
            pickupTime,
            serviceType,
            journeyInfo,
            vehicleId,
            vehicleDetails,
            pricing,
        } = req.body;

        // Get the existing booking to check email change
        const existingBooking = await Booking.findById(id);
        if (!existingBooking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // Check if email has changed
        const newEmail = passengerDetails?.email;
        const emailChanged = originalEmail && newEmail && originalEmail !== newEmail;

        // Build update data — always include journey fields so DB stays in sync
        const updateData = {
            // Passenger details
            passengerDetails,
            isBookingForSomeoneElse,
            guestDetails: isBookingForSomeoneElse ? guestDetails : null,
            isAirportPickup,
            flightDetails: isAirportPickup ? flightDetails : null,
            specialInstructions,
            // Journey fields — only overwrite if provided in the request
            ...(pickup !== undefined && { pickup }),
            ...(dropoff !== undefined && { dropoff }),
            ...(pickupDate !== undefined && { pickupDate }),
            ...(pickupTime !== undefined && { pickupTime }),
            ...(serviceType !== undefined && { serviceType }),
            ...(journeyInfo !== undefined && { journeyInfo }),
            ...(vehicleId !== undefined && { vehicleId }),
            ...(vehicleDetails !== undefined && { vehicleDetails }),
            ...(pricing !== undefined && { pricing }),
        };

        const booking = await Booking.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        // Send welcome email only to the NEW email if the email address changed
        if (emailChanged) {
            const emailBookingData = booking.toObject();
            sendWelcomeEmail(emailBookingData).catch((err) => {
                console.error("Background email error (email change welcome):", err);
            });
            console.log(`Email changed from ${originalEmail} to ${newEmail} - sending welcome email to new address`);
        }

        // Always re-notify admin so the dashboard reflects the latest booking details
        sendLeadNotificationToAdmin(booking.toObject()).catch((err) => {
            console.error("Background email error (admin re-notification):", err);
        });

        res.status(200).json({
            success: true,
            message: "Booking details updated successfully",
            data: booking,
            emailSent: emailChanged,
        });
    } catch (error) {
        console.error("Error updating booking details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update booking details",
            error: error.message,
        });
    }
};

/**
 * Get all bookings (for admin dashboard)
 * Supports filtering by status, paymentStatus, serviceType and pagination
 */
export const getAllBookings = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, paymentStatus, serviceType } = req.query;

        const query = {};
        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;
        if (serviceType) query.serviceType = serviceType;

        const bookings = await Booking.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Booking.countDocuments(query);

        // Get counts for dashboard stats
        const stats = {
            total: await Booking.countDocuments(),
            pending: await Booking.countDocuments({ status: "pending" }),
            confirmed: await Booking.countDocuments({ status: "confirmed" }),
            completed: await Booking.countDocuments({ status: "completed" }),
            cancelled: await Booking.countDocuments({ status: "cancelled" }),
        };

        res.status(200).json({
            success: true,
            data: bookings,
            stats,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings",
            error: error.message,
        });
    }
};

/**
 * Delete booking (admin only)
 */
export const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findByIdAndDelete(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Booking deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete booking",
            error: error.message,
        });
    }
};


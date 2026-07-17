import { sendContactInquiryToAdmin, sendBulkQuoteRequestToAdmin, sendCarQuoteEmails } from "../utils/emailService.js";
import { Booking } from "../models/booking.model.js";
import { ContactLead } from "../models/contact.model.js";


/**
 * Handle Contact Us form submission
 * Validates required fields and sends inquiry email to admin
 */
export const submitContactInquiry = async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // Basic server-side validation
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and message are required.",
            });
        }

        // Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address.",
            });
        }

        // Send inquiry email to admin (await so we can catch failures)
        const result = await sendContactInquiryToAdmin({
            name: name.trim(),
            email: email.trim(),
            phone: phone?.trim() || "",
            subject: subject?.trim() || "",
            message: message.trim(),
        });

        // Save lead to database
        try {
            const newLead = new ContactLead({
                name: name.trim(),
                email: email.trim(),
                phone: phone?.trim() || "",
                subject: subject?.trim() || "",
                message: message.trim(),
                type: "contact"
            });
            await newLead.save();
        } catch (dbError) {
            console.error("Error saving contact lead to database:", dbError);
        }

        if (!result.success) {
            console.error("Email sending failed:", result.error);
            return res.status(500).json({
                success: false,
                message: "Failed to send your inquiry. Please try again later.",
            });
        }

        res.status(200).json({
            success: true,
            message: "Your inquiry has been received. We will get back to you within 24 hours.",
        });
    } catch (error) {
        console.error("Error in submitContactInquiry:", error.message);
        res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again.",
            error: error.message,
        });
    }
};

/**
 * Handle Bulk / Corporate Quote Request (sticky ContactForm on every page)
 * Validates required fields and sends bulk quote email to admin
 */
export const submitBulkQuoteRequest = async (req, res) => {
    try {
        const { name, email, enquiry } = req.body;

        // Basic server-side validation
        if (!name || !email || !enquiry) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and enquiry are required.",
            });
        }

        // Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address.",
            });
        }

        // Send bulk quote email to admin
        const result = await sendBulkQuoteRequestToAdmin({
            name: name.trim(),
            email: email.trim(),
            enquiry: enquiry.trim(),
        });

        // Save lead to database
        try {
            const newLead = new ContactLead({
                name: name.trim(),
                email: email.trim(),
                message: enquiry.trim(),
                type: "bulk_quote"
            });
            await newLead.save();
        } catch (dbError) {
            console.error("Error saving bulk quote lead to database:", dbError);
        }

        if (!result.success) {
            console.error("Bulk quote email sending failed:", result.error);
            return res.status(500).json({
                success: false,
                message: "Failed to send your quote request. Please try again later.",
            });
        }

        res.status(200).json({
            success: true,
            message: "Your quote request has been received. We will get back to you within 24 hours.",
        });
    } catch (error) {
        console.error("Error in submitBulkQuoteRequest:", error.message);
        res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again.",
            error: error.message,
        });
    }
};

/**
 * Handle Car Specific Quote Request
 */
export const submitCarQuoteRequest = async (req, res) => {
    try {
        const { name, email, phone, carName, message, bookingData } = req.body;

        if (!name || !email || !carName) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and car name are required.",
            });
        }

        // Save as a lead in the Bookings collection
        try {
            const nameParts = name.trim().split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "Customer";

            const pickupDate = bookingData?.pickupDate ? new Date(bookingData.pickupDate) : new Date();
            const pickupTime = bookingData?.pickupTime || "00:00";

            const newLead = new Booking({
                pickup: { address: bookingData?.pickup || "N/A" },
                dropoff: { address: bookingData?.dropoff || "" },
                pickupDate: pickupDate,
                pickupTime: pickupTime,
                serviceType: bookingData?.serviceType || "oneway",
                journeyInfo: {
                    hours: bookingData?.hours ? Number(bookingData.hours) : undefined
                },
                vehicleDetails: {
                    categoryName: carName,
                },
                passengerDetails: {
                    firstName,
                    lastName,
                    email,
                    phone: phone || "",
                },
                specialInstructions: message || "",
                status: "pending",
                paymentStatus: "pending"
            });

            await newLead.save();
        } catch (dbError) {
            console.error("Error saving lead to database:", dbError);
        }

        // Send emails (to user and admin)
        const result = await sendCarQuoteEmails({
            name,
            email,
            phone,
            carName,
            message,
            bookingData,
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send quote request.",
            });
        }

        res.status(200).json({
            success: true,
            message: "Quote request sent successfully! We will contact you shortly.",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Something went wrong.",
            error: error.message,
        });
    }
};
/**
 * Get all contact leads (Admin)
 */
export const getContactLeads = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        let query = {};
        if (req.query.search) {
            query = {
                $or: [
                    { name: { $regex: req.query.search, $options: "i" } },
                    { email: { $regex: req.query.search, $options: "i" } },
                    { phone: { $regex: req.query.search, $options: "i" } },
                ]
            };
        }

        const leads = await ContactLead.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ContactLead.countDocuments(query);

        res.status(200).json({
            success: true,
            data: leads,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error in getContactLeads:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * Delete a contact lead (Admin)
 */
export const deleteContactLead = async (req, res) => {
    try {
        const lead = await ContactLead.findById(req.params.id);
        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        await lead.deleteOne();
        res.status(200).json({ success: true, message: "Lead deleted successfully" });
    } catch (error) {
        console.error("Error in deleteContactLead:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

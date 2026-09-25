import express from "express";
import { submitContactInquiry, submitBulkQuoteRequest, submitCarQuoteRequest, getContactLeads, deleteContactLead } from "../controllers/contactController.js";
import { protectAdmin } from "../middlewares/adminAuth.js";

const router = express.Router();

// POST /api/contact        — contact us form inquiry
router.post("/", submitContactInquiry);

// POST /api/contact/quote  — bulk/corporate booking quote request
router.post("/quote", submitBulkQuoteRequest);

// POST /api/contact/car-quote — individual car quote request
router.post("/car-quote", submitCarQuoteRequest);

// GET /api/contact/leads — get all contact leads (Admin)
router.get("/leads", protectAdmin, getContactLeads);

// DELETE /api/contact/leads/:id — delete a contact lead (Admin)
router.delete("/leads/:id", protectAdmin, deleteContactLead);

export default router;

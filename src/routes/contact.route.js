import express from "express";
import { submitContactInquiry, submitBulkQuoteRequest, submitCarQuoteRequest } from "../controllers/contactController.js";

const router = express.Router();

// POST /api/contact        — contact us form inquiry
router.post("/", submitContactInquiry);

// POST /api/contact/quote  — bulk/corporate booking quote request
router.post("/quote", submitBulkQuoteRequest);

// POST /api/contact/car-quote — individual car quote request
router.post("/car-quote", submitCarQuoteRequest);

export default router;

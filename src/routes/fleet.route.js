import express from "express";
import {
    createFleet,
    getAllFleet,
    getFleetBySlug,
    getAllFleetAdmin,
    getFleetById,
    updateFleet,
    deleteFleet,
} from "../controllers/fleetController.js";
import { upload } from "../middlewares/multer.js";
import { protectAdmin } from "../middlewares/adminAuth.js";

const router = express.Router();

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// Get all fleet entries (paginated)
router.get("/", getAllFleet);

// Get single fleet entry by slug
router.get("/:slug", getFleetBySlug);

// ─── ADMIN ROUTES (require valid admin JWT) ───────────────────────────────────

// Get all fleet entries for admin
router.get("/admin/all", protectAdmin, getAllFleetAdmin);

// Get fleet entry by ID for admin
router.get("/admin/:id", protectAdmin, getFleetById);

// Create new fleet entry
router.post(
    "/",
    protectAdmin,
    upload.fields([
        { name: "heroImage", maxCount: 1 },
        { name: "gallery", maxCount: 10 },
    ]),
    createFleet
);

// Update fleet entry (supports file upload)
router.put(
    "/:id",
    protectAdmin,
    upload.fields([
        { name: "heroImage", maxCount: 1 },
        { name: "gallery", maxCount: 10 },
    ]),
    updateFleet
);

// Delete fleet entry
router.delete("/:id", protectAdmin, deleteFleet);

export default router;

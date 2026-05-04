import express from "express";
import {
    createService,
    getAllServices,
    getAllServicesAdmin,
    getServiceBySlug,
    getServiceById,
    updateService,
    deleteService,
    getNavMenu,
} from "../controllers/serviceController.js";
import { upload } from "../middlewares/multer.js";
import { protectAdmin } from "../middlewares/adminAuth.js";

const router = express.Router();

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// Get nav menu structure (must be before /:slug)
router.get("/nav-menu", getNavMenu);

// ─── ADMIN ROUTES (require valid admin JWT) ───────────────────────────────────

// Get ALL services (including inactive) for admin panel — must be before /:slug
router.get("/admin/all", protectAdmin, getAllServicesAdmin);

// Get single service by ID (for admin edit form) — must be before /:slug
router.get("/admin/:id", protectAdmin, getServiceById);

// Create new service
router.post("/", protectAdmin, upload.single("image"), createService);

// Update service
router.put("/:id", protectAdmin, upload.single("image"), updateService);

// Delete service
router.delete("/:id", protectAdmin, deleteService);

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// Get all services (paginated)
router.get("/", getAllServices);

// Get single service by slug
router.get("/:slug", getServiceBySlug);

export default router;

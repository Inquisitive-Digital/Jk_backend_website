import express from "express";
import {
    createBlog,
    getAllBlogs,
    getBlogBySlug,
    getBlogById,
    updateBlog,
    deleteBlog,
    getAllBlogsAdmin,
} from "../controllers/blogController.js";
import { upload } from "../middlewares/multer.js";
import { protectAdmin } from "../middlewares/adminAuth.js";

const router = express.Router();

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// Get all blogs (paginated, active only)
router.get("/", getAllBlogs);

// ─── ADMIN ROUTES (require valid admin JWT) ───────────────────────────────────

// Get ALL blogs for admin list (includes inactive)
router.get("/admin/all", protectAdmin, getAllBlogsAdmin);

// Get single blog by ID for admin edit
router.get("/admin/:id", protectAdmin, getBlogById);

// Create blog (with optional heroImage upload)
router.post(
    "/",
    protectAdmin,
    upload.fields([{ name: "heroImage", maxCount: 1 }]),
    createBlog
);

// Update blog (with optional heroImage upload)
router.put(
    "/:id",
    protectAdmin,
    upload.fields([{ name: "heroImage", maxCount: 1 }]),
    updateBlog
);

// Delete blog
router.delete("/:id", protectAdmin, deleteBlog);

// Get blog by slug (must be last to avoid catching /admin/all)
router.get("/:slug", getBlogBySlug);

export default router;

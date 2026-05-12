import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";

// Allowed origins (must match server.js corsOptions)
const ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5173",
    "https://jkexecutivechauffeurs.com",
    "https://www.jkexecutivechauffeurs.com",
    "http://jkexecutivechauffeurs.com/",
    "http://dev.jkexecutivechauffeurs.com",
];

/**
 * Global Rate Limiter
 * - Allows 1000 requests per 15-minute window per IP
 * - Admins with a valid JWT token are completely exempt from rate limiting
 * - Returns 429 with a friendly JSON message if limit is exceeded
 * - Ensures CORS headers are present even on rate-limit responses
 */
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,                 // max requests per window per IP for regular users
    standardHeaders: true,     // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,      // Disable X-RateLimit-* legacy headers

    // Skip rate limiting entirely for logged-in admins
    skip: (req) => {
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.split(" ")[1];
                const decoded = jwt.verify(
                    token,
                    process.env.JWT_SECRET || "jk-admin-secret-key-2026"
                );
                // If token is valid and has an id, it's a valid admin — skip limiting
                return !!decoded?.id;
            }
        } catch {
            // Invalid/expired token — do NOT skip, apply the limit normally
        }
        return false;
    },

    message: {
        success: false,
        message: "Too many requests from this IP. Please try again after 15 minutes.",
    },

    // IMPORTANT: manually set CORS headers so the browser can read this error response.
    // Without this, the browser shows a misleading "CORS policy" error instead of 429.
    handler: (req, res, next, options) => {
        const origin = req.headers.origin;
        if (origin && ALLOWED_ORIGINS.includes(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
        }
        res.status(429).json(options.message);
    },
});

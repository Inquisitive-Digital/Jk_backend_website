import dotenv from "dotenv";
dotenv.config(); 

console.log("Environment Variables Loaded:");
console.log("MONGO_URI exists:", process.env.MONGO_URI ? "YES" : "NO");
console.log("PORT from env:", process.env.PORT);
console.log("Current Directory (cwd):", process.cwd());

import express from "express";
import cors from "cors";
import { errorMiddleware } from "./src/middlewares/error.js";
import { apiRateLimiter } from "./src/middlewares/rateLimiter.js";
import connectDB from "./src/db/database.js";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Routes
import vehicleRoutes from "./src/routes/vehical.route.js";
import pricingRoutes from "./src/routes/pricing.route.js";
import airportRoutes from "./src/routes/airport.route.js";
import airportPricingRoutes from "./src/routes/airportPricing.route.js";
import bookingRoutes from "./src/routes/booking.route.js";
import paymentRoutes from "./src/routes/payment.route.js";
import adminRoutes from "./src/routes/admin.route.js";
import serviceRoutes from "./src/routes/service.route.js";
import fleetRoutes from "./src/routes/fleet.route.js";
import eventRoutes from "./src/routes/event.route.js";
import blogRoutes from "./src/routes/blog.route.js";
import contactRoutes from "./src/routes/contact.route.js";
import faqRoutes from "./src/routes/faq.route.js";
import Blog from "./src/models/blog.model.js";
const app = express();
const PORT = process.env.PORT || 5000;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware setup
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5005", "http://127.0.0.1:5173", "https://jk-frontend-nine.vercel.app", "https://jkexecutivechauffeurs.com", "https://www.jkexecutivechauffeurs.com", "http://jkexecutivechauffeurs.com/"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// rate limiter 
app.use(apiRateLimiter);

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// Routes setup
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/airports", airportRoutes);
app.use("/api/airport-pricing", airportPricingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/faqs", faqRoutes);


// ================================================================
// SSR ROUTES — Meta tag injection for SEO (Google indexing)
// Must come BEFORE static file serving
// ================================================================

const SITE_URL = "https://www.jkexecutivechauffeurs.com";

// Helper: read built index.html from dist/
const getIndexTemplate = () => {
  const indexPath = path.join(__dirname, "dist", "index.html");
  return fs.readFileSync(indexPath, "utf-8");
};

// Helper: inject meta tags and optional preload script into HTML
const injectMeta = (template, metaTags, preloadScript = "") => {
  return template
    .replace(/<title>[^<]*<\/title>/, metaTags)
    .replace("</head>", `${preloadScript}</head>`);
};

// SSR: /blog/:slug — Blog detail page (most important for Google indexing)
app.get("/blog/:slug", async (req, res, next) => {
  try {
    const { slug } = req.params;

    // Skip API-like slugs
    if (slug.startsWith("api")) return next();

    const blog = await Blog.findOne({ slug, isActive: true }).lean();
    if (!blog) return next(); // Not found → fall through to SPA

    const template = getIndexTemplate();

    const seoTitle = blog.seoTitle || blog.title;
    const rawIntro = blog.intro ? blog.intro.replace(/<[^>]+>/g, "").slice(0, 160) : "";
    const seoDesc = blog.seoDescription || blog.excerpt || rawIntro;
    const heroImg = blog.heroImageUrl || blog.heroImage?.url || `${SITE_URL}/logo.png`;

    const metaTags = `
      <title>${seoTitle}</title>
      <meta name="description" content="${seoDesc.replace(/"/g, "&quot;")}" />
      <meta property="og:title" content="${seoTitle.replace(/"/g, "&quot;")}" />
      <meta property="og:description" content="${seoDesc.replace(/"/g, "&quot;")}" />
      <meta property="og:image" content="${heroImg}" />
      <meta property="og:url" content="${SITE_URL}/blog/${slug}" />
      <meta property="og:type" content="article" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${seoTitle.replace(/"/g, "&quot;")}" />
      <meta name="twitter:description" content="${seoDesc.replace(/"/g, "&quot;")}" />
      <link rel="canonical" href="${SITE_URL}/blog/${slug}" />`;

    // Preload blog data → React won't need to re-fetch on first load
    const safeData = JSON.stringify(blog).replace(/<\/script>/gi, "<\\/script>");
    const preloadScript = `<script>window.__BLOG_DATA__ = ${safeData};</script>`;

    const finalHtml = injectMeta(template, metaTags, preloadScript);
    return res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);

  } catch (err) {
    console.error("SSR error for /blog/:slug →", err.message);
    return next(); // On error, fall through to SPA (site still works)
  }
});

// SSR: /blog — Blog listing page
app.get("/blog", async (req, res, next) => {
  try {
    const template = getIndexTemplate();
    const metaTags = `
      <title>Chauffeur Blog | JK Executive Chauffeurs</title>
      <meta name="description" content="Expert insights on luxury chauffeur services, airport transfers, and premium travel in the UK. Read our latest articles." />
      <meta property="og:title" content="Chauffeur Blog | JK Executive Chauffeurs" />
      <meta property="og:description" content="Expert insights on luxury chauffeur services, airport transfers, and premium travel in the UK." />
      <meta property="og:url" content="${SITE_URL}/blog" />
      <meta property="og:type" content="website" />
      <link rel="canonical" href="${SITE_URL}/blog" />`;

    const finalHtml = injectMeta(template, metaTags);
    return res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);

  } catch (err) {
    console.error("SSR error for /blog →", err.message);
    return next();
  }
});

// ================================================================
// END SSR ROUTES
// ================================================================


// React Frontend Static Files
app.use(express.static(path.join(__dirname, "dist")));


app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Dummy route to check if the server is running
// app.get("/", (req, res) => {
//   res.send("Hi, Welcome to the server!");
// });

// Error handling middleware
app.use(errorMiddleware);

// Connect to the database and start the server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is up and running on port http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  });


export default app;
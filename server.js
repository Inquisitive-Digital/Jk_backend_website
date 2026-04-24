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
import { Service } from "./src/models/service.model.js";
import Event from "./src/models/event.model.js";
import { Fleet } from "./src/models/fleet.model.js";
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

// Serve static files from uploads directory (Images)
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "1y" // Cache images for 1 year
}));


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
  let html = template;

  // 1. Remove any <title> that might be inside an HTML comment  <!-- ... <title>...</title> ... -->
  html = html.replace(/<!--[\s\S]*?<title>[^<]*<\/title>[\s\S]*?-->/g, "");

  // 2. Remove any remaining bare <title>...</title> tag
  html = html.replace(/<title>[^<]*<\/title>/, "");

  // 3. Inject the new meta tags (including <title>) + preload script right before </head>
  html = html.replace("</head>", `${metaTags}\n${preloadScript}</head>`);

  return html;
};

// SSR: / (Home Page)
app.get("/", async (req, res, next) => {
  try {
    const template = getIndexTemplate();
    const metaTags = `
      <title>Chauffeur Service in London | Travel In Style & Comfort | JK Executive</title>
      <meta name="description" content="Premium chauffeur services in London and across the UK. Professional drivers for airport transfers, business travel, and special events. Book your luxury ride today." />
      <meta property="og:title" content="Chauffeur Service in London | JK Executive Chauffeurs" />
      <meta property="og:description" content="Luxury chauffeur services for airport transfers, corporate travel and events in London." />
      <meta property="og:image" content="${SITE_URL}/logo.png" />
      <meta property="og:url" content="${SITE_URL}/" />
      <meta property="og:type" content="website" />
      <link rel="canonical" href="${SITE_URL}/" />`;

    const finalHtml = injectMeta(template, metaTags);
    return res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
  } catch (err) {
    return next();
  }
});

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

// SSR: /services/:slug — Service detail page
app.get("/services/:slug", async (req, res, next) => {
  try {
    const { slug } = req.params;
    const service = await Service.findOne({ slug, isActive: true }).lean();
    if (!service) return next();

    const template = getIndexTemplate();
    const seoTitle = service.meta_title || service.title;
    const seoDesc = service.meta_description || service.description || "";
    const imgUrl = service.image?.url || `${SITE_URL}/logo.png`;

    const metaTags = `
      <title>${seoTitle}</title>
      <meta name="description" content="${seoDesc.replace(/"/g, "&quot;")}" />
      <meta property="og:title" content="${seoTitle.replace(/"/g, "&quot;")}" />
      <meta property="og:description" content="${seoDesc.replace(/"/g, "&quot;")}" />
      <meta property="og:image" content="${imgUrl}" />
      <meta property="og:url" content="${SITE_URL}/services/${slug}" />
      <link rel="canonical" href="${SITE_URL}/services/${slug}" />`;

    const finalHtml = injectMeta(template, metaTags);
    return res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
  } catch (err) {
    console.error("SSR error for /services/:slug →", err.message);
    return next();
  }
});

// SSR: /events/:slug — Event detail page
app.get("/events/:slug", async (req, res, next) => {
  try {
    const { slug } = req.params;
    const event = await Event.findOne({ slug, isActive: true }).lean();
    if (!event) return next();

    const template = getIndexTemplate();
    const seoTitle = event.seoTitle || event.title;
    const seoDesc = event.seoDescription || event.description || "";
    const imgUrl = event.heroImageUrl || event.heroImage?.url || `${SITE_URL}/logo.png`;

    const metaTags = `
      <title>${seoTitle}</title>
      <meta name="description" content="${seoDesc.replace(/"/g, "&quot;")}" />
      <meta property="og:title" content="${seoTitle.replace(/"/g, "&quot;")}" />
      <meta property="og:description" content="${seoDesc.replace(/"/g, "&quot;")}" />
      <meta property="og:image" content="${imgUrl}" />
      <meta property="og:url" content="${SITE_URL}/events/${slug}" />
      <link rel="canonical" href="${SITE_URL}/events/${slug}" />`;

    const finalHtml = injectMeta(template, metaTags);
    return res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
  } catch (err) {
    console.error("SSR error for /events/:slug →", err.message);
    return next();
  }
});

// SSR: /fleet — Fleet listing page
app.get("/fleet", async (req, res, next) => {
  try {
    const template = getIndexTemplate();
    const metaTags = `
      <title>Our Luxury Fleet | JK Executive Chauffeurs</title>
      <meta name="description" content="Explore our premium fleet of luxury vehicles, including Mercedes E-Class, S-Class, and V-Class, for your comfortable travel in London." />
      <meta property="og:title" content="Our Luxury Fleet | JK Executive Chauffeurs" />
      <meta property="og:description" content="Premium vehicles for airport transfers and corporate travel in London." />
      <meta property="og:url" content="${SITE_URL}/fleet" />
      <link rel="canonical" href="${SITE_URL}/fleet" />`;

    const finalHtml = injectMeta(template, metaTags);
    return res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
  } catch (err) {
    return next();
  }
});

// SSR: /fleet/:slug — Fleet detail page
app.get("/fleet/:slug", async (req, res, next) => {
  try {
    const { slug } = req.params;
    const vehicle = await Fleet.findOne({ slug, isActive: true }).lean();
    if (!vehicle) return next();

    const template = getIndexTemplate();
    const seoTitle = vehicle.seoTitle || vehicle.meta_title || vehicle.title;
    const seoDesc = vehicle.seoDescription || vehicle.meta_description || vehicle.description || "";
    const imgUrl = vehicle.heroImage?.url || `${SITE_URL}/logo.png`;

    const metaTags = `
      <title>${seoTitle}</title>
      <meta name="description" content="${seoDesc.replace(/"/g, "&quot;")}" />
      <meta property="og:title" content="${seoTitle.replace(/"/g, "&quot;")}" />
      <meta property="og:description" content="${seoDesc.replace(/"/g, "&quot;")}" />
      <meta property="og:image" content="${imgUrl}" />
      <meta property="og:url" content="${SITE_URL}/fleet/${slug}" />
      <link rel="canonical" href="${SITE_URL}/fleet/${slug}" />`;

    const finalHtml = injectMeta(template, metaTags);
    return res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
  } catch (err) {
    console.error("SSR error for /fleet/:slug →", err.message);
    return next();
  }
});

// SSR: Static Informational Pages
const staticPages = [
  { path: "/about", title: "About Us | JK Executive Chauffeurs", desc: "Learn more about our premium chauffeur services and our commitment to luxury and professional travel." },
  { path: "/contact", title: "Contact Us | Book Your Luxury Chauffeur", desc: "Get in touch with us for bookings, inquiries, and custom travel arrangements in London and the UK." },
  { path: "/terms-and-conditions", title: "Terms & Conditions | JK Executive Chauffeurs", desc: "Our terms of service and booking conditions." },
  { path: "/privacy-policy", title: "Privacy Policy | Your Data Security", desc: "How we protect and manage your personal information." },
  { path: "/gdpr-policy", title: "GDPR Policy | Data Protection Compliance", desc: "Our compliance with General Data Protection Regulation." }
];

staticPages.forEach(page => {
  app.get(page.path, async (req, res, next) => {
    try {
      const template = getIndexTemplate();
      const metaTags = `
        <title>${page.title}</title>
        <meta name="description" content="${page.desc}" />
        <meta property="og:title" content="${page.title}" />
        <meta property="og:description" content="${page.desc}" />
        <meta property="og:url" content="${SITE_URL}${page.path}" />
        <link rel="canonical" href="${SITE_URL}${page.path}" />`;

      const finalHtml = injectMeta(template, metaTags);
      return res.status(200).set({ "Content-Type": "text/html" }).end(finalHtml);
    } catch (err) {
      return next();
    }
  });
});

// ================================================================
// END SSR ROUTES
// ================================================================

// React Frontend Static Files (JS, CSS, Images from dist/)
app.use(express.static(path.join(__dirname, "dist"), {
  maxAge: "1y", // Cache static assets for 1 year
  setHeaders: (res, path) => {
    // DO NOT cache the dynamic index.html so updates are visible immediately!
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));


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
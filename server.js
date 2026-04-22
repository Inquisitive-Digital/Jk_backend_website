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
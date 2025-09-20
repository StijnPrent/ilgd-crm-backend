/**
 * Initializes the Express application, configures middleware and routes, and
 * starts the HTTP server. The configured `app` instance is exported for
 * testing or serverless environments.
 */
import "./config/timezone";
import "reflect-metadata";
import "./container";
import express from "express";
import userRoute from "./routes/UserRoute";
import chatterRoute from "./routes/ChatterRoute";
import employeeEarningRoute from "./routes/EmployeeEarningRoute";
import shiftRoute from "./routes/ShiftRoute";
import modelRoute from "./routes/ModelRoute";
import revenueRoute from "./routes/RevenueRoute";
import commissionRoute from "./routes/CommissionRoute";
import analyticsRoute from "./routes/AnalyticsRoute";

import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3002;
process.env.TZ = 'Europe/Amsterdam';

// CORS
const allowedOrigins = [
    "http://localhost:3000",
    "https://dashboardilgd.com",
    "https://www.dashboardilgd.com",
];

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Check if the origin is in the allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Allow Vercel preview URLs
        if (origin.endsWith("-ilgd-crm.vercel.app")) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/users", userRoute);
app.use("/api/chatters", chatterRoute);
app.use("/api/employee-earnings", employeeEarningRoute);
app.use("/api/shifts", shiftRoute);
app.use("/api/models", modelRoute);
app.use("/api/revenue", revenueRoute);
app.use("/api/commissions", commissionRoute);
app.use("/api/analytics", analyticsRoute);

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`✅ Local API on http://localhost:${PORT}`));

export default app;

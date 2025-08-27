import "reflect-metadata";
import express from "express";
import cors from "cors";
import userRoute from "./routes/UserRoute";
import chatterRoute from "./routes/ChatterRoute";
import employeeEarningRoute from "./routes/EmployeeEarningRoute";
import shiftRoute from "./routes/ShiftRoute";

const app = express();

// CORS FIRST
const allowedOrigins: (string | RegExp)[] = [
    "http://localhost:3000",
    "https://dashboardilgd.com",
    "https://www.dashboardilgd.com",
    // /\.vercel\.app$/, // <- uncomment if you want to allow Vercel preview URLs
];

const corsOptions: cors.CorsOptions = {
    origin(origin, cb) {
        // allow Postman/cURL (no Origin)
        if (!origin) return cb(null, true);

        const ok = allowedOrigins.some((o) =>
            o instanceof RegExp ? o.test(origin) : o === origin
        );
        return ok ? cb(null, true) : cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
    // credentials: true, // only if you use cookies
};

// 1) Apply CORS to all requests
app.use(cors(corsOptions));

// 2) Handle preflight with a RegExp path (NOT "*")
app.options(/.*/, cors(corsOptions));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Your routes keep the /api prefix
app.use("/api/users", userRoute);
app.use("/api/chatters", chatterRoute);
app.use("/api/employee-earnings", employeeEarningRoute);
app.use("/api/shifts", shiftRoute);

// simple health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

export default app;

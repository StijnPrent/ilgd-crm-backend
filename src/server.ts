import "reflect-metadata";
import "./container";
import express from "express";
import userRoute from "./routes/UserRoute";
import chatterRoute from "./routes/ChatterRoute";
import employeeEarningRoute from "./routes/EmployeeEarningRoute";
import shiftRoute from "./routes/ShiftRoute";

const app = express();
const PORT = process.env.PORT || 3002;

// CORS

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/users", userRoute);
app.use("/api/chatters", chatterRoute);
app.use("/api/employee-earnings", employeeEarningRoute);
app.use("/api/shifts", shiftRoute);

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`✅ Local API on http://localhost:${PORT}`));

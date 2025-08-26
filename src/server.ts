import "reflect-metadata";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import userRoute from "./routes/UserRoute";

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET","POST","PUT","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization"]
}));

app.use('api/user', userRoute);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = createServer(app);

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
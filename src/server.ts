import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`✅ Local API on http://localhost:${PORT}`));

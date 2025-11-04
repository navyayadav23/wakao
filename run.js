// run.js
import express from "express";

const app = express();
const PORT = process.env.PORT || 10000;

// Define a route that runs your script
app.get("/run", async (req, res) => {
    try {
        console.log("Received trigger → running index.js...");
        // Dynamically import your Playwright script
        await import("./index.js");
        res.status(200).send("✅ Script executed successfully!");
    } catch (err) {
        console.error("Error running script:", err);
        res.status(500).send("❌ Error: " + err.message);
    }
});

// Root endpoint (optional)
app.get("/", (req, res) => {
    res.send("Render server is live. Visit /run to trigger the script.");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

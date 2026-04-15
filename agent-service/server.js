require("dotenv").config();

const express = require("express");
const cors = require("cors");
const agentRoutes = require("./routes/agent.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Agent service is running"
  });
});

app.use("/agent", agentRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Agent running on http://0.0.0.0:${PORT}`);
});
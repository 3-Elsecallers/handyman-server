import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 8083;

app.use(cors());
app.use(express.json());

app.listen(PORT, () => console.log(`Listening on port: ${PORT}`));
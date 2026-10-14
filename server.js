import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pino from "pino";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import * as baileys from "@whiskeysockets/baileys";

const app = express();
const PORT = process.env.PORT || 3000;

const makeWASocket =
  typeof baileys.default === "function"
    ? baileys.default
    : baileys.makeWASocket;

const sessions = new Map();
const pending = new Set();

const SESSION_DIR =
  process.env.SESSION_DIR || "./sessions";

fs.mkdirSync(SESSION_DIR, { recursive: true });

app.use(cors({
  origin: [
    "https://hirushan1234567.github.io"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "10kb" }));

app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get("/", (_req, res) => {
  res.json({
    name: "SHAN MINI BOT V1",
    status: "online",
    service: "Pair API"
  });
});

app.post("/api/pair", async (req, res) => {
  let phone = String(req.body?.phone || "")
    .replace(/\D/g, "");

  if (phone.length < 8 || phone.length > 15) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid international phone number."
    });
  }

  const sessionId = crypto
    .createHash("sha256")
    .update(phone)
    .digest("hex")
    .slice(0, 24);

  if (pending.has(sessionId) || sessions.has(sessionId)) {
    return res.status(409).json({
      success: false,
      message: "A session already exists for this number."
    });
  }

  pending.add(sessionId);

  let sock;

  try {
    const sessionPath = path.join(
      SESSION_DIR,
      sessionId
    );

    const { state, saveCreds } =
      await baileys.useMultiFileAuthState(sessionPath);

    if (state.creds.registered) {
      return res.status(409).json({
        success: false,
        message: "This number already has a registered session."
      });
    }

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["SHAN MINI BOT", "Chrome", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sessions.set(sessionId, sock);

    const code = await sock.requestPairingCode(phone);

    return res.json({
      success: true,
      code,
      message: "Pairing code generated successfully."
    });

  } catch (error) {
    if (sock) {
      try {
        sock.end(undefined);
      } catch {}
    }

    sessions.delete(sessionId);

    console.error(
      "Pairing request failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Could not generate a pairing code. Please try again."
    });

  } finally {
    pending.delete(sessionId);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `SHAN MINI BOT Pair API listening on port ${PORT}`
  );
});

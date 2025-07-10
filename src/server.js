// Disable ytdl-core update checks
process.env.YTDL_NO_UPDATE = "1";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import ytdl from "@distube/ytdl-core";
import rateLimit from "express-rate-limit";
// import fs from "fs"; // Uncomment if you want to load cookies from a file

const app = express();
const PORT = process.env.PORT || 8080;

// Trust first proxy (for correct IP detection behind load balancers)
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiter for download endpoint
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per window
  message: {
    success: false,
    error: "Too many download requests from this IP, please try again later.",
  },
});

app.get("/", (req, res) => {
  res.send("YouTube Downloader Backend is running!");
});

app.post("/api/download", downloadLimiter, async (req, res) => {
  const { url, formatType = "mp4" } = req.body;

  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({
      success: false,
      error: "Invalid or missing YouTube URL provided.",
    });
  }

  try {
    // === Proxy and/or Cookies Support (Uncomment and configure as needed) ===
    // const agent = ytdl.createProxyAgent({ uri: "http://my.proxy.server:8080" });
    // const cookies = [
    //   { name: "cookie1", value: "COOKIE1_HERE" },
    //   // ...more cookies as needed
    // ];
    // const agent = ytdl.createAgent(cookies); // For cookies only
    // Or combine proxy and cookies:
    // const agent = ytdl.createProxyAgent({ uri: "http://my.proxy.server:8080" }, cookies);

    // To load cookies from a file (cookies.json):
    // const cookies = JSON.parse(fs.readFileSync("cookies.json"));
    // const agent = ytdl.createAgent(cookies);

    // Use agent in getInfo if you set it up above:
    // const info = await ytdl.getInfo(url, { agent });

    // Default: no proxy/cookies
    const info = await ytdl.getInfo(url);

    const videoTitle = info.videoDetails.title
      .replace(/[^\x00-\x7F]/g, "")
      .replace(/[\\/:*?"<>|]/g, "");

    if (formatType === "mp3") {
      const audioFormat = ytdl.chooseFormat(info.formats, {
        filter: "audioonly",
        quality: "highestaudio",
      });
      if (!audioFormat) {
        return res.status(404).json({
          success: false,
          error: "No audio-only format found.",
        });
      }
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${videoTitle}.mp3"`
      );
      res.setHeader("Content-Type", "audio/mpeg");
      ytdl(url, { format: audioFormat }).pipe(res);
    } else {
      let finalFormat = ytdl.chooseFormat(info.formats, {
        quality: "highest",
        filter: (format) =>
          format.hasVideo && format.hasAudio && format.container === "mp4",
      });
      if (!finalFormat) {
        finalFormat = ytdl.chooseFormat(info.formats, {
          quality: "highestvideo",
          filter: (format) => format.container === "mp4",
        });
      }
      if (!finalFormat) {
        return res.status(404).json({
          success: false,
          error: "No downloadable MP4 format found.",
        });
      }
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${videoTitle}.mp4"`
      );
      res.setHeader("Content-Type", "video/mp4");
      ytdl(url, { format: finalFormat }).pipe(res);
    }
  } catch (error) {
    // Handle YouTube rate limiting
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: "YouTube is rate-limiting requests. Please try again later.",
      });
    }
    console.error("Error in API route:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});

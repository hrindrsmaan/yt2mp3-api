// Disable ytdl-core update checks
process.env.YTDL_NO_UPDATE = "1";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import ytdl from "@distube/ytdl-core";
import rateLimit from "express-rate-limit";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Dispatcher } from "undici";

const app = express();
const PORT = process.env.PORT || 8080;

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors());
app.use(express.json());

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: "Too many download requests from this IP, please try again later.",
  },
});

// Oxylabs Proxy Configuration
const oxylabsUsername = "hxmaan_fPQba"; // replace with your Oxylabs username
const oxylabsPassword = "H+r1ndersingh"; // replace with your Oxylabs password
const proxyUrl = `http://${oxylabsUsername}:${oxylabsPassword}@pr.oxylabs.io:7777`;
const agent = new HttpsProxyAgent(proxyUrl);
const proxyClient = new Dispatcher({
  connect(origin, opts, handler) {
    return agent;
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
    const info = await ytdl.getInfo(url, {
      client: proxyClient,
    });

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
      ytdl(url, {
        format: audioFormat,
        client: proxyClient,
      }).pipe(res);
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
      ytdl(url, {
        format: finalFormat,
        client: proxyClient,
      }).pipe(res);
    }
  } catch (error) {
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

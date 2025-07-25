import express from "express";
import cors from "cors";
import helmet from "helmet";
import ytdl from "@distube/ytdl-core";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 8080;

const oxylabsUsername = "hxmaan_fPQba";
const oxylabsPassword = "H+r1ndersingh";

if (!oxylabsUsername || !oxylabsPassword) {
  throw new Error("Proxy credentials are not set in environment variables.");
}

//const proxyUrl = `http://customer-${oxylabsUsername}-sessid-0469279611-sesstime-10:${oxylabsPassword}@pr.oxylabs.io:7777`;

//const proxyUrl = `http://customer-${oxylabsUsername}:${oxylabsPassword}@pr.oxylabs.io:7777`;

//const proxyAgent = ytdl.createProxyAgent({ uri: proxyUrl });

app.use(helmet());
app.use(cors());
app.use(express.json());

// const downloadLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: {
//     success: false,
//     error: "Too many download requests from this IP, please try again later.",
//   },
// });

app.get("/", (req, res) => {
  res.send("YouTube Downloader Backend is running!");
});

app.post("/api/download", async (req, res) => {
  const { url, formatType = "mp4" } = req.body;

  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({
      success: false,
      error: "Invalid or missing YouTube URL provided.",
    });
  }

  try {
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
      ytdl(url, {
        format: audioFormat,
        client: proxyAgent,
      }).pipe(res);
    } else {
      // let finalFormat = ytdl.chooseFormat(info.formats, {
      //   quality: "highest",
      //   filter: (format) =>
      //     format.hasVideo && format.hasAudio && format.container === "mp4",
      // });
      // if (!finalFormat) {
      //   finalFormat = ytdl.chooseFormat(info.formats, {
      //     quality: "highestvideo",
      //     filter: (format) => format.container === "mp4",
      //   });
      // }
      // if (!finalFormat) {
      //   return res.status(404).json({
      //     success: false,
      //     error: "No downloadable MP4 format found.",
      //   });
      // }
      res.setHeader("Content-Disposition", `attachment; filename="video.mp4"`);
      res.setHeader("Content-Type", "video/mp4");
      ytdl(url).pipe(res);
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
      error: error.message || "Internal Server Error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});

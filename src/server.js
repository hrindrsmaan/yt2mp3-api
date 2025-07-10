import express from "express";
import cors from "cors";
import helmet from "helmet";
import ytdl from "@distube/ytdl-core";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());

app.use(cors());

app.use(express.json());

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
    const commonReqOpts = {
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/114.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: `https://www.youtube.com/watch?v=${ytdl.getVideoID(url)}`,
        },
      },
    };
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
        return res
          .status(404)
          .json({ success: false, error: "No audio-only format found." });
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
        return res
          .status(404)
          .json({ success: false, error: "No downloadable MP4 format found." });
      }
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${videoTitle}.mp4"`
      );
      res.setHeader("Content-Type", "video/mp4");
      ytdl(url, { format: finalFormat }).pipe(res);
    }
  } catch (error) {
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

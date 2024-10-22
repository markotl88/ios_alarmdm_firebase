/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const Parser = require("rss-parser");
const parser = new Parser();

// RSS feed URL
const RSS_FEED_URL = "https://podcast.daskoimladja.com/feed.xml";

// Cloud Function to fetch and paginate podcasts with Show filtering
exports.getPodcasts = functions.https.onRequest(async (req, res) => {
  try {
    // Parse the RSS feed
    const feed = await parser.parseURL(RSS_FEED_URL);

    // Parse the query parameters (in snake_case)
    const queryDate = req.query.date ? new Date(req.query.date) : null;
    const isBefore = req.query.is_before === "true"; // boolean flag
    const showQuery = req.query.show; // Allow filtering by show

    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const pageSize = 100; // Set to 100 items per page
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    // Convert feed.items to the structure of the Podcast model with 'Show' filtering
    let podcasts = feed.items.map((item) => {
      try {
        const podcastUrl = item.enclosure ? item.enclosure.url : "";
        const title = item.title || "";
        const fileName = podcastUrl ? podcastUrl.split("/").pop().toLowerCase() : "";

        let showType = "Unknown";
        let withMusic = true;

        // Logic to set showType and withMusic based on fileName and title
        if (fileName.endsWith("bm.mp3")) {
          showType = "alarmSaDaskomIMladjom";
          withMusic = false;
        } else if (fileName.toLowerCase().includes("-ljp") || fileName.toLowerCase().includes("2020-09-17-125_64") ||
          fileName.toLowerCase().includes("2020-09-17-124_64")) {
          showType = "ljudiIzPodzemlja";
          withMusic = false;
        } else if (fileName.toLowerCase().includes("-nio")) {
          showType = "naIviciOfsajda";
          withMusic = false;
        } else if (fileName.toLowerCase().includes("rastrojavanje")) {
          showType = "rastrojavanje";
          withMusic = false;
        } else if (fileName.toLowerCase().includes("večernja_škola") || fileName.toLowerCase().includes("vecernja_skola")) {
          showType = "vecernjaSkolaRokenrola";
          withMusic = false;
        } else if (fileName.toLowerCase().includes("sportski_pozdrav") || title.toLowerCase().includes("sportski pozdrav")) {
          showType = "sportskiPozdrav";
          withMusic = false;
        } else if (fileName.toLowerCase().startsWith("tople_ljucke_price") ||
        fileName.toLowerCase().includes("tople_ljucke_price")) {
          showType = "topleLjuckePrice";
          withMusic = false;
        } else if (fileName.toLowerCase().startsWith("msdss")) {
          showType = "mozemoSamoDaSeSlikamo";
          withMusic = false;
        } else if (fileName.toLowerCase().startsWith("pup") || title.includes("PUP")) {
          showType = "punaUstaPoezije";
          withMusic = false;
        } else if (fileName.toLowerCase().includes("unutrasnja_emigracija") ||
        title.toLowerCase().includes("unutrasnja_emigracija")) {
          showType = "unutrasnjaEmigracija";
          withMusic = true;
        } else {
          showType = "alarmSaDaskomIMladjom"; // Default to 'alarmSaDaskomIMladjom'
          withMusic = true;
        }

        return {
          id: item.guid || item.link || item.title || "", // Use title or other fields if guid is not available
          title: title,
          subtitle: item.contentSnippet || "", // This will serve as a subtitle
          timestamp: item.pubDate || "", // The published date
          podcastUrl: podcastUrl,
          duration: item.itunes && item.itunes.duration ? item.itunes.duration : "", // iTunes duration if available
          lengthInBytes: item.enclosure ? parseFloat(item.enclosure.length || 0) : 0, // The length in bytes from enclosure
          itunesDuration: item.itunes && item.itunes.duration ? item.itunes.duration : "", // iTunes duration
          fileUrl: podcastUrl,
          createdDate: item.pubDate ? new Date(item.pubDate) : null, // Convert pubDate to Date object
          showType: showType, // The derived Show type from the logic
          withMusic: withMusic, // Whether the podcast includes music or not
        };
      } catch (err) {
        console.error("Error processing podcast item:", err);
        return null; // Return null to filter out problematic items
      }
    }).filter((item) => item !== null); // Filter out null items

    // Filter podcasts by the show if the 'show' query parameter is provided
    if (showQuery) {
      podcasts = podcasts.filter((podcast) => podcast.showType === showQuery);
    }

    // Check if queryDate is a valid date
    if (queryDate && !isNaN(queryDate.getTime())) {
      // Filter podcasts based on the date and isBefore flag
      podcasts = podcasts.filter((podcast) => {
        if (podcast.createdDate) {
          if (isBefore) {
            return podcast.createdDate < queryDate;
          } else {
            return podcast.createdDate > queryDate;
          }
        }
        return false; // Exclude podcasts without a valid date
      });
    } else if (queryDate) {
      // If queryDate is invalid, return an error
      return res.status(400).json({
        error: "Invalid date format. Please use a valid ISO 8601 date format.",
      });
    }

    // Paginate the filtered podcast items
    const paginatedItems = podcasts.slice(start, end);

    // Return paginated items as JSON
    res.status(200).json({
      page: page,
      pageSize: pageSize,
      totalItems: podcasts.length,
      totalPages: Math.ceil(podcasts.length / pageSize),
      podcasts: paginatedItems,
    });
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    res.status(500).send("Error fetching podcast feed");
  }
});

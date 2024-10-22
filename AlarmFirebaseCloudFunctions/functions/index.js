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
const RSS_FEED_URL = "http://podcast.daskoimladja.com/feed.xml";

// Cloud Function to fetch and paginate podcasts
exports.getPodcasts = functions.https.onRequest(async (req, res) => {
  try {
    // Parse the RSS feed
    const feed = await parser.parseURL(RSS_FEED_URL);

    // Parse the query parameters (in snake_case)
    const queryDate = req.query.date ? new Date(req.query.date) : null;
    const isBefore = req.query.is_before === "true"; // boolean flag

    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const pageSize = 100; // Set to 100 items per page
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    // Convert feed.items to the structure of the Podcast model
    let podcasts = feed.items.map((item) => {
      return {
        // Use a unique field such as 'guid' or 'link' as the podcast ID
        id: item.guid || item.link || item.title || "", // Use title or other fields if guid is not available
        title: item.title || "",
        subtitle: item.contentSnippet || "", // This will serve as a subtitle
        timestamp: item.pubDate || "", // The published date
        podcastUrl: item.enclosure ? item.enclosure.url : "", // The podcast URL (from enclosure)
        duration: item.itunes && item.itunes.duration ? item.itunes.duration : "", // iTunes duration if available
        lengthInBytes: item.enclosure ? parseFloat(item.enclosure.length || 0) : 0, // The length in bytes from enclosure
        itunesDuration: item.itunes && item.itunes.duration ? item.itunes.duration : "", // iTunes duration
        fileUrl: item.enclosure ? item.enclosure.url : "", // Same as podcastUrl for this case
        createdDate: item.pubDate ? new Date(item.pubDate) : null, // Convert pubDate to Date object
      };
    });

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

    // If isBefore is false, return all filtered podcasts (no pagination)
    if (!isBefore) {
      return res.status(200).json({
        totalItems: podcasts.length,
        podcasts: podcasts,
      });
    }

    // Paginate the filtered podcast items if isBefore is true
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

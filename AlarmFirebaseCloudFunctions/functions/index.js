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

    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const pageSize = 100; // Set to 100 items per page
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const {v4: uuidv4} = require("uuid");

    // Convert feed.items to the structure of the Podcast model
    const podcasts = feed.items.map((item) => {
      return {
        id: uuidv4(), // Generate a unique ID for each podcast
        title: item.title || "",
        subtitle: item.contentSnippet || "", // This will serve as a subtitle
        timestamp: item.pubDate || "", // The published date
        podcastUrl: item.enclosure ? item.enclosure.url : "", // The podcast URL (from enclosure)
        duration: item.itunes && item.itunes.duration ? item.itunes.duration : "", // iTunes duration if available
        lengthInBytes: item.enclosure ? parseFloat(item.enclosure.length || 0) : 0, // The length in bytes from enclosure
        itunesDuration: item.itunes && item.itunes.duration ? item.itunes.duration : "", // iTunes duration
        fileUrl: item.enclosure ? item.enclosure.url : "", // Same as podcastUrl for this case
        isFavorite: false, // Not available from RSS feed
        isDownloaded: false, // Not available from RSS feed
        withMusic: false, // Not available from RSS feed
        createdDate: item.pubDate ? new Date(item.pubDate) : null, // Convert pubDate to Date object
      };
    });

    // Paginate the podcast items
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

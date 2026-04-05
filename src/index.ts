import "dotenv/config.js";
import * as cheerio from "cheerio";
import { parseListingPage, parseListingCards, matchesSearchCriteria, type JobListing } from "./trigger/gotfriends-scraper/parse-listing.js";
import {
  getExistingJobIds,
  appendJobListings,
  ensureSheetHeaders,
  formatSheet,
} from "./trigger/gotfriends-scraper/google-sheets.js";

// Search terms in Hebrew and English
const SEARCH_TERMS = [
  "מנהל מוצר",
];

// Haifa and surrounding areas
const LOCATION_KEYWORDS = [
  "חיפה והצפון",
];

async function scrapeGotFriendsJobs() {
  console.log("🚀 Starting GotFriends job scraper...");

  // Validate environment variables
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId || !serviceAccountEmail || !privateKey) {
    throw new Error(
      "Missing required env vars: GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY"
    );
  }

  const sheetsConfig = { sheetId, serviceAccountEmail, privateKey };

  // Ensure sheet is initialized
  await ensureSheetHeaders(sheetsConfig);

  // Get existing job IDs to avoid duplicates
  const existingIds = await getExistingJobIds(sheetsConfig);
  console.log(`📋 Found ${existingIds.size} existing jobs in sheet`);

  // Scrape all jobs from Haifa region
  const newListings: JobListing[] = [];

  try {
    // Fetch page 1 to get total count
    const firstPageHtml = await fetchPage(1);
    const totalPages = extractTotalPages(firstPageHtml);

    console.log(`📄 Scraping ${totalPages} pages of results...`);

    // Scrape all pages (limit to 5 pages to stay within memory)
    const pagesToScrape = Math.min(totalPages, 5);

    for (let page = 1; page <= pagesToScrape; page++) {
      const html = await fetchPage(page);

      // Parse job cards from the page
      const cards = parseListingCards(html);
      console.log(`Page ${page}: Found ${cards.length} job cards`);

      // Check each card for our search terms
      for (const card of cards) {
        // Filter by location
        const matchesLocation = LOCATION_KEYWORDS.some(
          (loc) =>
            card.location.toLowerCase().includes(loc.toLowerCase()) ||
            card.title.toLowerCase().includes(loc.toLowerCase())
        );

        if (!matchesLocation) {
          continue; // Skip if not in target location
        }

        // Check if matches search criteria
        const matchesRole = matchesSearchCriteria(card, SEARCH_TERMS);

        if (!matchesRole) {
          continue; // Skip if not matching role keywords
        }

        // Check for duplicates
        if (card.href && newListings.some((l) => l.jobUrl === card.href)) {
          continue; // Already in new listings
        }

        // Fetch full details from listing page
        try {
          const detailHtml = await fetch(
            `https://www.gotfriends.co.il${card.href}`.startsWith("http")
              ? card.href
              : `https://www.gotfriends.co.il${card.href}`
          ).then((r) => r.text());

          const listing = parseListingPage(detailHtml, card.href);

          if (
            listing &&
            !existingIds.has(listing.positionId) &&
            !newListings.some((l) => l.positionId === listing.positionId)
          ) {
            newListings.push(listing);
            console.log(`✅ Found new job: ${listing.title} at ${listing.company}`);
          }
        } catch (error) {
          console.error(`Error fetching detail page for ${card.href}:`, error);
          // Continue to next card instead of failing
        }
      }

      // Small delay between pages to be respectful
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Append new listings to sheet
    if (newListings.length > 0) {
      const appended = await appendJobListings(sheetsConfig, newListings);
      console.log(`📊 Appended ${appended} new job listings to sheet`);

      // Format sheet for readability
      await formatSheet(sheetsConfig);
    } else {
      console.log("ℹ️ No new jobs found matching criteria");
    }

    return {
      success: true,
      newJobsFound: newListings.length,
      totalInSheet: existingIds.size + newListings.length,
    };
  } catch (error) {
    console.error("Scraper error:", error);
    throw error;
  }
}

/**
 * Fetch a page of results from GotFriends
 */
async function fetchPage(pageNumber: number): Promise<string> {
  // Start with a general search, then filter by location/keywords
  // Using the Haifa region if possible
  const url = `https://www.gotfriends.co.il/jobs/?page=${pageNumber}&total=19146`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page ${pageNumber}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Extract total pages from HTML
 */
function extractTotalPages(html: string): number {
  const $ = cheerio.load(html);

  // Look for pagination info
  const pageInfo = $("*:contains('עמוד'), .pagination, [class*='page']").text();
  const match = pageInfo.match(/(\d+)\s*[מ|of]\s*(\d+)/);

  if (match) {
    return parseInt(match[2], 10);
  }

  // Fallback: assume 192 pages (19146 jobs / 8 per page)
  return 192;
}

// Run the scraper
scrapeGotFriendsJobs().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

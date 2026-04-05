import * as cheerio from "cheerio";

export interface JobListing {
  positionId: string;
  title: string;
  company: string;
  location: string;
  requirementsSummary: string;
  fullDescription: string;
  jobUrl: string;
  dateFound: string;
}

/**
 * Parse a job listing page and extract details
 */
export function parseListingPage(html: string, baseUrl: string): JobListing | null {
  const $ = cheerio.load(html);

  // Try to extract job ID from URL or meta tag
  const positionId = extractPositionId(html, baseUrl);
  if (!positionId) return null;

  // Extract title
  const title = $("h1")
    .first()
    .text()
    .trim() || $("title").text().split(" - ")[0].trim();

  // Extract company (usually near the title or in a company section)
  const company = extractCompany($);

  // Extract location
  const location = extractLocation($);

  // Extract requirements summary (first few requirements)
  const requirementsSummary = extractRequirements($);

  // Extract full description
  const fullDescription = extractDescription($);

  if (!title || !company || !location) {
    return null;
  }

  return {
    positionId,
    title,
    company,
    location,
    requirementsSummary,
    fullDescription,
    jobUrl: baseUrl,
    dateFound: new Date().toISOString().split("T")[0],
  };
}

/**
 * Parse listing cards from a search results page
 */
export function parseListingCards(html: string): Array<{ title: string; href: string; location: string; requirementsSummary: string }> {
  const $ = cheerio.load(html);
  const listings: Array<{ title: string; href: string; location: string; requirementsSummary: string }> = [];

  // Job cards are typically in divs or articles with class/data attributes
  $("a[href*='/jobslobby/']").each((i, elem) => {
    const $card = $(elem);
    const title = $card.find("h2, .job-title, span.title").text().trim() || $card.text().trim();
    const href = $card.attr("href") || "";

    // Try to extract location and requirements from the card
    const cardContent = $card.parent().text();
    const location = extractLocationFromText(cardContent);
    const requirementsSummary = extractRequirementsFromText(cardContent);

    if (title && href) {
      listings.push({
        title,
        href,
        location,
        requirementsSummary,
      });
    }
  });

  return listings;
}

/**
 * Check if a job listing matches search criteria
 */
export function matchesSearchCriteria(listing: Partial<JobListing>, searchTerms: string[]): boolean {
  const textToSearch = `${listing.title || ""} ${listing.company || ""} ${listing.requirementsSummary || ""} ${listing.fullDescription || ""}`.toLowerCase();

  return searchTerms.some((term) => textToSearch.includes(term.toLowerCase()));
}

function extractPositionId(html: string, url: string): string {
  // Try to extract from URL (e.g., /jobslobby/.../#144603)
  const hashMatch = url.match(/#(\d+)$/);
  if (hashMatch) return hashMatch[1];

  // Try to extract from HTML data attributes or visible text
  const match = html.match(/משרה\s*#?(\d{5,})|position.*?(\d{5,})|id["\s:=']*(\d{5,})/i);
  if (match) return match[1] || match[2] || match[3] || "";

  return "";
}

function extractCompany($: cheerio.CheerioAPI): string {
  // Try common selectors for company name
  let company = $(".company-name, [class*='company'], [data-company]").first().text().trim();
  if (!company) {
    company = $("strong, b").first().text().trim();
  }
  return company;
}

function extractLocation($: cheerio.CheerioAPI): string {
  // Look for location indicators
  const locationText = $("[class*='location'], [class*='area'], [data-location]").text().trim();
  if (locationText) return locationText;

  // Fallback: scan text for known cities
  const pageText = $.text();
  if (pageText.includes("חיפה")) return "חיפה (Haifa)";
  if (pageText.includes("יקנעם")) return "Yokneam";
  if (pageText.includes("ת\"א")) return "Tel Aviv";

  return "";
}

function extractRequirements($: cheerio.CheerioAPI): string {
  // Look for requirements section
  const reqSection = $("*:contains('דרישות'), *:contains('Requirements')")
    .nextUntil("h2, h3, hr")
    .text()
    .trim();

  if (reqSection) return reqSection.slice(0, 200); // First 200 chars

  // Fallback: get first few list items
  const items = $("li, ul li")
    .slice(0, 3)
    .map((i, el) => $(el).text().trim())
    .get()
    .join(" | ");

  return items || "";
}

function extractDescription($: cheerio.CheerioAPI): string {
  // Look for description section
  const desc = $("[class*='description'], [class*='content'], article, [role='main']").text().trim();
  const result = desc || $.text().trim();
  // Limit to first 2000 chars to avoid memory bloat
  return result.slice(0, 2000);
}

function extractLocationFromText(text: string): string {
  if (text.includes("חיפה")) return "Haifa";
  if (text.includes("יקנעם")) return "Yokneam";
  if (text.includes("צפון")) return "North";
  return "";
}

function extractRequirementsFromText(text: string): string {
  // Extract a snippet mentioning years/requirements
  const reqMatch = text.match(/(\d+\s*(?:שנות|years)\s*[^,.]*)(?:[,.]|$)/);
  return reqMatch ? reqMatch[1].trim() : "";
}

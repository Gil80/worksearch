import { chromium } from "playwright";
import type { JobListing } from "../../trigger/gotfriends-scraper/parse-listing.js";

export async function scrapeHireMeTechJobs(searchTerm: string, location: string): Promise<JobListing[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const listings: JobListing[] = [];

  try {
    console.log(`🌐 Scraping HireMeTech for "${searchTerm}" in "${location}"...`);

    // Navigate to search page with filters
    const searchUrl = `http://hiremetech.com/jobs-app/?title=${encodeURIComponent(searchTerm)}&location=${encodeURIComponent(location)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle" });

    // Wait for job listings to load
    await page.waitForSelector('[class*="job"], [class*="listing"], [data-job]', {
      timeout: 10000,
    }).catch(() => {
      console.log("No job listings found on page");
    });

    // Extract job listings
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll(
        'a[href*="/jobs/"], [class*="job-card"], [class*="listing-item"]'
      );
      const jobs: any[] = [];

      jobElements.forEach((elem) => {
        const title = elem.querySelector("h2, h3, .title, [class*='title']")?.textContent || "";
        const company = elem.querySelector(".company, [class*='company']")?.textContent || "";
        const location = elem.querySelector(".location, [class*='location']")?.textContent || "";
        const href = (elem as any).href || elem.getAttribute("href") || "";
        const description = elem.textContent || "";

        if (title && href) {
          jobs.push({
            title: title.trim(),
            company: company.trim(),
            location: location.trim(),
            href,
            description: description.trim(),
          });
        }
      });

      return jobs;
    });

    console.log(`Found ${jobs.length} jobs on HireMeTech`);

    // Process each job
    for (const job of jobs) {
      try {
        // Fetch full job details
        await page.goto(job.href, { waitUntil: "networkidle" }).catch(() => {});

        const fullDetails = await page.evaluate(() => {
          const title = document.querySelector("h1, h2, [class*='title']")?.textContent || "";
          const company = document.querySelector(".company, [class*='company']")?.textContent || "";
          const location = document.querySelector(".location, [class*='location']")?.textContent || "";
          const description = document.querySelector(".description, [class*='description'], main, article")?.textContent || "";
          const positionId = window.location.href.split("/").pop() || new Date().getTime().toString();

          return { title, company, location, description, positionId };
        });

        if (fullDetails.title && fullDetails.company) {
          const listing: JobListing = {
            positionId: fullDetails.positionId,
            title: fullDetails.title.trim(),
            company: fullDetails.company.trim(),
            location: fullDetails.location.trim() || job.location,
            requirementsSummary: fullDetails.description.slice(0, 200),
            fullDescription: fullDetails.description,
            jobUrl: job.href,
            dateFound: new Date().toISOString().split("T")[0],
          };

          listings.push(listing);
          console.log(`✅ Found: ${listing.title} at ${listing.company}`);
        }
      } catch (error) {
        console.error(`Error fetching job details from ${job.href}:`, error);
      }
    }
  } catch (error) {
    console.error("Error scraping HireMeTech:", error);
  } finally {
    await browser.close();
  }

  return listings;
}

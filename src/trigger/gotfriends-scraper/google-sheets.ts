import { google } from "googleapis";
import type { JobListing } from "./parse-listing.js";

const sheets = google.sheets("v4");

interface GoogleSheetsConfig {
  sheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

/**
 * Initialize Google Sheets client with service account credentials
 */
function createAuthClient(config: GoogleSheetsConfig) {
  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey.replace(/\\n/g, "\n"), // Handle escaped newlines in env vars
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth;
}

/**
 * Get all existing job IDs from the sheet to check for duplicates
 */
export async function getExistingJobIds(config: GoogleSheetsConfig): Promise<Set<string>> {
  const auth = createAuthClient(config);

  try {
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: config.sheetId,
      range: "A2:A", // Position ID column, skip header
    });

    const ids = new Set<string>();
    if (response.data.values) {
      response.data.values.forEach((row) => {
        if (row[0]) ids.add(row[0].toString().trim());
      });
    }

    return ids;
  } catch (error) {
    console.error("Error reading existing job IDs:", error);
    return new Set();
  }
}

/**
 * Append new job listings to the sheet
 */
export async function appendJobListings(config: GoogleSheetsConfig, listings: JobListing[]): Promise<number> {
  if (listings.length === 0) return 0;

  const auth = createAuthClient(config);

  // Format rows for Google Sheets
  const rows = listings.map((job) => [
    job.positionId,
    job.title,
    job.company,
    job.location,
    job.requirementsSummary,
    job.fullDescription.slice(0, 500), // Truncate to avoid cell size limits
    job.jobUrl,
    job.dateFound,
    "", // Status column (empty for user to fill)
    "", // Notes column (empty for user to fill)
  ]);

  try {
    const response = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: config.sheetId,
      range: "A:J", // All columns
      valueInputOption: "RAW",
      requestBody: {
        values: rows,
      },
    });

    return response.data.updates?.updatedRows || 0;
  } catch (error) {
    console.error("Error appending to sheet:", error);
    throw error;
  }
}

/**
 * Ensure sheet has headers
 */
export async function ensureSheetHeaders(config: GoogleSheetsConfig): Promise<void> {
  const auth = createAuthClient(config);

  const headers = [
    ["Position ID", "Job Title", "Company", "Location", "Requirements", "Full Description", "Job URL", "Date Found", "Status", "Notes"],
  ];

  try {
    // Check if headers exist
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: config.sheetId,
      range: "A1:J1",
    });

    if (!response.data.values || response.data.values.length === 0) {
      // Write headers
      await sheets.spreadsheets.values.update({
        auth,
        spreadsheetId: config.sheetId,
        range: "A1:J1",
        valueInputOption: "RAW",
        requestBody: {
          values: headers,
        },
      });

      console.log("Sheet headers created");
    }
  } catch (error) {
    console.error("Error ensuring headers:", error);
    throw error;
  }
}

/**
 * Format columns for readability
 */
export async function formatSheet(config: GoogleSheetsConfig): Promise<void> {
  const auth = createAuthClient(config);

  try {
    await sheets.spreadsheets.batchUpdate({
      auth,
      spreadsheetId: config.sheetId,
      requestBody: {
        requests: [
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: 10,
              },
            },
          },
        ],
      },
    });

    console.log("Sheet formatted");
  } catch (error) {
    console.error("Error formatting sheet:", error);
    // Don't throw - formatting is optional
  }
}

# GotFriends Job Scraper

Scrapes project management job listings from [gotfriends.co.il](https://www.gotfriends.co.il) for the Haifa area and saves them to a Google Sheet.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the scraper:**
   ```bash
   npm run scrape
   ```

That's it. Jobs will be fetched and appended to your Google Sheet.

## Setup

### Google Sheets Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create a new one)
3. Enable Google Sheets API:
   - Search for "Google Sheets API" → Click **Enable**
4. Your service account should already have credentials configured

### Environment Variables

Your `.env` file should contain:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-sheet-id-from-url
```

## Features

- **Searches for:** Project Manager, Technical PM, Release Manager, Scrum Master, Program Manager, Delivery Manager, PMO roles
- **In Hebrew & English:** Supports both language searches
- **Location filtered:** Haifa and surrounding areas only
- **Deduplication:** Won't add jobs you already have
- **Manual tracking:** Includes Status and Notes columns for you to track applications

## How It Works

1. Fetches job listings from GotFriends
2. Filters by location (Haifa area) and job role keywords
3. Fetches detail pages for matching jobs
4. Checks against existing jobs in your Google Sheet
5. Appends only new jobs
6. Auto-formats the spreadsheet for readability

## Columns

| Column | Purpose |
|--------|---------|
| Position ID | GotFriends job ID (for deduplication) |
| Job Title | Role title |
| Company | Company name |
| Location | City/area |
| Requirements | Key requirements summary |
| Full Description | Complete role description |
| Job URL | Direct link to GotFriends listing |
| Date Found | When the scraper found this job |
| Status | *You fill in* (e.g., Applied, Interested, Rejected) |
| Notes | *You fill in* (your personal notes) |

## Running from WSL

Open WSL and navigate to this directory, then run:

```bash
npm run scrape
```

That's it! Check your Google Sheet for new jobs.

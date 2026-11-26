const path = require("path");
const { chromium } = require("playwright");

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const filePath = path.resolve("docs/CA3_SRS_REPORT.html");
    await page.goto("file:///" + filePath.replace(/\\/g, "/"), { waitUntil: "networkidle" });

    await page.pdf({
      path: "docs/CA3_SRS_CampusPulse.pdf",
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        bottom: "12mm",
        left: "12mm",
        right: "12mm",
      },
    });

    console.log("Generated docs/CA3_SRS_CampusPulse.pdf successfully!");
    await browser.close();
  } catch (err) {
    console.error("PDF generation error:", err);
    process.exit(1);
  }
})();

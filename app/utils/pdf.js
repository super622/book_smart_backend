// const puppeteer = require("puppeteer");
// const fs = require("fs");

// // Function to generate the PDF using Puppeteer
// async function generatePDF(outputPath, invoiceData) {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();
//   page.setDefaultTimeout(300000);
//   // await page.setContent({ htmlContent, timeOut: 300000, waitUntil: "load" });
//   await page.goto("file:///D:/BookSmart/BookSmart_backend/app/utils/booksmart.html");

//   // Wait for the table to be rendered
//   // await page.waitForSelector("table");
//   // await page.waitForSelector("img");
//   // await page.waitForSelector("*");
//   // await page.pdf({ path: outputPath, format: "A4", waitUntil: "networkidle2" });

//   // const html = fs.readFileSync("./booksmart.html", "utf-8");
//   // await page.setContent(html, { waitUntil: "domcontentloaded" });
//   // await page.waitForSelector(".tr-bottom");

//   // Generate the PDF
//   // await page.emulateMediaType("screen");
//   await page.pdf({
//     path: outputPath, // Output file path
//     format: "A4", // Paper format
//     printBackground: true, // Include background graphics
//     margin: {
//       // Set margins
//       top: "20px",
//       right: "20px",
//       bottom: "20px",
//       left: "20px",
//     },
//   });
//   await browser.close();
//   const path = "D:\\BookSmart\\BookSmart_backend\\"+outputPath
//   console.log(path);
//   return path;
// }

// // Export the generatePDF function
// module.exports = { generatePDF };


const puppeteer = require('puppeteer');
const path = require("path");

// Function to generate the PDF using Puppeteer
async function generatePDF(htmlContent, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setContent(htmlContent);

  // Wait for the table to be rendered
  await page.waitForSelector('img');
  await page.waitForSelector('table');
  await page.waitForSelector("*");


  // await page.pdf({ path: outputPath, format: 'A4', waitUntil: 'networkidle2' });


  await page.pdf({
    path: outputPath, // Output file path
    format: "A4", // Paper format
    printBackground: true, // Include background graphics
    margin: {
      // Set margins
      top: "70px",
      right: "30px",
      bottom: "50px",
      left: "30px",
    },
  });
  await browser.close();
  const paths = path.resolve(outputPath);
  console.log(paths);
  return paths;
}

// Export the generatePDF function
module.exports = { generatePDF };
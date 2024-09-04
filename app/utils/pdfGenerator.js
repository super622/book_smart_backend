// pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const pdfkitTable = require('pdfkit-table');

// Function to generate PDF invoice
const generateInvoice = (facility) => {
    const doc = new PDFDocument();
    const invoicePath = path.join(__dirname, `${facility.name}-invoice(${facility.id}).pdf`);
    
    doc.pipe(fs.createWriteStream(invoicePath));

    const imageBuffer = fs.readFileSync('mark.png');
    const table = {
        headers: ['Item', 'Description', 'Quantity', 'Price'],
        rows: [
          ['Product A', 'Awesome product', 2, 10.99],
          ['Product B', 'Another great product', 1, 25.50],
        ],
    };
      
    
    doc.image(imageBuffer, 100, 50, { width: 100, height: 50 })
    doc.fontSize(25).text(`Invoice for ${facility.name}`, { align: 'center' });
    doc.moveDown();
    doc.fillColor('lightgray').rect(0, 100, 150, 20).fill();
    doc.fillColor('blue').fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.text('----------------------------------------');
    doc.moveDown();
    doc.strokeColor('red').rect(100,150,200,50).stroke()
    doc.text('Invoice Details:');
    doc.text(`Facility ID: ${facility.id}`);
    doc.text(`Amount Due: $${facility.amountDue}`);
    // doc.table(table, {width: 500})
    doc.fontSize(14).text('Total: $37.48', 400, 250);
    
    doc.end();
    
    return invoicePath;
};

module.exports = { generateInvoice };

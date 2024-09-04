const tableBody = document
    .getElementById("myTable")
    .getElementsByTagName("tbody")[0];
let totalPrice = 0.0;
for (const row of invoiceData) {
    totalPrice += Number(row.price);
    let text = `<tr class="tr-date">
    <td>
        ${row.date}
    </td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
</tr>
<tr class="tr-description">
    <td>
        ${row.description}
    </td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
</tr>
<tr class="tr-etc">
    <td></td>
    <td></td>
    <td>${row.quantity}</td>
    <td>$${row.rate}</td>
    <td>$${row.price}</td>
</tr>`;
    tableBody.innerHTML += text;
}
let text = `<tr class="tr-bottom">
    <td class="no-border">
        Make all checks payable to BOOKSMART TECHNOLOGIES LLC
    </td>
    <td class="no-border"></td>
    <td class="no-border"></td>
    <td>TOTAL</td>
    <td>$${totalPrice}</td>
</tr>
<tr class="tr-bottom">
    <td class="no-border1">
        Payment is Due Upon Receipt
    </td>
    <td class="no-border1"></td>
    <td class="no-border1"></td>
    <td class="no-border1"></td>
    <td class="no-border1"></td>
</tr>
<tr class="tr-bottom">
    <td class="no-border1 pt-30">
        THANK YOU FOR YOUR BUSINESS
    </td>
    <td class="no-border1 pt-30"></td>
    <td class="no-border1 pt-30"></td>
    <td class="no-border1 pt-30"></td>
    <td class="no-border1 pt-30"></td>
</tr>`;
tableBody.innerHTML += text;
console.log(tableBody.innerHTML);

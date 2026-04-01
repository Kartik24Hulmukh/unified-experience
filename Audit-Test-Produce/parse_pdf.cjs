const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('berozgar_platform_audit_report_march_31_2026_2026-03-31.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('audit_report_text.txt', data.text);
    console.log('Done extraction');
}).catch(function(error) {
    console.error(error);
});

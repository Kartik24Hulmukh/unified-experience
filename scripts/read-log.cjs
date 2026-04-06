const fs = require('fs');
const content = fs.readFileSync('long_hydration_utf8.log');
console.log(content.toString('utf16le'));

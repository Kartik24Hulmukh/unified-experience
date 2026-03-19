const fs = require('fs');
let code = fs.readFileSync('e2e/helpers.ts', 'utf8');
code = code.replace(/SELECT completed_exchanges, cancelled_requests, admin_flags/g, 'SELECT completed_exchanges as "completedExchanges", cancelled_requests as "cancelledRequests", admin_flags as "adminFlags"');
fs.writeFileSync('e2e/helpers.ts', code);
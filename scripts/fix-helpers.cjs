const fs = require('fs');
let code = fs.readFileSync('e2e/helpers.ts', 'utf8');

code = code.replace(/const SQLITE_URL = [^\;]+;/, 'const DB_URL = process.env.DATABASE_URL || "postgresql://berozgar:berozgar123@127.0.0.1:5433/berozgar?schema=public";');
code = code.replace(/url: SQLITE_URL/, 'url: DB_URL');
code = code.replace(/datetime\('now'\)/g, "NOW()");
code = code.replace(/datetime\('now', '\+10 minutes'\)/g, "NOW() + interval '10 minutes'");

fs.writeFileSync('e2e/helpers.ts', code);
console.log('Fixed e2e/helpers.ts');
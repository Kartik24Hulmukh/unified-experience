const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function checkToken(rawToken) {
  const hashed = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({
    where: { token: hashed }
  });
  console.log('Record:', JSON.stringify(record, null, 2));
  process.exit(0);
}

// Pass the raw token from command line or hardcode if known
const raw = process.argv[2];
if (raw) checkToken(raw);
else console.log('Usage: node check_token.js <rawToken>');

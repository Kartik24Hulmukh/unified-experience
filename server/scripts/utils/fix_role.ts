import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.user.update({
    where: { email: 'testuser@mctrgit.ac.in' },
    data: { role: 'STUDENT_VERIFIED', verified: true }
}).then(console.log).finally(() => p.$disconnect());

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import path from 'path';

interface MockFilterCondition {
  email?: { contains?: string; startsWith?: string };
  fullName?: { contains?: string; startsWith?: string };
  title?: { contains?: string; startsWith?: string };
  description?: { contains?: string; startsWith?: string };
  name?: { contains?: string; startsWith?: string };
  officialEmail?: { contains?: string; startsWith?: string };
}

interface MockUser {
  id: string;
  email: string;
  fullName: string;
  password?: string;
  role?: string;
  verified?: boolean;
}

interface MockListing {
  id: string;
  title: string;
  description: string;
  category?: string;
  module?: string;
  price?: number;
  status?: string;
  ownerId?: string;
}

interface MockStudent {
  id: string;
  name: string;
  officialEmail: string;
  department?: string;
  year?: string;
}

let dbUsers: MockUser[] = [];
let dbListings: MockListing[] = [];
let dbStudents: MockStudent[] = [];

let userIdCounter = 1;
let listingIdCounter = 1;
let studentIdCounter = 1;

// Define mocks
const mockUserCreate = vi.fn().mockImplementation((args) => {
  const newUser = {
    id: `user-id-${userIdCounter++}`,
    ...args.data
  };
  dbUsers.push(newUser);
  return Promise.resolve(newUser);
});

const mockUserDeleteMany = vi.fn().mockImplementation((args) => {
  let deletedCount = 0;
  if (args && args.where) {
    const initialCount = dbUsers.length;
    dbUsers = dbUsers.filter(u => {
      if (args.where.id?.in) {
        return !args.where.id.in.includes(u.id);
      }
      if (args.where.OR) {
        const matchesOr = args.where.OR.some((cond: MockFilterCondition) => {
          if (cond.email?.contains) {
            return u.email.toLowerCase().includes(cond.email.contains.toLowerCase());
          }
          if (cond.fullName?.contains) {
            return u.fullName.toLowerCase().includes(cond.fullName.contains.toLowerCase());
          }
          return false;
        });
        return !matchesOr;
      }
      return true;
    });
    deletedCount = initialCount - dbUsers.length;
  } else {
    deletedCount = dbUsers.length;
    dbUsers = [];
  }
  return Promise.resolve({ count: deletedCount });
});

const mockUserCount = vi.fn().mockImplementation((args) => {
  let count = dbUsers.length;
  if (args && args.where) {
    count = dbUsers.filter(u => {
      if (args.where.email?.contains) {
        return u.email.toLowerCase().includes(args.where.email.contains.toLowerCase());
      }
      return true;
    }).length;
  }
  return Promise.resolve(count);
});

const mockUserFindFirst = vi.fn().mockImplementation((args) => {
  if (args && args.where) {
    const found = dbUsers.find(u => {
      if (args.where.email?.contains) {
        return u.email.toLowerCase().includes(args.where.email.contains.toLowerCase());
      }
      return true;
    });
    return Promise.resolve(found || null);
  }
  return Promise.resolve(dbUsers[0] || null);
});

const mockUserFindMany = vi.fn().mockImplementation((args) => {
  let results = dbUsers;
  if (args && args.where) {
    if (args.where.OR) {
      results = dbUsers.filter(u => {
        return args.where.OR.some((cond: MockFilterCondition) => {
          if (cond.fullName?.startsWith) {
            return u.fullName.toLowerCase().startsWith(cond.fullName.startsWith.toLowerCase());
          }
          if (cond.fullName?.contains) {
            return u.fullName.toLowerCase().includes(cond.fullName.contains.toLowerCase());
          }
          if (cond.email?.startsWith) {
            return u.email.toLowerCase().startsWith(cond.email.startsWith.toLowerCase());
          }
          if (cond.email?.contains) {
            return u.email.toLowerCase().includes(cond.email.contains.toLowerCase());
          }
          return false;
        });
      });
    }
  }
  return Promise.resolve(results);
});

const mockListingCreate = vi.fn().mockImplementation((args) => {
  const newListing = {
    id: `listing-id-${listingIdCounter++}`,
    ...args.data
  };
  dbListings.push(newListing);
  return Promise.resolve(newListing);
});

const mockListingDeleteMany = vi.fn().mockImplementation((args) => {
  let deletedCount = 0;
  if (args && args.where) {
    const initialCount = dbListings.length;
    dbListings = dbListings.filter(l => {
      if (args.where.id?.in) {
        return !args.where.id.in.includes(l.id);
      }
      if (args.where.OR) {
        const matchesOr = args.where.OR.some((cond: MockFilterCondition) => {
          if (cond.title?.contains) {
            return l.title.toLowerCase().includes(cond.title.contains.toLowerCase());
          }
          if (cond.description?.contains) {
            return l.description.toLowerCase().includes(cond.description.contains.toLowerCase());
          }
          return false;
        });
        return !matchesOr;
      }
      return true;
    });
    deletedCount = initialCount - dbListings.length;
  } else {
    deletedCount = dbListings.length;
    dbListings = [];
  }
  return Promise.resolve({ count: deletedCount });
});

const mockListingCount = vi.fn().mockImplementation((args) => {
  let count = dbListings.length;
  if (args && args.where) {
    count = dbListings.filter(l => {
      if (args.where.title?.contains) {
        return l.title.toLowerCase().includes(args.where.title.contains.toLowerCase());
      }
      return true;
    }).length;
  }
  return Promise.resolve(count);
});

const mockListingFindFirst = vi.fn().mockImplementation((args) => {
  if (args && args.where) {
    const found = dbListings.find(l => {
      if (args.where.title?.contains) {
        return l.title.toLowerCase().includes(args.where.title.contains.toLowerCase());
      }
      return true;
    });
    return Promise.resolve(found || null);
  }
  return Promise.resolve(dbListings[0] || null);
});

const mockListingFindMany = vi.fn().mockImplementation((args) => {
  let results = dbListings;
  if (args && args.where) {
    if (args.where.OR) {
      results = dbListings.filter(l => {
        return args.where.OR.some((cond: MockFilterCondition) => {
          if (cond.title?.startsWith) {
            return l.title.toLowerCase().startsWith(cond.title.startsWith.toLowerCase());
          }
          if (cond.title?.contains) {
            return l.title.toLowerCase().includes(cond.title.contains.toLowerCase());
          }
          if (cond.description?.startsWith) {
            return l.description.toLowerCase().startsWith(cond.description.startsWith.toLowerCase());
          }
          if (cond.description?.contains) {
            return l.description.toLowerCase().includes(cond.description.contains.toLowerCase());
          }
          return false;
        });
      });
    }
  }
  return Promise.resolve(results);
});

const mockStudentCreate = vi.fn().mockImplementation((args) => {
  const newStudent = {
    id: `student-id-${studentIdCounter++}`,
    ...args.data
  };
  dbStudents.push(newStudent);
  return Promise.resolve(newStudent);
});

const mockStudentDeleteMany = vi.fn().mockImplementation((args) => {
  let deletedCount = 0;
  if (args && args.where) {
    const initialCount = dbStudents.length;
    dbStudents = dbStudents.filter(s => {
      if (args.where.OR) {
        const matchesOr = args.where.OR.some((cond: MockFilterCondition) => {
          if (cond.name?.startsWith) {
            return s.name.toLowerCase().startsWith(cond.name.startsWith.toLowerCase());
          }
          if (cond.name?.contains) {
            return s.name.toLowerCase().includes(cond.name.contains.toLowerCase());
          }
          if (cond.officialEmail?.startsWith) {
            return s.officialEmail.toLowerCase().startsWith(cond.officialEmail.startsWith.toLowerCase());
          }
          if (cond.officialEmail?.contains) {
            return s.officialEmail.toLowerCase().includes(cond.officialEmail.contains.toLowerCase());
          }
          return false;
        });
        return !matchesOr;
      }
      return true;
    });
    deletedCount = initialCount - dbStudents.length;
  } else {
    deletedCount = dbStudents.length;
    dbStudents = [];
  }
  return Promise.resolve({ count: deletedCount });
});

const mockStudentCount = vi.fn().mockImplementation((args) => {
  let count = dbStudents.length;
  if (args && args.where) {
    count = dbStudents.filter(s => {
      if (args.where.officialEmail?.contains) {
        return s.officialEmail.toLowerCase().includes(args.where.officialEmail.contains.toLowerCase());
      }
      return true;
    }).length;
  }
  return Promise.resolve(count);
});

const mockStudentFindFirst = vi.fn().mockImplementation((args) => {
  if (args && args.where) {
    const found = dbStudents.find(s => {
      if (args.where.officialEmail?.contains) {
        return s.officialEmail.toLowerCase().includes(args.where.officialEmail.contains.toLowerCase());
      }
      return true;
    });
    return Promise.resolve(found || null);
  }
  return Promise.resolve(dbStudents[0] || null);
});

const mockDisputeDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
const mockRequestDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(() => {
      return {
        user: {
          create: mockUserCreate,
          deleteMany: mockUserDeleteMany,
          count: mockUserCount,
          findFirst: mockUserFindFirst,
          findMany: mockUserFindMany,
        },
        listing: {
          create: mockListingCreate,
          deleteMany: mockListingDeleteMany,
          count: mockListingCount,
          findFirst: mockListingFindFirst,
          findMany: mockListingFindMany,
        },
        collegeStudent: {
          create: mockStudentCreate,
          deleteMany: mockStudentDeleteMany,
          count: mockStudentCount,
          findFirst: mockStudentFindFirst,
        },
        dispute: {
          deleteMany: mockDisputeDeleteMany,
        },
        request: {
          deleteMany: mockRequestDeleteMany,
        },
        $disconnect: mockDisconnect,
      };
    }),
  };
});

const prisma = new PrismaClient();

describe('Data & Content Integrity Verification', () => {
  const scriptsDir = path.resolve(__dirname, '../scripts');
  const prismaDir = path.resolve(__dirname, '../prisma');

  describe('Production Guards', () => {
    const seedScripts = [
      { name: 'prisma/seed.ts', path: path.join(prismaDir, 'seed.ts'), runner: 'npx tsx' },
      { name: 'scripts/seed-accommodation.cjs', path: path.join(scriptsDir, 'seed-accommodation.cjs'), runner: 'node' },
      { name: 'scripts/seed-admin.ts', path: path.join(scriptsDir, 'seed-admin.ts'), runner: 'npx tsx' },
      { name: 'scripts/seed-resale-skills.cjs', path: path.join(scriptsDir, 'seed-resale-skills.cjs'), runner: 'node' },
      { name: 'scripts/purge-test-records.ts', path: path.join(scriptsDir, 'purge-test-records.ts'), runner: 'npx tsx' }
    ];

    seedScripts.forEach((script) => {
      it(`should exit 1 in production mode for ${script.name}`, () => {
        let errorOccurred = false;
        let exitCode = 0;
        let stdout = '';
        let stderr = '';

        try {
          const cmd = `${script.runner} "${script.path}"`;
          stdout = execSync(cmd, {
            env: { ...process.env, NODE_ENV: 'production', FORCE_PURGE: '' },
            stdio: 'pipe'
          }).toString();
        } catch (error) {
          errorOccurred = true;
          const err = error as { status: number; stdout?: Buffer | string; stderr?: Buffer | string };
          exitCode = err.status;
          stdout = err.stdout?.toString() || '';
          stderr = err.stderr?.toString() || '';
        }

        expect(errorOccurred).toBe(true);
        expect(exitCode).toBe(1);
        expect(stdout + stderr).toContain('ABORTED');
      });
    });
  });

  describe('purge-test-records.ts functionality', () => {
    const testUserIds: string[] = [];
    let validUserId: string = '';

    beforeAll(async () => {
      // Cleanup existing conflicts if any
      await prisma.listing.deleteMany({
        where: {
          OR: [
            { title: { contains: 'VERIFIER' } },
            { description: { contains: 'VERIFIER' } }
          ]
        }
      });
      await prisma.collegeStudent.deleteMany({
        where: {
          OR: [
            { officialEmail: { contains: 'verifier' } },
            { name: { contains: 'VERIFIER' } }
          ]
        }
      });
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: { contains: 'verifier' } },
            { fullName: { contains: 'VERIFIER' } }
          ]
        }
      });
    });

    afterAll(async () => {
      // Cleanup
      await prisma.listing.deleteMany({
        where: {
          OR: [
            { title: { contains: 'VERIFIER' } },
            { description: { contains: 'VERIFIER' } }
          ]
        }
      });
      await prisma.collegeStudent.deleteMany({
        where: {
          OR: [
            { officialEmail: { contains: 'verifier' } },
            { name: { contains: 'VERIFIER' } }
          ]
        }
      });
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: { contains: 'verifier' } },
            { fullName: { contains: 'VERIFIER' } }
          ]
        }
      });
      await prisma.$disconnect();
    });

    it('should purge test records matching "TEST", "177", "testuser", "buyer" prefixes/contains, but keep others', async () => {
      // 1. Create a valid user that owns listings (so we don't violate integrity constraints)
      const validUser = await prisma.user.create({
        data: {
          email: 'valid_verifier@mctrgit.ac.in',
          fullName: 'Valid Verifier User',
          password: 'Password@1234',
          role: 'STUDENT_VERIFIED',
          verified: true
        }
      });
      validUserId = validUser.id;

      // 2. Create users to be purged
      const usersToPurgeData = [
        { email: 'testuser_verifier@mctrgit.ac.in', fullName: 'Normal Name', password: 'Password@1234', role: 'STUDENT_VERIFIED', verified: true },
        { email: 'buyer_verifier@mctrgit.ac.in', fullName: 'Normal Name 2', password: 'Password@1234', role: 'STUDENT_VERIFIED', verified: true },
        { email: 'user177_verifier@mctrgit.ac.in', fullName: 'Normal Name 3', password: 'Password@1234', role: 'STUDENT_VERIFIED', verified: true },
        { email: 'test_user_verifier@mctrgit.ac.in', fullName: 'TEST Verifier User', password: 'Password@1234', role: 'STUDENT_VERIFIED', verified: true }
      ];

      for (const u of usersToPurgeData) {
        const created = await prisma.user.create({ data: u });
        testUserIds.push(created.id);
      }

      // 3. Create listings to be purged
      const listingsToPurgeData = [
        { title: 'TEST Verifier Listing', description: 'Just a description', category: 'Books', module: 'resale', price: 100, status: 'APPROVED', ownerId: validUserId },
        { title: 'Verifier Listing 177', description: 'Just a description', category: 'Books', module: 'resale', price: 100, status: 'APPROVED', ownerId: validUserId },
        { title: 'Verifier Listing 3', description: 'TEST Verifier Description', category: 'Books', module: 'resale', price: 100, status: 'APPROVED', ownerId: validUserId },
        { title: 'Verifier Listing 4', description: 'Description contains 177 verifier', category: 'Books', module: 'resale', price: 100, status: 'APPROVED', ownerId: validUserId }
      ];

      for (const l of listingsToPurgeData) {
        await prisma.listing.create({ data: l });
      }

      // 4. Create listings that should NOT be purged
      const validListing = await prisma.listing.create({
        data: {
          title: 'Valid Verifier Listing',
          description: 'Valid verifier description without test tags',
          category: 'Books',
          module: 'resale',
          price: 100,
          status: 'APPROVED',
          ownerId: validUserId
        }
      });

      // 5. Create CollegeStudents to be purged
      const studentsToPurgeData = [
        { name: 'Student Verifier 1', officialEmail: 'testuser_verifier_student@mctrgit.ac.in', department: 'CS', year: '3rd' },
        { name: 'Student Verifier 2', officialEmail: 'buyer_verifier_student@mctrgit.ac.in', department: 'CS', year: '3rd' },
        { name: 'Student Verifier 3', officialEmail: 'verifier_student177@mctrgit.ac.in', department: 'CS', year: '3rd' },
        { name: 'TEST Student Verifier', officialEmail: 'verifier_student_test@mctrgit.ac.in', department: 'CS', year: '3rd' }
      ];

      for (const s of studentsToPurgeData) {
        await prisma.collegeStudent.create({ data: s });
      }

      // 6. Create CollegeStudent that should NOT be purged
      const validStudent = await prisma.collegeStudent.create({
        data: {
          name: 'Valid Verifier Student',
          officialEmail: 'valid_verifier_student@mctrgit.ac.in',
          department: 'CS',
          year: '3rd'
        }
      });

      // Verify insertion
      const initialUsersCount = await prisma.user.count({ where: { email: { contains: 'verifier' } } });
      const initialListingsCount = await prisma.listing.count({ where: { title: { contains: 'VERIFIER' } } });
      const initialStudentsCount = await prisma.collegeStudent.count({ where: { officialEmail: { contains: 'verifier' } } });

      expect(initialUsersCount).toBe(5); // 4 test users + 1 valid user
      expect(initialListingsCount).toBe(5); // 4 test listings + 1 valid listing
      expect(initialStudentsCount).toBe(5); // 4 test students + 1 valid student

      // Execute purge script in-process
      console.log('Running purge script in-process...');
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const originalExit = process.exit;
      const exitMock = vi.fn();
      process.exit = exitMock as unknown as (code?: number) => never;

      try {
        vi.resetModules();
        await import('../scripts/purge-test-records');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        process.exit = originalExit;
      }

      // Verify deletion
      const finalUsersCount = await prisma.user.count({ where: { email: { contains: 'verifier' } } });
      const finalListingsCount = await prisma.listing.count({ where: { title: { contains: 'VERIFIER' } } });
      const finalStudentsCount = await prisma.collegeStudent.count({ where: { officialEmail: { contains: 'verifier' } } });

      expect(finalUsersCount).toBe(1); // Only the valid user should remain
      expect(finalListingsCount).toBe(1); // Only the valid listing should remain
      expect(finalStudentsCount).toBe(1); // Only the valid student should remain

      // Verify the specific remaining records
      const remainingUser = await prisma.user.findFirst({ where: { email: { contains: 'verifier' } } });
      expect(remainingUser?.email).toBe('valid_verifier@mctrgit.ac.in');

      const remainingListing = await prisma.listing.findFirst({ where: { title: { contains: 'VERIFIER' } } });
      expect(remainingListing?.title).toBe('Valid Verifier Listing');

      const remainingStudent = await prisma.collegeStudent.findFirst({ where: { officialEmail: { contains: 'verifier' } } });
      expect(remainingStudent?.officialEmail).toBe('valid_verifier_student@mctrgit.ac.in');
    });
  });
});


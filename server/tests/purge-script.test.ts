import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindManyListings = vi.fn().mockResolvedValue([{ id: 'l-test-1' }, { id: 'l-177-2' }]);
const mockFindManyUsers = vi.fn().mockResolvedValue([{ id: 'u-test-1', email: 'testuser@mctrgit.ac.in' }]);
const mockDeleteManyDisputes = vi.fn().mockResolvedValue({ count: 2 });
const mockDeleteManyRequests = vi.fn().mockResolvedValue({ count: 3 });
const mockDeleteManyListings = vi.fn().mockResolvedValue({ count: 2 });
const mockDeleteManyUsers = vi.fn().mockResolvedValue({ count: 1 });
const mockDeleteManyStudents = vi.fn().mockResolvedValue({ count: 1 });
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(() => {
      return {
        listing: {
          findMany: mockFindManyListings,
          deleteMany: mockDeleteManyListings,
        },
        user: {
          findMany: mockFindManyUsers,
          deleteMany: mockDeleteManyUsers,
        },
        dispute: {
          deleteMany: mockDeleteManyDisputes,
        },
        request: {
          deleteMany: mockDeleteManyRequests,
        },
        collegeStudent: {
          deleteMany: mockDeleteManyStudents,
        },
        $disconnect: mockDisconnect,
      };
    }),
  };
});

describe('purge-test-records.ts script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly queries and purges matching records', async () => {
    // Import the script to execute it
    await import('../scripts/purge-test-records');

    // Verify findMany was called with correct patterns
    expect(mockFindManyListings).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { title: { startsWith: 'TEST ' } },
            { title: { contains: '177' } },
            { description: { startsWith: 'TEST ' } },
            { description: { contains: '177' } },
          ]),
        }),
      })
    );

    expect(mockFindManyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { fullName: { startsWith: 'TEST ' } },
            { fullName: { contains: '177' } },
            { email: { startsWith: 'TEST ' } },
            { email: { contains: '177' } },
            { email: { startsWith: 'testuser' } },
            { email: { startsWith: 'buyer' } },
          ]),
        }),
      })
    );

    // Verify deleteMany calls use the IDs from the findMany results
    expect(mockDeleteManyDisputes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { listingId: { in: ['l-test-1', 'l-177-2'] } },
            { raisedById: { in: ['u-test-1'] } },
            { againstId: { in: ['u-test-1'] } },
          ]),
        }),
      })
    );

    expect(mockDeleteManyRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { listingId: { in: ['l-test-1', 'l-177-2'] } },
            { buyerId: { in: ['u-test-1'] } },
            { sellerId: { in: ['u-test-1'] } },
          ]),
        }),
      })
    );

    expect(mockDeleteManyListings).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['l-test-1', 'l-177-2'] } },
      })
    );

    expect(mockDeleteManyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['u-test-1'] } },
      })
    );

    expect(mockDeleteManyStudents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { startsWith: 'TEST ' } },
            { name: { contains: '177' } },
            { officialEmail: { startsWith: 'TEST ' } },
            { officialEmail: { contains: '177' } },
            { officialEmail: { startsWith: 'testuser' } },
            { officialEmail: { startsWith: 'buyer' } },
          ]),
        }),
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockDisconnect).toHaveBeenCalled();
  });
});

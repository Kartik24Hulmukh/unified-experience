/**
 * BErozgar — Mess Service
 *
 * CRUD operations for mess providers (admin-curated directory).
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/errors/index';

export interface CreateMessProviderInput {
  name: string;
  type: string;
  location?: string;
  timings?: string;
  priceRange?: string;
  cuisine: string[];
  contactPhone?: string;
}

export async function listMessProviders() {
  return prisma.messProvider.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getMessProvider(id: string) {
  const provider = await prisma.messProvider.findUnique({
    where: { id },
  });
  if (!provider) {
    throw new NotFoundError('MessProvider', id);
  }
  return provider;
}

export async function createMessProvider(input: CreateMessProviderInput) {
  return prisma.messProvider.create({
    data: {
      name: input.name,
      type: input.type,
      location: input.location,
      timings: input.timings,
      priceRange: input.priceRange,
      cuisine: input.cuisine,
      contactPhone: input.contactPhone,
      isActive: true,
    },
  });
}

export async function updateMessProvider(id: string, input: Partial<CreateMessProviderInput>) {
  const provider = await getMessProvider(id);
  return prisma.messProvider.update({
    where: { id: provider.id },
    data: input,
  });
}

export async function deleteMessProvider(id: string) {
  const provider = await getMessProvider(id);
  return prisma.messProvider.update({
    where: { id: provider.id },
    data: { isActive: false },
  });
}

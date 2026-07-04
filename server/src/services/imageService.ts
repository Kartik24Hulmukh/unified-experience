/**
 * BErozgar — Listing Image Service
 *
 * CRUD operations for listing images.
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/errors/index';

export interface CreateListingImageInput {
  listingId: string;
  url: string;
  order?: number;
}

export async function createListingImage(input: CreateListingImageInput) {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId }
  });
  
  if (!listing) {
    throw new NotFoundError('Listing not found');
  }

  return prisma.listingImage.create({
    data: {
      listingId: input.listingId,
      url: input.url,
      order: input.order ?? 0
    }
  });
}

export async function getListingImages(listingId: string) {
  return prisma.listingImage.findMany({
    where: { listingId },
    orderBy: { order: 'asc' }
  });
}

export async function deleteListingImage(id: string) {
  const image = await prisma.listingImage.findUnique({
    where: { id }
  });

  if (!image) {
    throw new NotFoundError('Image not found');
  }

  return prisma.listingImage.delete({
    where: { id }
  });
}

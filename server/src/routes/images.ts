/**
 * BErozgar — Listing Image Routes
 *
 * POST   /api/listings/:listingId/images          — Upload image
 * DELETE /api/listings/:listingId/images/:imageId  — Delete image
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { requireVerifiedStudent } from '@/middleware/requireVerifiedStudent';
import { ForbiddenError, NotFoundError } from '@/errors/index';
import * as listingService from '@/services/listingService';
import * as imageService from '@/services/imageService';
import { apiData } from '@/shared/response';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function imageRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/listings/:listingId/images — Upload image for listing
  app.post(
    '/listings/:listingId/images',
    { preHandler: [authenticate, requireVerifiedStudent] },
    async (request, reply) => {
      const { listingId } = request.params as { listingId: string };
      
      // Ensure listing exists and caller owns it
      const listing = await listingService.getListing(listingId);
      if (!listing) {
        throw new NotFoundError('Listing not found');
      }
      if (listing.ownerId !== request.userId && request.userRole !== 'ADMIN') {
        throw new ForbiddenError('You do not own this listing');
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded', code: 'BAD_REQUEST' });
      }

      // Validate file extension / mime type
      const allowedMimetypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimetypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Only JPEG, PNG, GIF, and WEBP images are allowed', code: 'BAD_REQUEST' });
      }

      // Generate a unique filename
      const ext = path.extname(data.filename) || '.jpg';
      const filename = `${listingId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filepath = path.join(UPLOADS_DIR, filename);

      // Save file to disk
      await pipeline(data.file, fs.createWriteStream(filepath));

      // Save to database
      const url = `/uploads/${filename}`;
      const img = await imageService.createListingImage({
        listingId,
        url,
      });

      return reply.status(201).send(apiData(img));
    }
  );

  // DELETE /api/listings/:listingId/images/:imageId — Delete image
  app.delete(
    '/listings/:listingId/images/:imageId',
    { preHandler: [authenticate, requireVerifiedStudent] },
    async (request, reply) => {
      const { listingId, imageId } = request.params as { listingId: string; imageId: string };

      // Ensure listing exists and caller owns it
      const listing = await listingService.getListing(listingId);
      if (!listing) {
        throw new NotFoundError('Listing not found');
      }
      if (listing.ownerId !== request.userId && request.userRole !== 'ADMIN') {
        throw new ForbiddenError('You do not own this listing');
      }

      // Find the image
      const images = await imageService.getListingImages(listingId);
      const image = images.find(img => img.id === imageId);
      if (!image) {
        throw new NotFoundError('Image not found on this listing');
      }

      // Delete from database
      await imageService.deleteListingImage(imageId);

      // Attempt to delete from disk (ignore errors if file is missing)
      const filename = path.basename(image.url);
      const filepath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath);
        } catch (err) {
          request.log.error(err, 'Failed to delete file from disk');
        }
      }

      return reply.status(200).send(apiData({ success: true }));
    }
  );
}

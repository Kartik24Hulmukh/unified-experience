/**
 * BErozgar — Hospital Service
 *
 * CRUD operations for hospitals (admin-curated directory).
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/errors/index';

export interface CreateHospitalInput {
  name: string;
  type: string;
  address: string;
  distance?: string;
  specialties: string[];
  contactPhone?: string;
  emergencyPhone?: string;
}

export async function listHospitals() {
  return prisma.hospital.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getHospital(id: string) {
  const hospital = await prisma.hospital.findUnique({
    where: { id },
  });
  if (!hospital) {
    throw new NotFoundError('Hospital', id);
  }
  return hospital;
}

export async function createHospital(input: CreateHospitalInput) {
  return prisma.hospital.create({
    data: {
      name: input.name,
      type: input.type,
      address: input.address,
      distance: input.distance,
      specialties: input.specialties,
      contactPhone: input.contactPhone,
      emergencyPhone: input.emergencyPhone,
      isActive: true,
    },
  });
}

export async function updateHospital(id: string, input: Partial<CreateHospitalInput>) {
  const hospital = await getHospital(id);
  return prisma.hospital.update({
    where: { id: hospital.id },
    data: input,
  });
}

export async function deleteHospital(id: string) {
  const hospital = await getHospital(id);
  return prisma.hospital.update({
    where: { id: hospital.id },
    data: { isActive: false },
  });
}

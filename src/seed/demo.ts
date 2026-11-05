import { env } from '../config/env.js';
import argon2 from 'argon2';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../services/db.js';
import { User } from '../models/User.js';
import { DonorProfile } from '../models/DonorProfile.js';
import { BloodRequest } from '../models/BloodRequest.js';
import { nextCode } from '../services/counter.js';

if (!env.SEED_DEMO) {
  throw new Error('Demo seeding is disabled. Set SEED_DEMO=true explicitly.');
}

async function seedDemo(): Promise<void> {
  await connectDatabase();
  const passwordHash = await argon2.hash('demo-password-change-me');
  const domain = env.APP_DOMAIN;
  const requester = await User.findOneAndUpdate(
    { email: `demo.requester@${domain}` },
    {
      $set: {
        name: 'Demo Requester',
        phone: '01700000001',
        passwordHash,
        emailVerified: true,
        status: 'active',
        language: 'bn',
      },
      $setOnInsert: { code: await nextCode('user') },
    },
    { upsert: true, new: true },
  );
  const donor = await User.findOneAndUpdate(
    { email: `demo.donor@${domain}` },
    {
      $set: {
        name: 'Demo Donor',
        phone: '01700000002',
        passwordHash,
        emailVerified: true,
        status: 'active',
        language: 'en',
      },
      $setOnInsert: { code: await nextCode('user') },
    },
    { upsert: true, new: true },
  );
  await DonorProfile.findOneAndUpdate(
    { userId: donor._id },
    {
      $set: {
        userId: donor._id,
        bloodGroup: 'O+',
        division: 'dhaka',
        district: 'Dhaka',
        area: 'Dhanmondi',
        available: true,
        registrationStep: 4,
        registrationCompletedAt: new Date(),
      },
    },
    { upsert: true },
  );
  await BloodRequest.findOneAndUpdate(
    { requesterId: requester._id, patientName: 'Demo Patient' },
    {
      $set: {
        requesterId: requester._id,
        patientName: 'Demo Patient',
        bloodGroup: 'A+',
        units: 1,
        hospitalNameText: 'Dhaka Medical College Hospital',
        division: 'dhaka',
        district: 'Dhaka',
        area: 'Dhanmondi',
        neededBy: new Date(Date.now() + 86400_000),
        priority: 'urgent',
        contactPhone: '01700000001',
        status: 'approved',
        code: await nextCode('request'),
      },
    },
    { upsert: true },
  );
  console.log('Demo seed complete.');
  await disconnectDatabase();
}

seedDemo().catch(async (error: unknown) => {
  console.error('Demo seed failed.', error);
  if (mongoose.connection.readyState !== 0) await disconnectDatabase();
  process.exitCode = 1;
});

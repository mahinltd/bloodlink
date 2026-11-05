import argon2 from 'argon2';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../services/db.js';
import { AppConfig } from '../models/AppConfig.js';
import { AppRelease } from '../models/AppRelease.js';
import { AdminUser } from '../models/AdminUser.js';
import { CmsString } from '../models/CmsString.js';
import { FeatureFlag } from '../models/FeatureFlag.js';
import { GeoArea, GeoDistrict, GeoDivision, Hospital } from '../models/Reference.js';
import { EmailTemplate, NotificationTemplate, ReportReason } from '../models/Template.js';

const divisions = [
  ['barishal', 'বরিশাল', 'Barishal'],
  ['chattogram', 'চট্টগ্রাম', 'Chattogram'],
  ['dhaka', 'ঢাকা', 'Dhaka'],
  ['khulna', 'খুলনা', 'Khulna'],
  ['mymensingh', 'ময়মনসিংহ', 'Mymensingh'],
  ['rajshahi', 'রাজশাহী', 'Rajshahi'],
  ['rangpur', 'রংপুর', 'Rangpur'],
  ['sylhet', 'সিলেট', 'Sylhet'],
] as const;

const districtsByDivision: Record<string, string[]> = {
  barishal: ['Barguna', 'Barishal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'],
  chattogram: [
    'Bandarban',
    'Brahmanbaria',
    'Chandpur',
    'Chattogram',
    'Cumilla',
    'Coxs Bazar',
    'Feni',
    'Khagrachhari',
    'Lakshmipur',
    'Noakhali',
    'Rangamati',
  ],
  dhaka: [
    'Dhaka',
    'Faridpur',
    'Gazipur',
    'Gopalganj',
    'Kishoreganj',
    'Madaripur',
    'Manikganj',
    'Munshiganj',
    'Narayanganj',
    'Narsingdi',
    'Rajbari',
    'Shariatpur',
    'Tangail',
  ],
  khulna: [
    'Bagerhat',
    'Chuadanga',
    'Jashore',
    'Jhenaidah',
    'Khulna',
    'Kushtia',
    'Magura',
    'Meherpur',
    'Narail',
    'Satkhira',
  ],
  mymensingh: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
  rajshahi: [
    'Bogura',
    'Joypurhat',
    'Naogaon',
    'Natore',
    'Chapai Nawabganj',
    'Pabna',
    'Rajshahi',
    'Sirajganj',
  ],
  rangpur: [
    'Dinajpur',
    'Gaibandha',
    'Kurigram',
    'Lalmonirhat',
    'Nilphamari',
    'Panchagarh',
    'Rangpur',
    'Thakurgaon',
  ],
  sylhet: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
};

const hospitals = [
  ['ঢাকা মেডিকেল কলেজ হাসপাতাল', 'Dhaka Medical College Hospital', 'dhaka', 'Dhaka'],
  ['বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয়', 'BSMMU', 'dhaka', 'Dhaka'],
  ['স্কয়ার হাসপাতাল', 'Square Hospital', 'dhaka', 'Dhaka'],
  ['ল্যাবএইড হাসপাতাল ধানমন্ডি', 'Labaid Hospital Dhanmondi', 'dhaka', 'Dhaka'],
  ['ইব্রাহিম কার্ডিয়াক হাসপাতাল', 'Ibrahim Cardiac Hospital', 'dhaka', 'Dhaka'],
  [
    'আনোয়ার খান মডার্ন মেডিকেল কলেজ হাসপাতাল',
    'Anwer Khan Modern Medical College Hospital',
    'dhaka',
    'Dhaka',
  ],
  [
    'চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল',
    'Chattogram Medical College Hospital',
    'chattogram',
    'Chattogram',
  ],
  ['খুলনা মেডিকেল কলেজ হাসপাতাল', 'Khulna Medical College Hospital', 'khulna', 'Khulna'],
  ['রাজশাহী মেডিকেল কলেজ হাসপাতাল', 'Rajshahi Medical College Hospital', 'rajshahi', 'Rajshahi'],
  ['রংপুর মেডিকেল কলেজ হাসপাতাল', 'Rangpur Medical College Hospital', 'rangpur', 'Rangpur'],
  [
    'সিলেট এমএজি ওসমানী মেডিকেল কলেজ হাসপাতাল',
    'Sylhet MAG Osmani Medical College Hospital',
    'sylhet',
    'Sylhet',
  ],
  [
    'বরিশাল শের-ই-বাংলা মেডিকেল কলেজ হাসপাতাল',
    'Sher-e-Bangla Medical College Hospital',
    'barishal',
    'Barishal',
  ],
  [
    'ময়মনসিংহ মেডিকেল কলেজ হাসপাতাল',
    'Mymensingh Medical College Hospital',
    'mymensingh',
    'Mymensingh',
  ],
];

const cmsDefaults = [
  ['common.appName', 'ব্লাডলিংক', 'BloodLink', 'common'],
  ['common.bloodNeverSold', 'রক্ত কখনো বিক্রি হয় না', 'Blood is never sold', 'common'],
  ['common.error', 'দুঃখিত, একটি সমস্যা হয়েছে', 'Sorry, something went wrong', 'common'],
  ['common.retry', 'আবার চেষ্টা করুন', 'Try again', 'common'],
  ['auth.verifyEmail', 'আপনার ইমেইল যাচাই করুন', 'Verify your email', 'auth'],
  ['request.create', 'রক্তের অনুরোধ তৈরি করুন', 'Create blood request', 'requests'],
  [
    'request.safetyDisclaimer',
    'এটি চিকিৎসা পরামর্শ নয়। হাসপাতালের চিকিৎসক সিদ্ধান্ত নেবেন।',
    'This is not medical advice. Hospital staff make the final decision.',
    'requests',
  ],
  [
    'chat.safetyBanner',
    'ব্যক্তিগত নথি, OTP বা টাকা শেয়ার করবেন না।',
    'Do not share personal documents, OTPs, or money.',
    'chat',
  ],
  [
    'support.policy',
    'সহায়তা স্বেচ্ছামূলক এবং রক্তের সঙ্গে যুক্ত নয়।',
    'Support is voluntary and never tied to blood.',
    'support',
  ],
  ['errors.notFound', 'অনুরোধটি পাওয়া যায়নি।', 'The requested resource was not found.', 'errors'],
];

export async function seed(options: { disconnect?: boolean } = {}): Promise<void> {
  await connectDatabase();

  await GeoDivision.bulkWrite(
    divisions.map(([key, bn, en], order) => ({
      updateOne: {
        filter: { key },
        update: { $set: { key, name: { bn, en }, order } },
        upsert: true,
      },
    })),
  );
  for (const [division, names] of Object.entries(districtsByDivision)) {
    await GeoDistrict.bulkWrite(
      names.map((name, order) => {
        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return {
          updateOne: {
            filter: { key },
            update: { $set: { key, division, name: { bn: name, en: name }, order } },
            upsert: true,
          },
        };
      }),
    );
  }
  await GeoArea.updateOne(
    { key: 'dhaka-dhanmondi' },
    {
      $set: {
        key: 'dhaka-dhanmondi',
        district: 'dhaka',
        name: { bn: 'ধানমন্ডি', en: 'Dhanmondi' },
        order: 0,
      },
    },
    { upsert: true },
  );
  await Hospital.bulkWrite(
    hospitals.map((hospital, order) => {
      const [nameBn, nameEn, division, district] = hospital;
      if (!nameBn || !nameEn || !division || !district)
        throw new Error('Hospital seed row is incomplete.');
      return {
        updateOne: {
          filter: { nameEn },
          update: {
            $set: { nameBn, nameEn, division, district, aliases: [nameEn], verified: true, order },
          },
          upsert: true,
        },
      };
    }),
  );

  const config = {
    version: 1,
    status: 'published',
    brand: { ruby: '#B3123F', rose: '#F0466A', teal: '#12B5A6' },
    theme: {
      allowDark: true,
      followSystem: true,
      bnFont: 'Hind Siliguri',
      enFont: 'Inter',
      cardRadius: 20,
      controlRadius: 16,
    },
    safety: {
      supportEmail: env.SUPPORT_EMAIL,
      donationIntervalDays: 120,
      searchRadiusKm: 10,
      urgentRadiusKm: 25,
      matchMode: 'compatible',
      requestAutoPublish: true,
      moneyKeywords: [
        'টাকা',
        'পেমেন্ট',
        'বিকাশ',
        'নগদ',
        'রকেট',
        'দাম',
        'বিক্রি',
        'taka',
        'tk',
        'pay',
        'payment',
        'price',
        'rate',
        'sell',
        'bkash',
        'nagad',
        'rocket',
      ],
      disclaimers: { bn: 'এটি চিকিৎসা সেবা নয়।', en: 'This is not a medical service.' },
    },
    limits: {
      otpTtlSec: 300,
      otpResendSec: 30,
      otpMaxAttempts: 5,
      minAge: 18,
      maxUnits: 10,
      callRingSec: 45,
      audioMaxSec: 180,
      urgentPushPerUserPerDay: 3,
      fanoutCap: 200,
      requestsPerDay: 10,
    },
    contact: { supportEmail: env.SUPPORT_EMAIL },
  };
  await AppConfig.updateOne(
    { version: 1, status: 'published' },
    { $set: config },
    { upsert: true },
  );
  await AppRelease.updateOne(
    { versionCode: 1 },
    {
      $setOnInsert: {
        versionCode: 1,
        versionName: '1.0.0',
        channel: 'stable',
        status: 'draft',
        apkUrl: 'https://example.invalid/bloodlink.apk',
        minSupportedVersionCode: 1,
        rolloutPercent: 100,
        mandatory: false,
        notes: { bn: '', en: '' },
      },
    },
    { upsert: true },
  );

  const flags = [
    ['nearby_requests', true, 100],
    ['in_app_calls', true, 25],
    ['donation_reminders', true, 100],
    ['support_payments', false, 10],
    ['new_profile_layout', false, 0],
  ] as const;
  await FeatureFlag.bulkWrite(
    flags.map(([key, enabled, rolloutPercent]) => ({
      updateOne: {
        filter: { key, environment: env.APP_ENV },
        update: {
          $set: {
            key,
            titleBn: key,
            titleEn: key,
            description: key,
            environment: env.APP_ENV,
            enabled,
            rolloutPercent,
          },
        },
        upsert: true,
      },
    })),
  );

  const reasons = [
    ['money_demand', 'টাকা দাবি', 'Money demand', 'high'],
    ['fake_or_misleading', 'ভুয়া বা বিভ্রান্তিকর', 'Fake or misleading', 'normal'],
    ['harassment', 'হয়রানি', 'Harassment', 'normal'],
    ['spam_other', 'স্প্যাম বা অন্যান্য', 'Spam or other', 'low'],
  ] as const;
  await ReportReason.bulkWrite(
    reasons.map(([key, bn, en, priority], order) => ({
      updateOne: {
        filter: { key },
        update: {
          $set: { key, label: { bn, en }, defaultPriority: priority, active: true, order },
        },
        upsert: true,
      },
    })),
  );
  await NotificationTemplate.updateOne(
    { key: 'app_news' },
    {
      $set: {
        key: 'app_news',
        title: { bn: 'নতুন খবর', en: 'App news' },
        body: { bn: 'BloodLink-এ নতুন আপডেট এসেছে।', en: 'There is a new BloodLink update.' },
        active: true,
      },
    },
    { upsert: true },
  );
  await EmailTemplate.updateOne(
    { key: 'verify_email' },
    {
      $set: {
        key: 'verify_email',
        subject: { bn: 'ইমেইল যাচাই করুন', en: 'Verify your email' },
        html: { bn: 'আপনার কোড: {code}', en: 'Your code: {code}' },
      },
    },
    { upsert: true },
  );
  await EmailTemplate.bulkWrite(
    [
      {
        key: 'reset_password',
        subject: { bn: 'পাসওয়ার্ড পরিবর্তন করুন', en: 'Reset your password' },
        html: {
          bn: 'আপনার পাসওয়ার্ড পরিবর্তনের কোড: {code}',
          en: 'Your password reset code is: {code}',
        },
      },
      {
        key: 'admin_2fa',
        subject: { bn: 'অ্যাডমিন যাচাইকরণ কোড', en: 'Admin verification code' },
        html: {
          bn: 'আপনার অ্যাডমিন যাচাইকরণ কোড: {code}',
          en: 'Your admin verification code is: {code}',
        },
      },
    ].map((template) => ({
      updateOne: {
        filter: { key: template.key },
        update: { $set: { ...template, active: true } },
        upsert: true,
      },
    })),
  );
  await CmsString.bulkWrite(
    cmsDefaults.map((item) => {
      const [key, bn, en, screen] = item;
      if (!key || !bn || !en || !screen) throw new Error('CMS seed row is incomplete.');
      return {
        updateOne: {
          filter: { key },
          update: { $set: { key, bn, en, screen, status: 'published', version: 1 } },
          upsert: true,
        },
      };
    }),
  );

  const passwordHash = await argon2.hash(env.FIRST_SUPERADMIN_PASSWORD);
  await AdminUser.updateOne(
    { email: env.FIRST_SUPERADMIN_EMAIL.toLowerCase() },
    {
      $setOnInsert: {
        email: env.FIRST_SUPERADMIN_EMAIL.toLowerCase(),
        name: 'BloodLink Admin',
        role: 'super_admin',
        passwordHash,
        status: 'active',
      },
    },
    { upsert: true },
  );
  console.log('Base seed complete.');
  if (options.disconnect !== false) await disconnectDatabase();
}

if (process.argv[1]?.endsWith('base.ts')) {
  seed().catch(async (error: unknown) => {
    console.error('Base seed failed.', error);
    if (mongoose.connection.readyState !== 0) await disconnectDatabase();
    process.exitCode = 1;
  });
}

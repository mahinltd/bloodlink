import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AppRelease } from '../../models/AppRelease.js';
import { CmsString } from '../../models/CmsString.js';
import { getPublishedSettings } from '../../services/settings.js';
import { env } from '../../config/env.js';

const router = Router();

router.get('/strings', async (req, res, next) => {
  try {
    const lang = z.enum(['bn', 'en']).catch('bn').parse(req.query.lang);
    const strings =
      mongoose.connection.readyState === 1
        ? await CmsString.find({ status: 'published' }).lean()
        : [];
    const version = strings.reduce((max, item) => Math.max(max, item.version), 0);
    const etag = `"strings-${version}-${lang}"`;
    res.setHeader('ETag', etag);
    if (req.header('if-none-match') === etag) return res.status(304).end();
    const values: Record<string, string> = {};
    for (const string of strings) values[string.key] = lang === 'bn' ? string.bn : string.en;
    res.json({ success: true, data: { version, strings: values }, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.get('/config', async (_req, res, next) => {
  try {
    const settings = await getPublishedSettings(env.APP_ENV);
    res.json({ success: true, data: settings.config, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.get('/flags', async (_req, res, next) => {
  try {
    const settings = await getPublishedSettings(env.APP_ENV);
    res.json({ success: true, data: settings.flags, meta: {} });
  } catch (error) {
    next(error);
  }
});

router.get('/update/check', async (req, res, next) => {
  try {
    const input = z
      .object({
        versionCode: z.coerce.number().int().min(0),
        channel: z.enum(['stable', 'beta']).default('stable'),
        deviceId: z.string().min(1),
      })
      .parse(req.query);
    const latest =
      mongoose.connection.readyState === 1
        ? await AppRelease.findOne({ channel: input.channel, status: 'published' })
            .sort({ versionCode: -1 })
            .lean()
        : null;
    const blocked = Boolean(latest && input.versionCode < (latest.minSupportedVersionCode ?? 0));
    const rollout = latest
      ? hashPercent(`${input.deviceId}:${latest.versionCode}`) <
        (latest.mandatory ? 100 : (latest.rolloutPercent ?? 0))
      : false;
    res.json({
      success: true,
      data: {
        updateAvailable: Boolean(
          latest && input.versionCode < latest.versionCode && (rollout || blocked),
        ),
        mandatory: Boolean(latest?.mandatory),
        blocked,
        latest: latest
          ? {
              versionCode: latest.versionCode,
              versionName: latest.versionName,
              apkUrl: latest.apkUrl,
              sha256: latest.apkSha256,
              sizeBytes: latest.apkSizeBytes,
              signerCertSha256: latest.signerCertSha256,
              notes: latest.notes,
              publishedAt: latest.publishedAt,
            }
          : null,
        minSupportedVersionCode: latest?.minSupportedVersionCode ?? 0,
      },
      meta: {},
    });
  } catch (error) {
    next(error);
  }
});

router.post('/update/events', async (req, res, next) => {
  try {
    const input = z
      .object({
        versionCode: z.number().int().nonnegative(),
        deviceId: z.string().min(1),
        event: z.enum(['seen', 'download_started', 'downloaded', 'installed', 'failed']),
        error: z.string().max(300).optional(),
      })
      .parse(req.body);
    if (mongoose.connection.readyState === 1) {
      const field =
        input.event === 'downloaded'
          ? 'downloads'
          : input.event === 'installed'
            ? 'installs'
            : input.event === 'failed'
              ? 'failures'
              : null;
      if (field)
        await AppRelease.updateOne({ versionCode: input.versionCode }, { $inc: { [field]: 1 } });
    }
    res.status(202).json({ success: true, data: { accepted: true }, meta: {} });
  } catch (error) {
    next(error);
  }
});

function hashPercent(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 100;
}

export default router;

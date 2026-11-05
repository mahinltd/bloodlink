import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { pinoHttp } from 'pino-http';
import { env, corsOrigins } from './config/env.js';
import { API_PREFIX, API_VERSION, HEALTH_PATH } from './config/constants.js';
import { errorHandler, notFound } from './middleware/error.js';
import { requestId } from './middleware/requestId.js';
import { databaseStatus } from './services/db.js';
import { getPublishedSettings } from './services/settings.js';
import { AppRelease } from './models/AppRelease.js';
import mongoose from 'mongoose';
import authRoutes from './modules/auth/routes.js';
import appRoutes from './modules/app/routes.js';
import geoRoutes from './modules/geo/routes.js';
import donorRoutes from './modules/donors/routes.js';
import requestRoutes from './modules/requests/routes.js';
import chatRoutes from './modules/chat/routes.js';
import uploadRoutes from './modules/uploads/routes.js';
import callRoutes from './modules/calls/routes.js';
import communityRoutes from './modules/community/routes.js';
import adminRoutes from './modules/admin/routes.js';
import publicRoutes from './modules/public/routes.js';
import jobRoutes from './modules/jobs/routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(mongoSanitize());
  app.use(requestId);
  app.use(pinoHttp());

  app.get(HEALTH_PATH, (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'bloodlink-backend',
        version: API_VERSION,
        database: databaseStatus(),
      },
      meta: { serverTime: new Date().toISOString() },
    });
  });

  app.get(`${API_PREFIX}/app/bootstrap`, async (req, res, next) => {
    try {
      const settings = await getPublishedSettings(env.APP_ENV);
      const versionCode = Number(req.query.versionCode ?? 0);
      const channel = req.query.channel === 'beta' ? 'beta' : 'stable';
      const latest =
        mongoose.connection.readyState === 1
          ? await AppRelease.findOne({ channel, status: 'published' })
              .sort({ versionCode: -1 })
              .lean()
          : null;
      res.status(200).json({
        success: true,
        data: {
          config: settings.config,
          flags: settings.flags,
          stringsVersion: settings.stringsVersion,
          minVersionCode: latest?.minSupportedVersionCode ?? 0,
          forceUpdate: Boolean(latest && versionCode < (latest.minSupportedVersionCode ?? 0)),
          update: latest
            ? {
                updateAvailable: versionCode < latest.versionCode,
                mandatory: latest.mandatory,
                blocked: versionCode < (latest.minSupportedVersionCode ?? 0),
                latest: {
                  versionCode: latest.versionCode,
                  versionName: latest.versionName,
                  apkUrl: latest.apkUrl,
                  sha256: latest.apkSha256,
                  sizeBytes: latest.apkSizeBytes,
                  signerCertSha256: latest.signerCertSha256,
                  notes: latest.notes,
                  publishedAt: latest.publishedAt,
                },
              }
            : null,
          serverTime: new Date().toISOString(),
        },
        meta: { strings: settings.strings },
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/app`, appRoutes);
  app.use(`${API_PREFIX}/geo`, geoRoutes);
  app.use(`${API_PREFIX}`, donorRoutes);
  app.use(`${API_PREFIX}/requests`, requestRoutes);
  app.use(`${API_PREFIX}`, chatRoutes);
  app.use(`${API_PREFIX}/uploads`, uploadRoutes);
  app.use(`${API_PREFIX}/calls`, callRoutes);
  app.use(`${API_PREFIX}`, communityRoutes);
  app.use(`${API_PREFIX}/admin`, adminRoutes);
  app.use(`${API_PREFIX}`, publicRoutes);
  app.use('/internal/jobs', jobRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();

export { env };

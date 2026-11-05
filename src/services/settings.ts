import { AppConfig } from '../models/AppConfig.js';
import { CmsString } from '../models/CmsString.js';
import { FeatureFlag } from '../models/FeatureFlag.js';
import mongoose from 'mongoose';

type SettingsCache = {
  expiresAt: number;
  config: Record<string, unknown> | null;
  strings: Record<string, string>;
  stringsVersion: number;
  flags: Record<string, { enabled: boolean; rolloutPercent: number }>;
};

let cache: SettingsCache | null = null;
const cacheDurationMs = 60_000;

export function clearSettingsCache(): void {
  cache = null;
}

export async function getPublishedSettings(environment: string): Promise<SettingsCache> {
  if (cache && cache.expiresAt > Date.now()) return cache;
  if (mongoose.connection.readyState !== 1) {
    return {
      expiresAt: Date.now() + cacheDurationMs,
      config: null,
      strings: {},
      stringsVersion: 0,
      flags: {},
    };
  }

  const [config, strings, flags] = await Promise.all([
    AppConfig.findOne({ status: 'published' }).sort({ version: -1 }).lean(),
    CmsString.find({ status: 'published' }).lean(),
    FeatureFlag.find({ environment }).lean(),
  ]);
  const stringMap: Record<string, string> = {};
  for (const string of strings) stringMap[string.key] = string.en;
  const flagMap: SettingsCache['flags'] = {};
  for (const flag of flags)
    flagMap[flag.key] = { enabled: flag.enabled, rolloutPercent: flag.rolloutPercent };
  cache = {
    expiresAt: Date.now() + cacheDurationMs,
    config: config ? (config as unknown as Record<string, unknown>) : null,
    strings: stringMap,
    stringsVersion: strings.reduce((version, item) => Math.max(version, item.version), 0),
    flags: flagMap,
  };
  return cache;
}

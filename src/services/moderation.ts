import { getPublishedSettings } from './settings.js';
import { env } from '../config/env.js';

const fallbackKeywords = [
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
];
export async function scanMoneyKeywords(text: string): Promise<string[]> {
  const settings = await getPublishedSettings(env.APP_ENV);
  const config = settings.config as { safety?: { moneyKeywords?: unknown } } | null;
  const configured = Array.isArray(config?.safety?.moneyKeywords)
    ? config.safety.moneyKeywords.filter((item): item is string => typeof item === 'string')
    : fallbackKeywords;
  const lower = text.toLocaleLowerCase();
  return configured.filter((keyword) => lower.includes(keyword.toLocaleLowerCase()));
}

import mongoose from 'mongoose';
import { env } from '../config/env.js';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: env.NODE_ENV !== 'production',
  });
}

export function databaseStatus(): 'connected' | 'connecting' | 'disconnected' | 'disconnecting' {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'] as const;
  const state = states[mongoose.connection.readyState as 0 | 1 | 2 | 3];
  return state ?? 'disconnected';
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

import { v2 as cloudinary } from 'cloudinary';
import admin from 'firebase-admin';
import { Resend } from 'resend';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import { env } from '../config/env.js';

export type MailMessage = { to: string; subject: string; html: string };
export type PushMessage = {
  tokens: string[];
  data: Record<string, string>;
  title?: string;
  body?: string;
};
export type UploadSignature = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
};
export type CallToken = { appId: string; channel: string; uid: number; token: string };

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
export interface Pusher {
  send(message: PushMessage): Promise<void>;
}
export interface Storage {
  signUpload(userId: string, purpose: string, timestamp?: number): Promise<UploadSignature>;
}
export interface Caller {
  token(channel: string, uid: number, ttlSeconds: number): Promise<CallToken>;
}

export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.info('[mail:console]', { to: message.to, subject: message.subject });
  }
}

export class ResendMailer implements Mailer {
  private readonly client = new Resend(env.RESEND_API_KEY);
  async send(message: MailMessage): Promise<void> {
    const result = await this.client.emails.send({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      replyTo: env.SUPPORT_EMAIL,
    });
    if (result.error) throw new Error(`Resend failed: ${result.error.message}`);
  }
}

export class ConsolePusher implements Pusher {
  async send(message: PushMessage): Promise<void> {
    console.info('[push:console]', { tokenCount: message.tokens.length, data: message.data });
  }
}

export class FcmPusher implements Pusher {
  async send(message: PushMessage): Promise<void> {
    if (!admin.apps.length) {
      const credential = JSON.parse(
        env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
      ) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(credential) });
    }
    const payload: admin.messaging.MulticastMessage = {
      tokens: message.tokens,
      data: message.data,
    };
    if (message.title && message.body)
      payload.notification = { title: message.title, body: message.body };
    await admin.messaging().sendEachForMulticast(payload);
  }
}

export class StubStorage implements Storage {
  async signUpload(userId: string, purpose: string): Promise<UploadSignature> {
    console.info('[storage:stub]', { userId, purpose });
    return {
      timestamp: Math.floor(Date.now() / 1000),
      signature: 'stub',
      apiKey: 'stub',
      cloudName: 'stub',
      folder: `bloodlink/${purpose}/${userId}`,
    };
  }
}

export class CloudinaryStorage implements Storage {
  constructor() {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME!,
      api_key: env.CLOUDINARY_API_KEY!,
      api_secret: env.CLOUDINARY_API_SECRET!,
    });
  }
  async signUpload(
    userId: string,
    purpose: string,
    timestamp = Math.floor(Date.now() / 1000),
  ): Promise<UploadSignature> {
    const folder = `bloodlink/${purpose}/${userId}`;
    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp },
      env.CLOUDINARY_API_SECRET ?? '',
    );
    return {
      timestamp,
      signature,
      apiKey: env.CLOUDINARY_API_KEY ?? '',
      cloudName: env.CLOUDINARY_CLOUD_NAME ?? '',
      folder,
    };
  }
}

export class StubCaller implements Caller {
  async token(channel: string, uid: number, ttlSeconds: number): Promise<CallToken> {
    console.info('[call:stub]', { channel, uid, ttlSeconds });
    return { appId: 'stub', channel, uid, token: 'stub' };
  }
}

export class AgoraCaller implements Caller {
  async token(channel: string, uid: number, ttlSeconds: number): Promise<CallToken> {
    const token = RtcTokenBuilder.buildTokenWithUid(
      env.AGORA_APP_ID ?? '',
      env.AGORA_APP_CERTIFICATE ?? '',
      channel,
      uid,
      RtcRole.PUBLISHER,
      ttlSeconds,
      ttlSeconds,
    );
    return { appId: env.AGORA_APP_ID ?? '', channel, uid, token };
  }
}

export function createDrivers(): {
  mailer: Mailer;
  pusher: Pusher;
  storage: Storage;
  caller: Caller;
} {
  return {
    mailer: env.MAIL_DRIVER === 'resend' ? new ResendMailer() : new ConsoleMailer(),
    pusher: env.PUSH_DRIVER === 'fcm' ? new FcmPusher() : new ConsolePusher(),
    storage: env.STORAGE_DRIVER === 'cloudinary' ? new CloudinaryStorage() : new StubStorage(),
    caller: env.CALL_DRIVER === 'agora' ? new AgoraCaller() : new StubCaller(),
  };
}

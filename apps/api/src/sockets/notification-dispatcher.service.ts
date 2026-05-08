import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

import { SERVER_EVENTS, ROOMS, NotificationPayload } from './events';

export interface SendNotificationOptions {
  /** Socket room to push in-app notification to (e.g. rider:xxx or driver:xxx) */
  room:       string;
  /** FCM device token, if available */
  fcmToken?:  string;
  type:       string;
  title:      string;
  body:       string;
  data?:      Record<string, string>;
}

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private server: Server;

  constructor(private readonly config: ConfigService) {}

  setServer(server: Server) {
    this.server = server;
  }

  async send(opts: SendNotificationOptions): Promise<void> {
    const payload: NotificationPayload = {
      id:    uuidv4(),
      type:  opts.type,
      title: opts.title,
      body:  opts.body,
      data:  opts.data,
      ts:    new Date().toISOString(),
    };

    // In-app push via Socket.IO (works when client is connected)
    this.server?.to(opts.room).emit(SERVER_EVENTS.NOTIFICATION_PUSH, payload);

    // FCM push for background / offline clients
    if (opts.fcmToken) {
      await this.sendFcm(opts.fcmToken, opts.title, opts.body, opts.data).catch((err) =>
        this.logger.warn(`FCM delivery failed for ${opts.room}: ${err.message}`),
      );
    }
  }

  /** Convenience: notify a rider (in-app + FCM) */
  async notifyRider(
    riderId: string,
    fcmToken: string | undefined,
    type: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await this.send({ room: ROOMS.rider(riderId), fcmToken, type, title, body, data });
  }

  /** Convenience: notify a driver (in-app + FCM) */
  async notifyDriver(
    driverId: string,
    fcmToken: string | undefined,
    type: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await this.send({ room: ROOMS.driver(driverId), fcmToken, type, title, body, data });
  }

  private async sendFcm(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      apns:    { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  }
}

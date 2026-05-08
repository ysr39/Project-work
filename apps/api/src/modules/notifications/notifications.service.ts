import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface PushPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: admin.app.App;

  constructor(private readonly config: ConfigService) {
    if (!admin.apps.length) {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.get('FIREBASE_PROJECT_ID'),
          privateKey: config.get<string>('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
          clientEmail: config.get('FIREBASE_CLIENT_EMAIL'),
        }),
      });
    } else {
      this.firebaseApp = admin.app();
    }
  }

  async sendPush(payload: PushPayload): Promise<void> {
    try {
      await this.firebaseApp.messaging().send({
        token: payload.token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (err) {
      this.logger.warn(`FCM push failed: ${err.message}`);
    }
  }

  async sendMulticast(tokens: string[], title: string, body: string, data?: Record<string, string>) {
    if (!tokens.length) return;
    try {
      await this.firebaseApp.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data ?? {},
      });
    } catch (err) {
      this.logger.warn(`FCM multicast failed: ${err.message}`);
    }
  }

  // Notification event helpers
  async notifyDriverNewTrip(token: string, tripId: string, fare: number) {
    await this.sendPush({
      token,
      title: 'New ride request!',
      body: `Pool ride available — ₹${fare} estimated. Tap to accept.`,
      data: { type: 'TRIP_REQUEST', tripId },
    });
  }

  async notifyRiderDriverMatched(token: string, driverName: string, eta: number) {
    await this.sendPush({
      token,
      title: 'Driver matched!',
      body: `${driverName} is on the way — arriving in ~${Math.round(eta)} min`,
      data: { type: 'TRIP_MATCHED' },
    });
  }

  async notifyRiderDriverArrived(token: string) {
    await this.sendPush({
      token,
      title: 'Your driver has arrived!',
      body: 'Please proceed to the pickup point.',
      data: { type: 'DRIVER_ARRIVED' },
    });
  }

  async notifyTripComplete(token: string, fare: number) {
    await this.sendPush({
      token,
      title: 'Trip completed',
      body: `Fare: ₹${fare}. Thank you for riding with TaxiPool!`,
      data: { type: 'TRIP_COMPLETED' },
    });
  }
}

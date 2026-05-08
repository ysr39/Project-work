import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly redis: Redis;
  private readonly otpLength: number;
  private readonly otpExpirySeconds: number;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: config.get('redis.host'),
      port: config.get('redis.port'),
      password: config.get('redis.password'),
    });
    this.otpLength = config.get<number>('OTP_LENGTH', 6);
    this.otpExpirySeconds = config.get<number>('OTP_EXPIRY_SECONDS', 300);
  }

  generate(): string {
    const max = Math.pow(10, this.otpLength);
    const min = Math.pow(10, this.otpLength - 1);
    return (crypto.randomInt(min, max)).toString();
  }

  private key(phone: string): string {
    return `otp:${phone}`;
  }

  private attemptKey(phone: string): string {
    return `otp:attempts:${phone}`;
  }

  async store(phone: string, otp: string): Promise<void> {
    await this.redis.setex(this.key(phone), this.otpExpirySeconds, otp);
    await this.redis.del(this.attemptKey(phone));
  }

  async verify(phone: string, otp: string): Promise<boolean> {
    const attempts = await this.redis.incr(this.attemptKey(phone));
    if (attempts > 5) return false; // brute-force guard

    const stored = await this.redis.get(this.key(phone));
    if (!stored || stored !== otp) return false;

    // consume OTP — single use
    await this.redis.del(this.key(phone));
    await this.redis.del(this.attemptKey(phone));
    return true;
  }
}

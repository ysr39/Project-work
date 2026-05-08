import { BadRequestException, Injectable } from '@nestjs/common';
import { TripStatus, TRIP_TRANSITIONS } from '../../common/constants/trip-status.enum';

@Injectable()
export class TripFsmService {
  isValidTransition(from: TripStatus, to: TripStatus): boolean {
    return TRIP_TRANSITIONS[from]?.includes(to) ?? false;
  }

  assertTransition(from: TripStatus, to: TripStatus): void {
    if (!this.isValidTransition(from, to)) {
      throw new BadRequestException(
        `Invalid trip status transition: ${from} → ${to}`,
      );
    }
  }

  getTimestampField(status: TripStatus): string | null {
    const map: Partial<Record<TripStatus, string>> = {
      [TripStatus.MATCHED]: 'matchedAt',
      [TripStatus.ARRIVED]: 'driverArrivedAt',
      [TripStatus.IN_PROGRESS]: 'startedAt',
      [TripStatus.COMPLETED]: 'completedAt',
      [TripStatus.CANCELLED]: 'cancelledAt',
    };
    return map[status] ?? null;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Payment } from '../payments/entities/payment.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';
import { TripStatus } from '../../common/constants/trip-status.enum';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
    private readonly driversService: DriversService,
    private readonly usersService: UsersService,
  ) {}

  async getDashboardKpis() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalDrivers,
      activeTrips,
      completedToday,
      onlineDrivers,
    ] = await Promise.all([
      this.userRepo.count({ where: { deletedAt: IsNull() } }),
      this.driverRepo.count(),
      this.tripRepo.count({
        where: [
          { status: TripStatus.SEARCHING },
          { status: TripStatus.MATCHED },
          { status: TripStatus.ARRIVING },
          { status: TripStatus.IN_PROGRESS },
        ],
      }),
      this.tripRepo.count({ where: { status: TripStatus.COMPLETED } }),
      this.driverRepo.count({ where: { isOnline: true } }),
    ]);

    const revenueResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.created_at >= :today', { today })
      .getRawOne();

    return {
      totalUsers,
      totalDrivers,
      activeTrips,
      completedToday,
      onlineDrivers,
      revenueToday: parseFloat(revenueResult?.total ?? '0'),
    };
  }

  async getAllTrips(dto: PaginationDto) {
    const [data, total] = await this.tripRepo.findAndCount({
      relations: ['driver', 'passengers'],
      skip: dto.skip,
      take: dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async approveDriver(driverId: string, adminId: string) {
    return this.driversService.approve(driverId, adminId);
  }

  async rejectDriver(driverId: string, adminId: string, reason: string) {
    return this.driversService.reject(driverId, adminId, reason);
  }

  async getPendingDrivers(dto: PaginationDto) {
    return this.driversService.findPendingApprovals(dto);
  }

  async suspendUser(userId: string) {
    return this.usersService.suspend(userId);
  }

  async banUser(userId: string) {
    return this.usersService.ban(userId);
  }

  async reinstateUser(userId: string) {
    return this.usersService.reinstate(userId);
  }

  async getRevenueReport(from: Date, to: Date) {
    return this.paymentRepo
      .createQueryBuilder('p')
      .select("DATE_TRUNC('day', p.created_at)", 'date')
      .addSelect('SUM(p.amount)', 'revenue')
      .addSelect('COUNT(*)', 'transactions')
      .where('p.created_at BETWEEN :from AND :to', { from, to })
      .groupBy("DATE_TRUNC('day', p.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();
  }
}

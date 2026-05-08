import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { RiderProfile } from './entities/rider-profile.entity';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { UserStatus } from '../../common/constants/roles.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RiderProfile) private readonly riderRepo: Repository<RiderProfile>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone, deletedAt: IsNull() } });
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    const riderProfile = await this.riderRepo.findOne({ where: { userId } });
    return { user, riderProfile };
  }

  async updateProfile(userId: string, dto: UpdateRiderDto) {
    await this.findById(userId);

    if (dto.fullName || dto.email) {
      await this.userRepo.update(userId, {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.email && { email: dto.email }),
      });
    }

    if (dto.emergencyContactName || dto.emergencyContactPhone) {
      await this.riderRepo.update(
        { userId },
        {
          ...(dto.emergencyContactName && { emergencyContactName: dto.emergencyContactName }),
          ...(dto.emergencyContactPhone && {
            emergencyContactPhone: dto.emergencyContactPhone,
          }),
        },
      );
    }

    return this.getProfile(userId);
  }

  async findAll(dto: PaginationDto) {
    const [data, total] = await this.userRepo.findAndCount({
      where: { deletedAt: IsNull() },
      skip: dto.skip,
      take: dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async suspend(userId: string): Promise<void> {
    await this.findById(userId);
    await this.userRepo.update(userId, { status: UserStatus.SUSPENDED });
  }

  async ban(userId: string): Promise<void> {
    await this.findById(userId);
    await this.userRepo.update(userId, { status: UserStatus.BANNED });
  }

  async reinstate(userId: string): Promise<void> {
    await this.findById(userId);
    await this.userRepo.update(userId, { status: UserStatus.ACTIVE });
  }

  async softDelete(userId: string): Promise<void> {
    await this.findById(userId);
    await this.userRepo.softDelete(userId);
  }
}

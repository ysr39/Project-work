import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DriverProfile } from './entities/driver-profile.entity';
import { Vehicle } from './entities/vehicle.entity';
import { DriverDocument } from './entities/driver-document.entity';
import { OnboardDriverDto } from './dto/onboard-driver.dto';
import { ToggleOnlineDto } from './dto/toggle-online.dto';
import { DriverApprovalStatus, DocumentStatus } from '../../common/constants/roles.enum';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(DriverDocument) private readonly docRepo: Repository<DriverDocument>,
  ) {}

  async onboard(userId: string, dto: OnboardDriverDto) {
    let driver = await this.driverRepo.findOne({ where: { userId } });
    if (!driver) {
      driver = this.driverRepo.create({ userId });
    }

    driver.licenseNumber = dto.licenseNumber;
    driver.licenseExpiry = new Date(dto.licenseExpiry);
    await this.driverRepo.save(driver);

    const existing = await this.vehicleRepo.findOne({
      where: { driverId: driver.id, isActive: true },
    });
    if (!existing) {
      await this.vehicleRepo.save(
        this.vehicleRepo.create({
          driverId: driver.id,
          make: dto.vehicleMake,
          model: dto.vehicleModel,
          year: dto.vehicleYear,
          color: dto.vehicleColor,
          plateNumber: dto.plateNumber,
          vehicleType: dto.vehicleType,
          capacity: 4,
          registrationNumber: dto.registrationNumber,
          insuranceExpiry: new Date(dto.insuranceExpiry),
        }),
      );
    }

    return this.getFullProfile(userId);
  }

  async getFullProfile(userId: string) {
    const driver = await this.driverRepo.findOne({
      where: { userId },
      relations: ['vehicles', 'documents'],
    });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  async toggleOnline(userId: string, dto: ToggleOnlineDto) {
    const driver = await this.driverRepo.findOne({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    if (driver.approvalStatus !== DriverApprovalStatus.APPROVED) {
      throw new ForbiddenException('Driver account not approved yet');
    }
    await this.driverRepo.update(driver.id, { isOnline: dto.isOnline });
    return { isOnline: dto.isOnline };
  }

  async getOnlineDriversNearby(lat: number, lng: number, radiusKm = 5): Promise<DriverProfile[]> {
    return this.driverRepo
      .createQueryBuilder('d')
      .where(
        `ST_DWithin(
          d.current_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radius
        )`,
        { lat, lng, radius: radiusKm * 1000 },
      )
      .andWhere('d.is_online = true')
      .andWhere('d.approval_status = :status', { status: DriverApprovalStatus.APPROVED })
      .getMany();
  }

  async findPendingApprovals(dto: PaginationDto) {
    const [data, total] = await this.driverRepo.findAndCount({
      where: { approvalStatus: DriverApprovalStatus.PENDING },
      relations: ['user', 'documents'],
      skip: dto.skip,
      take: dto.limit,
      order: { createdAt: 'ASC' },
    });
    return paginate(data, total, dto);
  }

  async approve(driverId: string, adminId: string) {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const docs = await this.docRepo.find({ where: { driverId } });
    const allApproved = docs.every((d) => d.status === DocumentStatus.APPROVED);
    if (!allApproved) {
      throw new BadRequestException('All documents must be approved first');
    }

    await this.driverRepo.update(driverId, {
      approvalStatus: DriverApprovalStatus.APPROVED,
      approvedBy: adminId,
      approvedAt: new Date(),
    });
    return this.driverRepo.findOne({ where: { id: driverId }, relations: ['user'] });
  }

  async reject(driverId: string, adminId: string, reason: string) {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    await this.driverRepo.update(driverId, {
      approvalStatus: DriverApprovalStatus.REJECTED,
      approvedBy: adminId,
      rejectionReason: reason,
    });
  }

  async approveDocument(docId: string, adminId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.docRepo.update(docId, {
      status: DocumentStatus.APPROVED,
      verifiedBy: adminId,
      verifiedAt: new Date(),
    });
  }

  async rejectDocument(docId: string, adminId: string, reason: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.docRepo.update(docId, {
      status: DocumentStatus.REJECTED,
      verifiedBy: adminId,
      rejectionReason: reason,
    });
  }
}

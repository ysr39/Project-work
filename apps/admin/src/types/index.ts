export type UserRole   = 'RIDER' | 'DRIVER' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED'

export type DriverApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type TripStatus =
  | 'SEARCHING' | 'MATCHED' | 'ARRIVING' | 'ARRIVED'
  | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type PaymentStatus = 'PENDING' | 'CAPTURED' | 'REFUNDED' | 'FAILED'

export interface User {
  id:              string
  phone:           string
  fullName:        string | null
  email:           string | null
  role:            UserRole
  status:          UserStatus
  isPhoneVerified: boolean
  createdAt:       string
  riderProfile?: {
    ratingAvg:   number
    totalTrips:  number
  }
}

export interface DriverProfile {
  id:             string
  userId:         string
  approvalStatus: DriverApprovalStatus
  isOnline:       boolean
  ratingAvg:      number
  totalTrips:     number
  licenseNumber:  string
  user: {
    id:       string
    phone:    string
    fullName: string | null
    status:   UserStatus
  }
  vehicle?: {
    make:        string
    model:       string
    plateNumber: string
    vehicleType: string
    capacity:    number
  }
  documents?: Array<{
    id:           string
    documentType: string
    fileUrl:      string
    status:       'PENDING' | 'APPROVED' | 'REJECTED'
  }>
}

export interface Trip {
  id:             string
  tripType:       'POOL' | 'SOLO'
  status:         TripStatus
  pickupAddress:  string
  dropoffAddress: string
  pickupLat:      number
  pickupLng:      number
  dropoffLat:     number
  dropoffLng:     number
  totalFare:      number
  totalSeats:     number
  seatsFilled:    number
  driverId:       string | null
  createdAt:      string
  completedAt:    string | null
  passengers: Array<{
    id:       string
    riderId:  string
    status:   string
    finalFare: number
    rider: { fullName: string | null; phone: string }
  }>
  driver?: {
    user: { fullName: string | null; phone: string }
    vehicle: { plateNumber: string; make: string; model: string }
  }
}

export interface Payment {
  id:                    string
  tripId:                string
  riderId:               string
  amount:                number
  status:                PaymentStatus
  stripePaymentIntentId: string
  refundAmount:          number | null
  createdAt:             string
  rider?: { fullName: string | null; phone: string }
}

export interface KpiData {
  totalUsers:       number
  totalDrivers:     number
  activeTrips:      number
  completedToday:   number
  revenueToday:     number
  revenueThisWeek:  number
  revenueThisMonth: number
  pendingApprovals: number
  avgRating:        number
  cancellationRate: number
}

export interface RevenuePoint {
  date:     string
  revenue:  number
  trips:    number
}

export interface PaginatedResponse<T> {
  data:  T[]
  total: number
  page:  number
  limit: number
}

export interface ApiResponse<T> {
  status: 'success' | 'error'
  data:   T
}

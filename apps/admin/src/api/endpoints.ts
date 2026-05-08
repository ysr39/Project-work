export const EP = {
  // Auth
  login:   '/auth/verify-otp',
  refresh: '/auth/refresh',
  logout:  '/auth/logout',

  // Admin
  dashboard:        '/admin/dashboard',
  revenueReport:    '/admin/reports/revenue',
  adminTrips:       '/admin/trips',

  // Users
  users:            '/users',
  suspendUser: (id: string)   => `/admin/users/${id}/suspend`,
  banUser:     (id: string)   => `/admin/users/${id}/ban`,
  reinstateUser:(id: string)  => `/admin/users/${id}/reinstate`,

  // Drivers
  pendingDrivers:   '/admin/drivers/pending',
  approveDriver:(id: string)  => `/admin/drivers/${id}/approve`,
  rejectDriver: (id: string)  => `/admin/drivers/${id}/reject`,

  // Payments
  payments:         '/payments/history',
  refund:  (id: string)       => `/payments/${id}/refund`,
} as const

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteResult {
  distanceKm: number;
  durationMin: number;
  polyline: string;
}

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('GOOGLE_MAPS_API_KEY');
  }

  async getRoute(origin: LatLng, destination: LatLng, waypoints: LatLng[] = []): Promise<RouteResult> {
    try {
      const waypointStr = waypoints
        .map((w) => `${w.lat},${w.lng}`)
        .join('|');

      const { data } = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          waypoints: waypointStr || undefined,
          key: this.apiKey,
        },
      });

      if (data.status !== 'OK' || !data.routes.length) {
        return this.fallbackRoute(origin, destination);
      }

      const route = data.routes[0];
      const leg = route.legs.reduce(
        (acc: any, l: any) => ({
          distance: acc.distance + l.distance.value,
          duration: acc.duration + l.duration.value,
        }),
        { distance: 0, duration: 0 },
      );

      return {
        distanceKm: +(leg.distance / 1000).toFixed(2),
        durationMin: +(leg.duration / 60).toFixed(1),
        polyline: route.overview_polyline.points,
      };
    } catch (err) {
      this.logger.warn('Google Maps API error, using fallback', err.message);
      return this.fallbackRoute(origin, destination);
    }
  }

  async getEta(driverLocation: LatLng, destination: LatLng): Promise<number> {
    const route = await this.getRoute(driverLocation, destination);
    return route.durationMin;
  }

  // Haversine fallback when Maps API unavailable
  private fallbackRoute(origin: LatLng, dest: LatLng): RouteResult {
    const R = 6371;
    const dLat = ((dest.lat - origin.lat) * Math.PI) / 180;
    const dLon = ((dest.lng - origin.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((origin.lat * Math.PI) / 180) *
        Math.cos((dest.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { distanceKm: +distanceKm.toFixed(2), durationMin: +(distanceKm * 2).toFixed(1), polyline: '' };
  }
}

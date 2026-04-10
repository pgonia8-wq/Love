import { useState, useEffect, useCallback } from "react";
  import { supabase } from "@/lib/supabase";

  interface GeoPosition {
    lat: number;
    lng: number;
    city: string | null;
    country: string | null;
    countryCode: string | null;
  }

  interface UseGeolocationReturn {
    position: GeoPosition | null;
    loading: boolean;
    error: string | null;
    requestLocation: () => void;
    updateUserLocation: (userId: string) => Promise<void>;
    calculateDistance: (lat1: number, lng1: number, lat2: number, lng2: number) => number;
    formatDistance: (km: number) => string;
  }

  const CITY_COORDS: Record<string, { lat: number; lng: number; country: string; code: string }> = {
    "Mexico City": { lat: 19.4326, lng: -99.1332, country: "Mexico", code: "MX" },
    "Guadalajara": { lat: 20.6597, lng: -103.3496, country: "Mexico", code: "MX" },
    "Cancun": { lat: 21.1619, lng: -86.8515, country: "Mexico", code: "MX" },
    "Bogota": { lat: 4.711, lng: -74.0721, country: "Colombia", code: "CO" },
    "Medellin": { lat: 6.2476, lng: -75.5658, country: "Colombia", code: "CO" },
    "Cartagena": { lat: 10.391, lng: -75.5144, country: "Colombia", code: "CO" },
    "Buenos Aires": { lat: -34.6037, lng: -58.3816, country: "Argentina", code: "AR" },
    "Lima": { lat: -12.0464, lng: -77.0428, country: "Peru", code: "PE" },
    "Santiago": { lat: -33.4489, lng: -70.6693, country: "Chile", code: "CL" },
    "Madrid": { lat: 40.4168, lng: -3.7038, country: "Spain", code: "ES" },
    "Barcelona": { lat: 41.3874, lng: 2.1686, country: "Spain", code: "ES" },
    "Montevideo": { lat: -34.9011, lng: -56.1645, country: "Uruguay", code: "UY" },
    "San Jose": { lat: 9.9281, lng: -84.0907, country: "Costa Rica", code: "CR" },
    "Quito": { lat: -0.1807, lng: -78.4678, country: "Ecuador", code: "EC" },
    "Panama City": { lat: 8.9824, lng: -79.5199, country: "Panama", code: "PA" },
  };

  export function useGeolocation(): UseGeolocationReturn {
    const [position, setPosition] = useState<GeoPosition | null>(() => {
      const stored = localStorage.getItem("hlove_geo");
      return stored ? JSON.parse(stored) : null;
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }, []);

    const formatDistance = useCallback((km: number): string => {
      if (km < 1) return "<1 km";
      if (km < 10) return Math.round(km) + " km";
      if (km < 100) return Math.round(km) + " km";
      return Math.round(km) + " km";
    }, []);

    const reverseGeocode = async (lat: number, lng: number): Promise<{ city: string | null; country: string | null; countryCode: string | null }> => {
      let closestCity = "Unknown";
      let closestCountry = "Unknown";
      let closestCode = "XX";
      let minDist = Infinity;

      for (const [city, coords] of Object.entries(CITY_COORDS)) {
        const dist = calculateDistance(lat, lng, coords.lat, coords.lng);
        if (dist < minDist) {
          minDist = dist;
          closestCity = city;
          closestCountry = coords.country;
          closestCode = coords.code;
        }
      }

      try {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
        if (r.ok) {
          const data = await r.json();
          if (data.city || data.locality) {
            return {
              city: data.city || data.locality || closestCity,
              country: data.countryName || closestCountry,
              countryCode: data.countryCode || closestCode,
            };
          }
        }
      } catch {}

      return { city: closestCity, country: closestCountry, countryCode: closestCode };
    };

    const requestLocation = useCallback(() => {
      if (!navigator.geolocation) {
        setError("Geolocation not supported");
        return;
      }
      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const geo = await reverseGeocode(lat, lng);
          const newPos: GeoPosition = { lat, lng, ...geo };
          setPosition(newPos);
          localStorage.setItem("hlove_geo", JSON.stringify(newPos));
          setLoading(false);
        },
        (err) => {
          console.warn("[Geo] Error:", err.message);
          setError(err.message);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }, []);

    const updateUserLocation = useCallback(async (userId: string) => {
      if (!position) return;
      try {
        await supabase.from("profiles").update({
          location_lat: position.lat,
          location_lng: position.lng,
          city: position.city,
          country: position.country,
          country_code: position.countryCode,
          last_active_at: new Date().toISOString(),
          is_online: true,
        }).eq("user_id", userId);
      } catch (err) {
        console.warn("[Geo] Update error:", err);
      }
    }, [position]);

    useEffect(() => {
      if (!position) requestLocation();
    }, []);

    return { position, loading, error, requestLocation, updateUserLocation, calculateDistance, formatDistance };
  }
  
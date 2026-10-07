import { supabase } from '../integrations/supabase/client';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  matchedAddress?: string;
  source: 'exact' | 'city_fallback';
}

/**
 * Geocodes an address using the free US Census Geocoder API.
 * Free, public, no API key required.
 */
export async function geocodeOneLineAddress(
  address: string,
  city?: string | null,
  state: string = 'MO',
  zip?: string | null
): Promise<GeocodeResult | null> {
  const cleanAddr = (address || '').trim();
  const cleanCity = (city || '').trim();
  const cleanZip = (zip || '').trim();

  if (!cleanAddr && !cleanCity && !cleanZip) return null;

  // 1. Try Exact One-Line Address
  const queryStr = [cleanAddr, cleanCity, `${state} ${cleanZip}`.trim()]
    .filter(Boolean)
    .join(', ');

  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(
    queryStr
  )}&benchmark=Public_AR_Current&format=json`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      const matches = data?.result?.addressMatches;
      if (Array.isArray(matches) && matches.length > 0) {
        const coords = matches[0].coordinates;
        if (coords && typeof coords.y === 'number' && typeof coords.x === 'number') {
          return {
            latitude: coords.y,
            longitude: coords.x,
            matchedAddress: matches[0].matchedAddress,
            source: 'exact',
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[Census Geocoder] Query failed for "${queryStr}":`, err);
  }

  // 2. Fallback: City + ZIP Centroid Approximation
  if (cleanCity || cleanZip) {
    const fallbackQuery = [cleanCity, `${state} ${cleanZip}`.trim()]
      .filter(Boolean)
      .join(', ');

    const fallbackUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(
      fallbackQuery
    )}&benchmark=Public_AR_Current&format=json`;

    try {
      const res = await fetch(fallbackUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const matches = data?.result?.addressMatches;
        if (Array.isArray(matches) && matches.length > 0) {
          const coords = matches[0].coordinates;
          if (coords && typeof coords.y === 'number' && typeof coords.x === 'number') {
            return {
              latitude: coords.y,
              longitude: coords.x,
              matchedAddress: matches[0].matchedAddress,
              source: 'city_fallback',
            };
          }
        }
      }
    } catch {
      // ignore fallback error
    }
  }

  return null;
}

/**
 * Progressively geocodes ungeocoded transactions in the database.
 */
export async function batchGeocodeTransactions(
  batchLimit: number = 20,
  onProgress?: (processed: number, total: number, latestAddress?: string) => void
): Promise<{ successCount: number; failureCount: number }> {
  const { data: deals, error } = await (supabase.from('transactions') as any)
    .select('id, property_address, city, state, zip')
    .is('latitude', null)
    .not('property_address', 'is', null)
    .in('status', ['Closed', 'closed', 'Pending', 'pending'])
    .limit(batchLimit);

  if (error || !deals || deals.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;
  const total = deals.length;

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    const geo = await geocodeOneLineAddress(
      deal.property_address,
      deal.city,
      deal.state || 'MO',
      deal.zip
    );

    if (geo) {
      await (supabase.from('transactions') as any)
        .update({
          latitude: geo.latitude,
          longitude: geo.longitude,
          geocoded_at: new Date().toISOString(),
          geocode_status: geo.source,
        })
        .eq('id', deal.id);

      successCount++;
    } else {
      await (supabase.from('transactions') as any)
        .update({
          geocoded_at: new Date().toISOString(),
          geocode_status: 'failed',
        })
        .eq('id', deal.id);

      failureCount++;
    }

    if (onProgress) {
      onProgress(i + 1, total, deal.property_address);
    }

    // Polite throttle (80ms) for US Census API
    await new Promise((r) => setTimeout(r, 80));
  }

  return { successCount, failureCount };
}

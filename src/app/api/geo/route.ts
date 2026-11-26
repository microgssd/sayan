import { NextResponse } from 'next/server';
import { geoFromHeaders } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return NextResponse.json(geoFromHeaders(req.headers), { headers: { 'Cache-Control': 'private, no-store' } });
}

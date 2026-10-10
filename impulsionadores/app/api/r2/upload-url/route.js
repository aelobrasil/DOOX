import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { ok: false, code: 'upload_route_retired', storage: 'supabase' },
    { status: 410 }
  );
}

import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { createR2PresignedPut, r2Configured } from '../../../../lib/r2';

const MAX_LOGO_BYTES = 500 * 1024;
const ALLOWED_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg']);

export async function POST(request) {
  try {
    if (!r2Configured()) {
      return NextResponse.json({ ok: false, code: 'r2_not_configured' }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const contentType = String(body.contentType || 'image/webp').toLowerCase();
    const size = Number(body.size || 0);
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ ok: false, code: 'invalid_type' }, { status: 400 });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_LOGO_BYTES) {
      return NextResponse.json({ ok: false, code: 'invalid_size', maxBytes: MAX_LOGO_BYTES }, { status: 400 });
    }

    const key = `empresas/${data.user.id}/logo.webp`;
    const signed = createR2PresignedPut({ key, contentType, expires: 300 });
    return NextResponse.json({ ok: true, ...signed, maxBytes: MAX_LOGO_BYTES });
  } catch (error) {
    console.error('R2 upload-url error', error?.message || error);
    return NextResponse.json({ ok: false, code: 'upload_url_failed' }, { status: 500 });
  }
}

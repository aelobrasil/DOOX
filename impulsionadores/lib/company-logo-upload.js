'use client';

import { supabase } from './supabase';

const INPUT_MAX_BYTES = 10 * 1024 * 1024;
const OUTPUT_MAX_BYTES = 500 * 1024;
const MAX_DIMENSION = 800;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

export async function optimizeCompanyLogo(file) {
  if (!file || !ALLOWED_TYPES.has(file.type)) throw new Error('invalid_logo_type');
  if (file.size > INPUT_MAX_BYTES) throw new Error('logo_too_large');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let quality = 0.86;
  let blob = await canvasToBlob(canvas, quality);
  while (blob && blob.size > OUTPUT_MAX_BYTES && quality > 0.46) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }
  if (!blob || blob.size > OUTPUT_MAX_BYTES) throw new Error('logo_could_not_be_optimized');

  return new File([blob], 'logo.webp', { type: 'image/webp', lastModified: Date.now() });
}

export async function uploadCompanyLogo(file) {
  const optimized = await optimizeCompanyLogo(file);
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const userId = sessionData?.session?.user?.id;
  if (!token || !userId) throw new Error('unauthorized');

  // Preferência: R2 via URL assinada do servidor.
  try {
    const response = await fetch('/api/r2/upload-url', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ contentType: optimized.type, size: optimized.size }),
    });
    const signed = await response.json().catch(() => null);
    if (response.ok && signed?.uploadUrl && signed?.publicUrl) {
      const put = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': optimized.type },
        body: optimized,
      });
      if (!put.ok) throw new Error('r2_put_failed');
      return { url: signed.publicUrl, storage: 'r2', bytes: optimized.size };
    }
  } catch (error) {
    console.warn('R2 indisponível; usando fallback Supabase Storage.', error?.message || error);
  }

  // Contingência enquanto R2 não estiver configurado ou estiver indisponível.
  const path = `${userId}/empresa-logo.webp`;
  const { error } = await supabase.storage
    .from('impulsionadores-avatars')
    .upload(path, optimized, { upsert: true, contentType: 'image/webp', cacheControl: '31536000' });
  if (error) throw new Error('supabase_fallback_failed');
  const { data } = supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);
  return { url: `${data.publicUrl}?v=${Date.now()}`, storage: 'supabase', bytes: optimized.size };
}

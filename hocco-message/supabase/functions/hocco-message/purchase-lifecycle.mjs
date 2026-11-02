export const COMMENT_PAYMENT_WINDOW_MS = 20 * 60_000;

export function paymentExpiresAt(row, kind) {
  if (kind === 'sponsor') return null;
  const created = Date.parse(row.created_at);
  return Number.isFinite(created) ? new Date(created + COMMENT_PAYMENT_WINDOW_MS).toISOString() : null;
}

export function isUnpaidCommentExpired(row, kind, now = Date.now()) {
  const expiry = paymentExpiresAt(row, kind);
  return kind !== 'sponsor' && row.payment === 'pending' && !row.payment_hold && !row.mercado_pago_payment_id && expiry !== null && Date.parse(expiry) <= now;
}

export function checkoutBlock(row, kind, now = Date.now()) {
  if (row.expired_purchase || isUnpaidCommentExpired(row, kind, now)) return { status: 410, error: 'O prazo de 20 minutos terminou. O comentário não pago foi excluído. Envie uma nova mensagem. Se você já pagou, não pague novamente e procure o suporte.' };
  if (row.archived_at || row.hidden_at || row.content_removed_at) return { status: 409, error: 'Este pedido foi retirado da operação e não pode receber novos pagamentos.' };
  if (kind === 'order' && (!Number.isFinite(Date.parse(row.publication_deadline)) || Date.parse(row.publication_deadline) <= now)) return { status: 409, error: 'O prazo de publicação deste pedido terminou. Envie uma nova mensagem para conferir a oferta atual.' };
  return null;
}

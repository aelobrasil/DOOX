export function verifiedPaymentEvent(payment, {kind,code,priceCents,collectorId,production}) {
 if (!['approved','refunded','charged_back','in_mediation'].includes(payment?.status)) return null;
 if (!/^[0-9]{1,40}$/.test(String(payment.id||'')) || payment.external_reference!==`hocco:${kind}:${code}` || payment.currency_id!=='BRL' || !Number.isFinite(Number(payment.transaction_amount)) || Math.round(Number(payment.transaction_amount)*100)!==priceCents) throw Error('Pagamento não corresponde ao pedido.');
 if (!collectorId || String(payment.collector_id)!==String(collectorId)) throw Error('Recebedor do pagamento divergente.');
 if (typeof payment.live_mode!=='boolean' || payment.live_mode!==production) throw Error('Ambiente do pagamento divergente.');
 if (!Number.isFinite(Date.parse(payment.date_last_updated))) throw Error('Data do pagamento inválida.');
 return {p_kind:kind,p_code:code,p_payment_id:String(payment.id),p_amount_cents:priceCents,p_status:payment.status,p_updated_at:new Date(payment.date_last_updated).toISOString()};
}

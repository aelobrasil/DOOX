export async function createSponsorPix({accessToken,code,priceCents,email,cnpj,createdAt,notificationUrl,fetcher=fetch,now=Date.now()}){
 if(!accessToken)throw Error('O Pix está temporariamente indisponível.');
 if(!/^HC-SP-[A-F0-9]{12}$/.test(code)||!Number.isSafeInteger(priceCents)||priceCents<1||priceCents>999999)throw Error('Pedido Pix inválido.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||''))throw Error('Confira o e-mail cadastrado para gerar o Pix.');
 if(!/^\d{14}$/.test(cnpj||''))throw Error('Para este cadastro, continue pelo checkout seguro para pagar.');
 const expires=Date.parse(createdAt)+48*3600000;
 if(!Number.isFinite(expires)||expires-now<30*60000)throw Error('Continue pelo checkout seguro para conferir o prazo do pagamento.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('hocco:sponsor:'+code+':pix'));
 const idempotency=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 const response=await fetcher('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json','X-Idempotency-Key':idempotency},signal:AbortSignal.timeout(15000),body:JSON.stringify({transaction_amount:priceCents/100,description:'Patrocínio HOCCO · 7 dias',payment_method_id:'pix',external_reference:'hocco:sponsor:'+code,notification_url:notificationUrl,date_of_expiration:new Date(expires).toISOString(),payer:{email,identification:{type:'CNPJ',number:cnpj}}})});
 let payment;try{payment=await response.json()}catch{throw Error('Não foi possível gerar o Pix. Continue pelo checkout seguro.')}
 if(!response.ok)throw Error('O Mercado Pago não liberou o Pix nesta tentativa. Continue pelo checkout seguro.');
 if(payment.external_reference!=='hocco:sponsor:'+code||payment.currency_id!=='BRL'||Math.round(Number(payment.transaction_amount)*100)!==priceCents||payment.payment_method_id!=='pix')throw Error('O Pix recebido não corresponde ao pedido.');
 if(payment.status!=='pending')throw Error('Este pagamento já mudou de status. Atualize o acompanhamento antes de pagar.');
 const qr=payment.point_of_interaction?.transaction_data;
 if(!qr||typeof qr.qr_code!=='string'||!qr.qr_code.startsWith('000201')||typeof qr.qr_code_base64!=='string'||!/^[A-Za-z0-9+/=]+$/.test(qr.qr_code_base64)||qr.qr_code_base64.length>1000000)throw Error('QR Code indisponível. Continue pelo checkout seguro.');
 const expiry=Date.parse(payment.date_of_expiration);if(!Number.isFinite(expiry)||expiry<=now)throw Error('Este QR Code expirou. Continue pelo checkout seguro.');
 return {qrCode:qr.qr_code,qrImage:qr.qr_code_base64,expiresAt:new Date(expiry).toISOString()};
}

export async function createRealitySponsorPix({accessToken,code,priceCents,email,notificationUrl,fetcher=fetch,now=Date.now()}){
 if(!accessToken)throw Error('O Pix está temporariamente indisponível.');
 if(!/^HC-RS-[A-F0-9]{12}$/.test(code)||!Number.isSafeInteger(priceCents)||priceCents<1||priceCents>999999)throw Error('Pedido Pix inválido.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||''))throw Error('Confira o e-mail cadastrado para gerar o Pix.');
 const expires=new Date(now+30*60000).toISOString();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('hocco:reality_sponsor:'+code+':pix'));
 const idempotency=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 const reference='hocco:reality_sponsor:'+code;
 const response=await fetcher('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json','X-Idempotency-Key':idempotency},signal:AbortSignal.timeout(15000),body:JSON.stringify({transaction_amount:priceCents/100,description:'Patrocinador Oficial do Reality HOCCO · 7 dias',payment_method_id:'pix',external_reference:reference,notification_url:notificationUrl,date_of_expiration:expires,payer:{email}})});
 let payment;try{payment=await response.json()}catch{throw Error('Não foi possível gerar o Pix. Tente novamente.')}
 if(!response.ok)throw Error('O Mercado Pago não liberou o Pix nesta tentativa.');
 if(payment.external_reference!==reference||payment.currency_id!=='BRL'||Math.round(Number(payment.transaction_amount)*100)!==priceCents||payment.payment_method_id!=='pix')throw Error('O Pix recebido não corresponde ao pedido.');
 if(payment.status!=='pending')throw Error('Este pagamento já mudou de status. Atualize o acompanhamento antes de pagar.');
 const qr=payment.point_of_interaction?.transaction_data;
 if(!qr||typeof qr.qr_code!=='string'||!qr.qr_code.startsWith('000201')||typeof qr.qr_code_base64!=='string'||!/^[A-Za-z0-9+/=]+$/.test(qr.qr_code_base64)||qr.qr_code_base64.length>1000000)throw Error('QR Code indisponível. Tente novamente.');
 const expiry=Date.parse(payment.date_of_expiration);if(!Number.isFinite(expiry)||expiry<=now)throw Error('Este QR Code expirou. Gere outro.');
 return {qrCode:qr.qr_code,qrImage:qr.qr_code_base64,expiresAt:new Date(expiry).toISOString(),reservationEndsAt:new Date(now+10*60000).toISOString()};
}

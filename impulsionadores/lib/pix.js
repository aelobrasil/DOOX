import { PIX_CITY, PIX_KEY } from './config';

function tlv(id, value) {
  return id + String(value.length).padStart(2, '0') + value;
}

function crc16(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function pixPayload(amount, reference = '***') {
  const merchantAccount = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', PIX_KEY);
  let payload = '';
  payload += tlv('00', '01');
  payload += tlv('26', merchantAccount);
  payload += tlv('52', '0000');
  payload += tlv('53', '986');
  payload += tlv('54', Number(amount).toFixed(2));
  payload += tlv('58', 'BR');
  payload += tlv('59', 'ALEX SANDRO SOARES FERN');
  payload += tlv('60', PIX_CITY.toUpperCase());
  payload += tlv('62', tlv('05', String(reference || '***').slice(0, 25)));
  payload += '6304';
  return payload + crc16(payload);
}

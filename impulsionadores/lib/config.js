export const HOCCO_WHATSAPP = '5514991088104';
export const PIX_KEY = 'c9316176-6f92-413e-9209-63ae6f661ba9';
export const PIX_RECEIVER = 'Alex Sandro Soares Fernandes';
export const PIX_BANK = 'Nubank';
export const PIX_CITY = 'Bauru';

export const HYPE_BOARDS = {
  almoco: { label: 'Hype Almoço', window: '11h–14h' },
  tarde: { label: 'Hype Tarde', window: '14h–18h' },
  noite: { label: 'Hype Noite', window: '18h–22h' },
};

export const HYPE_SIZES = {
  compacto: { label: 'Compacto', scale: 1 },
  medio: { label: 'Médio', scale: 1.2 },
  grande: { label: 'Grande', scale: 1.42 },
  max: { label: 'Max', scale: 1.68 },
};

export const HYPE_PRICES = {
  compacto: { quadro: 29.9, dia: 59.9 },
  medio: { quadro: 39.9, dia: 79.9 },
  grande: { quadro: 49.9, dia: 99.9 },
  max: { quadro: 59.9, dia: 119.9 },
};

export function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function todayBR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function currentBoard() {
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  if (hour >= 11 && hour < 14) return 'almoco';
  if (hour >= 14 && hour < 18) return 'tarde';
  if (hour >= 18 && hour < 22) return 'noite';
  return hour < 11 ? 'almoco' : 'noite';
}

export function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

export function whatsappUrl(number, message) {
  return `https://wa.me/${onlyDigits(number)}?text=${encodeURIComponent(message)}`;
}

export function validateCNPJ(raw) {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base, weights) => {
    const sum = base.split('').reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const first = calc(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const second = calc(cnpj.slice(0, 12) + first, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return Number(cnpj[12]) === first && Number(cnpj[13]) === second;
}

export function validateCommunityPricing(payload) {
  const communityPriceCents = payload?.communityPriceCents;
  const livePriceCents = payload?.livePriceCents;
  if (!Number.isInteger(communityPriceCents) || communityPriceCents < 1 || communityPriceCents > 999900) {
    throw new Error('O preço da Comunidade deve ficar entre R$ 0,01 e R$ 9.999,00.');
  }
  if (!Number.isInteger(livePriceCents) || livePriceCents < 1 || livePriceCents > 999900) {
    throw new Error('O preço da LIVE deve ficar entre R$ 0,01 e R$ 9.999,00.');
  }
  return { communityPriceCents, livePriceCents };
}

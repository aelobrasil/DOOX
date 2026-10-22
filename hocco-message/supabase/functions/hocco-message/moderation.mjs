const CONFUSABLES = new Map(Object.entries({
  // Cyrillic letters that are commonly substituted for Latin characters.
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x",
  "у": "y", "і": "i", "ј": "j", "к": "k", "м": "m", "т": "t",
  "в": "b", "н": "h", "ѕ": "s", "ԁ": "d", "ԛ": "q",
  // Common Greek lookalikes.
  "α": "a", "ε": "e", "ο": "o", "ρ": "p", "ϲ": "c", "χ": "x",
  "ι": "i", "κ": "k", "τ": "t", "υ": "y", "ν": "v", "μ": "m",
}));

function normalizeForModeration(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/[аепосххуіјктмвнѕԁԛαεορϲχικτυνμ]/g, (character) => CONFUSABLES.get(character) ?? character)
    .replace(/[04@]/g, (character) => ({ "0": "o", "4": "a", "@": "a" })[character])
    .replace(/[1357!|$]/g, (character) => ({ "1": "i", "3": "e", "5": "s", "7": "t", "!": "i", "|": "i", "$": "s" })[character])
    .replace(/8/g, "b")
    .replace(/9/g, "g")
    // Catch elongated spellings such as "mataaaar" without damaging normal
    // double letters that occur in words such as "assassinar".
    .replace(/([a-z])\1{2,}/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function moderateCommunityMessage(input) {
  const original = String(input ?? "");
  const text = normalizeForModeration(original);
  // A punctuation-free representation catches deliberate letter separation,
  // while the spaced form above preserves word boundaries for normal checks.
  const compact = text.replace(/[^a-z0-9]/g, "");

  const hardBlocks = [
    /\b(?:vou|vamos|quero|pretendo|prometo)\b.{0,45}\b(?:matar|assassinar|esfaquear|atirar|agredir|estuprar|queimar|explodir)\b/,
    /\b(?:te|lhe)\s+(?:vou\s+)?(?:matar|assassinar|esfaquear|atirar|agredir|estuprar)\b/,
    /\b(?:se mata|vai se matar|deveria se matar|se suicide|vai se suicidar)\b/,
    /\b(?:matar|eliminar|expulsar|exterminar|deportar)\b.{0,50}\b(?:negros?|pretos?|gays?|lesbicas?|trans|judeus?|arabes?|indigenas?|imigrantes?|mulheres|cristaos?|muculmanos?)\b/,
    /\b(?:negros?|pretos?|gays?|lesbicas?|trans|judeus?|arabes?|indigenas?|imigrantes?|mulheres|cristaos?|muculmanos?)\b.{0,50}\b(?:morram|devem morrer|tem que morrer|sejam eliminados|sejam expulsos)\b/,
    /\b(?:menor|crianca|criancas|adolescente)\b.{0,45}\b(?:sexo|sexual|nudez|pornografia|estupr\w*|abuso sexual)\b/,
    /\b(?:sexo|sexual|nudez|pornografia|estupr\w*|abuso sexual)\b.{0,45}\b(?:menor|crianca|criancas|adolescente)\b/,
  ];
  const compactHardBlocks = [
    /(?:euvou|vamos|quero|pretendo|prometo).{0,45}(?:matar|assassinar|esfaquear|atirar|agredir|estuprar|queimar|explodir)/,
    /(?:tematar|lhevoumatar|vaise|deveriase|sesuicide|vaisesuicidar)/,
    /(?:matar|eliminar|expulsar|exterminar|deportar).{0,50}(?:negros?|pretos?|gays?|lesbicas?|trans|judeus?|arabes?|indigenas?|imigrantes?|mulheres|cristaos?|muculmanos?)/,
    /(?:negros?|pretos?|gays?|lesbicas?|trans|judeus?|arabes?|indigenas?|imigrantes?|mulheres|cristaos?|muculmanos?).{0,50}(?:morram|devemmorrer|temquemorrer|sejameliminados|sejamexpulsos)/,
    /(?:menor|crianca|criancas|adolescente).{0,45}(?:sexo|sexual|nudez|pornografia|estupr\w*|abusosexual)/,
    /(?:sexo|sexual|nudez|pornografia|estupr\w*|abusosexual).{0,45}(?:menor|crianca|criancas|adolescente)/,
  ];
  if (hardBlocks.some((pattern) => pattern.test(text)) || compactHardBlocks.some((pattern) => pattern.test(compact))) {
    return { approved: false, requiresReview: false, category: "safety_policy" };
  }

  // Run contact checks against a Unicode-normalized raw string so punctuation
  // such as URL separators and email dots remains available to these patterns.
  const contactText = original.normalize("NFKC").toLowerCase().replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "");
  const containsContact = /https?:\/\/|\bwww\.|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b\d{3}\.?\d{3}\.?\d{3}[- ]?\d{2}\b/.test(contactText);
  if (containsContact) {
    return { approved: false, requiresReview: false, category: "contact_or_link" };
  }

  const reviewSignals = [
    /\b(?:negros?|pretos?|gays?|lesbicas?|lgbtq(?:ia)?|trans|judeus?|arabes?|indigenas?|imigrantes?|mulheres|cristaos?|muculmanos?)\b/,
    /\b(?:morte|matar|assassinar|arma|tiro|bomba|violencia|sexo|sexual|nudez|pornografia|suicid\w*|drogas?|maconha|cocaina|crack)\b/,
    /\b(?:politica|eleicao|partido|candidato|presidente|religiao|igreja|racismo|nazismo)\b/,
  ];
  if (reviewSignals.some((pattern) => pattern.test(text))) {
    return { approved: false, requiresReview: true, category: "context_check" };
  }

  return { approved: true, requiresReview: false, category: "clear", version: "rules-v2" };
}
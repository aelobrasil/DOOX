export function moderateCommunityMessage(input) {
  const original = String(input ?? "");
  const text = original
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.+:/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const blocked = [
    /\b(?:vou|vamos|quero|pretendo|prometo)\b.{0,45}\b(?:matar|assassinar|esfaquear|atirar|agredir|estuprar|queimar|explodir)\b/,
    /\b(?:te|lhe)\s+(?:vou\s+)?(?:matar|assassinar|esfaquear|atirar|agredir|estuprar)\b/,
    /\b(?:se mata|vai se matar|deveria se matar|se suicide|vai se suicidar)\b/,
    /\b(?:matar|eliminar|expulsar|exterminar|deportar)\b.{0,50}\b(?:negros?|pretos?|gays?|lesbicas?|trans|judeus?|arabes?|indigenas?|imigrantes?|mulheres|cristaos?|muculmanos?)\b/,
    /\b(?:negros?|pretos?|gays?|lesbicas?|trans|judeus?|arabes?|indigenas?|imigrantes?|mulheres|cristaos?|muculmanos?)\b.{0,50}\b(?:morram|devem morrer|tem que morrer|sejam eliminados|sejam expulsos)\b/,
    /\b(?:menor|crianca|criancas|adolescente)\b.{0,45}\b(?:sexo|sexual|nudez|pornografia|estupr|abuso sexual)\b/,
    /\b(?:sexo|sexual|nudez|pornografia|estupr|abuso sexual)\b.{0,45}\b(?:menor|crianca|criancas|adolescente)\b/,
  ];
  if (blocked.some((pattern) => pattern.test(text))) {
    return { approved: false, category: "safety_policy" };
  }

  const containsContact = /https?:\/\/|\bwww\.|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b\d{3}\.?\d{3}\.?\d{3}[- ]?\d{2}\b/.test(text);
  if (containsContact) {
    return { approved: false, category: "contact_or_link" };
  }

  return { approved: true, category: "clear", version: "rules-v1" };
}

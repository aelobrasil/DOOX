const CONFUSABLES = new Map(Object.entries({
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
  "і": "i", "ј": "j", "к": "k", "м": "m", "т": "t", "в": "b", "н": "h", "ѕ": "s",
  "ԁ": "d", "ԛ": "q", "α": "a", "ε": "e", "ο": "o", "ρ": "p", "ϲ": "c", "χ": "x",
  "ι": "i", "κ": "k", "τ": "t", "υ": "y", "ν": "v", "μ": "m",
}));

const VIOLENCE = ["matar", "assassinar", "esfaquear", "atirar", "fuzilar", "metralhar", "socar", "agredir", "espancar", "torturar", "estuprar", "queimar", "incendiar", "explodir", "envenenar", "sequestrar", "decapitar", "machucar", "ferir", "bater", "eliminar", "exterminar", "enforcar"];
const GROUPS = ["negro", "preto", "gay", "lesbica", "trans", "judeu", "arabe", "indigena", "imigrante", "mulher", "cristao", "muculmano", "deficiente", "autista", "lgbt", "lgbtq", "lgbtqia"];
const MINORS = ["menor", "crianca", "criancas", "adolescente", "bebe", "infantil"];
const SEXUAL = ["sexo", "sexual", "nudez", "nua", "nuas", "pelada", "pelado", "pornografia", "estupr", "abuso sexual", "exploracao sexual", "pedofilia", "nudes"];
const SELF_HARM = ["suicid", "se matar", "se cortar", "se machucar", "se enforcar", "tirar a propria vida", "automutil", "nao merece viver", "some do mundo"];
const DRUGS = ["cocaina", "crack", "maconha", "metanfetamina", "heroina", "fentanil", "lsd", "ecstasy", "drogas"];
const WEAPONS = ["arma", "pistola", "revolver", "fuzil", "municao", "explosivo", "bomba"];
const CRIME = ["golpe", "fraude", "roubar", "roubo", "furtar", "extorquir", "chantagear", "hackear", "invadir conta", "lavar dinheiro", "falsificar"];
const HARASSMENT = ["idiota", "lixo", "inutil", "desprezivel", "vagabunda", "vagabundo", "retardado", "aberracao", "ameacar", "perseguir", "humilhar", "stalkear", "desgracado", "desgracada", "puta", "viado", "merda", "bosta", "porra", "escoria"];
const SENSITIVE_TERMS = [
  ...VIOLENCE.map((word) => [word, "violence"]),
  ...SELF_HARM.map((word) => [word, "self_harm"]),
  ...SEXUAL.map((word) => [word, "sexual_content"]),
  ...DRUGS.map((word) => [word, "drugs"]),
  ...WEAPONS.map((word) => [word, "weapons"]),
  ...CRIME.map((word) => [word, "illegal_activity"]),
  ...GROUPS.map((word) => [word, "protected_group"]),
  ...MINORS.map((word) => [word, "minor_safety"]),
  ...HARASSMENT.map((word) => [word.trim(), "harassment"]),
];

function normalize(value) {
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
    .replace(/([a-z])\1{2,}/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function consonantSkeleton(word) {
  return word.replace(/[aeiou]/g, "");
}

function oneEditApart(left, right) {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (left.length >= right.length) i++;
    if (right.length >= left.length) j++;
  }
  if (i < left.length || j < right.length) edits++;
  return edits <= 1;
}

function fuzzySensitiveMatches(tokens) {
  const matches = [];
  for (const token of tokens) {
    if (token.length < 3) continue;
    for (const [phrase, category] of SENSITIVE_TERMS) {
      if (phrase.includes(" ")) continue;
      const skeleton = consonantSkeleton(phrase);
      const vowelOmitted = !/[aeiou]/.test(token) && skeleton.length >= 3 && consonantSkeleton(token) === skeleton;
      if (token === phrase || oneEditApart(token, phrase) || vowelOmitted) {
        matches.push({ token, phrase, category });
      }
    }
  }
  return matches;
}

function result(approved, requiresReview, category, reason) {
  return { approved, requiresReview, category, ...(reason ? { reason } : {}), version: "rules-v3" };
}

export function moderateCommunityMessage(input) {
  const original = String(input ?? "");
  const text = normalize(original);
  const tokens = text.split(" ").filter(Boolean);
  // Compact text catches separated characters and punctuation inserted inside words.
  const compact = text.replace(/[^a-z0-9]/g, "");

  const directViolence = new RegExp(`\\b(?:vou|vamos|quero|pretendo|prometo|merece|deveria|tem que)\\b.{0,55}\\b(?:${VIOLENCE.join("|")})\\b`);
  const directSelfHarm = /\b(?:vai|vao|deveria|quero que|manda|mande)\s+(?:se\s+)?(?:matar|suicidar|cortar|enforcar|tirar a propria vida)\b|\b(?:se mata|morra|morre logo|nao merece viver|some do mundo)\b/;
  const hateViolence = new RegExp(`\\b(?:${VIOLENCE.join("|")}|morram|devem morrer|tem que morrer|sejam expulsos)\\b.{0,55}\\b(?:${GROUPS.join("|")})\\w*\\b|\\b(?:${GROUPS.join("|")})\\w*\\b.{0,55}\\b(?:morram|devem morrer|tem que morrer|sejam eliminados|sejam expulsos|sao inferiores|sao parasitas|sao uma praga|nao deveriam existir)\\b`);
  const discriminatoryExclusion = new RegExp(`\\b(?:nao|nunca)\\s+(?:contratamos|aceitamos|queremos|deixamos entrar|queremos aqui)\\b.{0,55}\\b(?:${GROUPS.join("|")})\\w*\\b|\\b(?:${GROUPS.join("|")})\\w*\\b.{0,55}\\b(?:nao podem trabalhar|nao podem estudar|nao podem votar|nao tem direitos)\\b`);
  const minorSexual = new RegExp(`\\b(?:${MINORS.join("|")})\\w*\\b.{0,55}\\b(?:${SEXUAL.join("|")})\\w*\\b|\\b(?:${SEXUAL.join("|")})\\w*\\b.{0,55}\\b(?:${MINORS.join("|")})\\w*\\b`);
  const compactThreat = new RegExp(`(?:euvou|vamos|quero|pretendo|prometo|merece|deveria|temque).{0,55}(?:${VIOLENCE.join("|")})`);
  const fuzzyMatches = fuzzySensitiveMatches(tokens);
  const threatIntent = /\b(?:vou|vamos|quero|pretendo|prometo|merece|deveria|tem que)\b/.test(text);
  const fuzzyViolence = fuzzyMatches.some((match) => VIOLENCE.includes(match.phrase));

  if (directViolence.test(text) || compactThreat.test(compact) || (threatIntent && fuzzyViolence)) {
    return result(false, false, "violence", "threat_or_incitement");
  }
  if (/\b(?:vou|vamos|quero|prometo|deveria)\b.{0,45}\b(?:acabar com voce|te destruir|fazer voce pagar|te encontrar|ir atras de voce|te pegar)\b/.test(text)) {
    return result(false, false, "violence", "threat_or_intimidation");
  }
  if (directSelfHarm.test(text) || /(?:vaisematar|vaosematar|deveriasematar|morralogo|naomereceviver|somedomundo)/.test(compact)) {
    return result(false, false, "self_harm", "encouragement");
  }
  if (hateViolence.test(text) || discriminatoryExclusion.test(text) || minorSexual.test(text)) {
    return result(false, false, "safety_policy", "targeted_harm_or_exploitation");
  }
  if (/\b(?:vendo|compro|compre|encomende|entrego|forneco|procuro comprar)\b.{0,45}\b(?:drogas?|cocaina|crack|maconha|arma|municao|explosivo)\b/.test(text)) {
    return result(false, false, "illegal_activity", "prohibited_trade_or_offer");
  }

  const contactText = original.normalize("NFKC").toLowerCase().replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "");
  const containsContact = /https?:\/\/|\bwww\.|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b\d{3}\.?\d{3}\.?\d{3}[- ]?\d{2}\b|\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[- ]?\d{4}\b/.test(contactText);
  if (containsContact) return result(false, false, "contact_or_personal_data", "link_or_contact_data");

  const reviewRules = [
    [new RegExp(`\\b(?:${GROUPS.join("|")})\\w*\\b`), "protected_group_context"],
    [new RegExp(`\\b(?:${VIOLENCE.join("|")}|morte|morr\\w*|arma|tiro|bomba|violencia|explosivo)\\w*\\b`), "violence_context"],
    [new RegExp(`\\b(?:${SELF_HARM.join("|")})\\w*\\b`), "self_harm_context"],
    [new RegExp(`\\b(?:${SEXUAL.join("|")})\\w*\\b`), "sexual_content"],
    [new RegExp(`\\b(?:${DRUGS.join("|")})\\w*\\b`), "drugs_or_controlled_substances"],
    [new RegExp(`\\b(?:${WEAPONS.join("|")})\\w*\\b`), "weapons"],
    [new RegExp(`\\b(?:${CRIME.join("|")})\\w*\\b`), "illegal_activity_or_fraud"],
    [new RegExp(`\\b(?:${HARASSMENT.map((word) => word.trim()).join("|")})\\w*\\b`), "harassment_or_insult"],
    [/\b(?:cpf|rg|endereco|telefone|whatsapp|placa do carro|dados pessoais|mora em|numero da casa)\b/, "personal_data"],
    [/\b(?:politica|eleicao|partido|candidato|presidente|religiao|igreja|racismo|nazismo|extremismo)\b/, "sensitive_context"],
  ];
  for (const [pattern, category] of reviewRules) {
    if (pattern.test(text)) return result(false, true, category, "context_review");
  }
  if (fuzzyMatches.length) return result(false, true, fuzzyMatches[0].category, "possible_obfuscated_sensitive_term");

  // Detect common euphemisms and coded calls to exclude or intimidate groups.
  if (/\b(?:limpar|dar um jeito em|sumir com|varrer|silenciar)\b.{0,60}\b(?:eles|essa gente|esse povo|essa raça|esse grupo)\b/.test(text)) {
    return result(false, true, "possible_targeted_harassment", "coded_or_ambiguous_language");
  }

  return result(true, false, "clear", "no_policy_signal_detected");
}

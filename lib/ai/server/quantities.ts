/** Quantity checks are a diagnostic; the semantic reviewer checks entities, scope and causality. */
const SMALL: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE: Record<string, number> = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 };
const numberWords = Object.keys({ ...SMALL, ...SCALE }).join("|");
const spoken = new RegExp(`\\b(?:${numberWords})(?:[ -]+(?:and[ -]+)?(?:${numberWords}))*\\b`, "gi");

export function normalizeNumbers(text: string) {
  return text.toLowerCase().replace(/(?<=\d),(?=\d{3}\b)/g, "").replace(/\b(\d+(?:\.\d+)?)\s*(million|billion|thousand)\b/g, (_, value, scale) => String(Number(value) * SCALE[scale])).replace(spoken, (match) => {
    let total = 0, group = 0;
    for (const token of match.split(/[ -]+/).filter((token) => token !== "and")) {
      if (token in SMALL) group += SMALL[token];
      else if (token === "hundred") group = (group || 1) * 100;
      else { total += (group || 1) * SCALE[token]; group = 0; }
    }
    return String(total + group);
  }).replace(/\b(\d+(?:\.\d+)?)\s*(million|billion|thousand)\b/g, (_, value, scale) => String(Number(value) * SCALE[scale]));
}

export type Quantity = { value: string; unit: string; text: string };
const UNIT = /^(?:[\s-]*)(%|percent(?:age points?)?|dollars?|usd|euros?|pounds?|hours?|days?|weeks?|months?|years?|minutes?|seconds?|users?|people|customers?|students?|tests?|turns?|accounts?|files?|degrees?|ms|mb|gb|kg|km|meters?|metres?)(?![a-z])/i;
function unitName(unit: string) {
  return unit.toLowerCase().replace(/percentage points?/, "percentage-point").replace(/^(?:%|percent)$/, "percent").replace(/^(?:usd|dollars?)$/, "dollar").replace(/(?<!m)s$/, "");
}

export function quantities(text: string): Quantity[] {
  const normalized = normalizeNumbers(text);
  return [...normalized.matchAll(/(?<![\w#])([$€£])?\s*(-?\d+(?:\.\d+)?)(?![\w])/g)].map((match) => {
    const after = normalized.slice(match.index! + match[0].length);
    const before = normalized.slice(0, match.index).match(/(hours?|days?|weeks?|months?|years?|minutes?|seconds?)\s*$/i)?.[1];
    const unit = match[1] ? ({ $: "dollar", "€": "euro", "£": "pound" }[match[1]]!) : unitName(UNIT.exec(after)?.[1] ?? before ?? "");
    return { value: String(Number(match[2])), unit, text: `${match[2]}${unit ? ` ${unit}` : ""}` };
  });
}

export function unsupportedQuantities(text: string, source: string) {
  const known = quantities(source);
  return quantities(text).filter((item) => {
    // Small discourse counts without a measurement unit can enumerate the supplied material.
    if (!item.unit && Number.isInteger(Number(item.value)) && Number(item.value) >= 0 && Number(item.value) <= 10) return false;
    return !known.some((fact) => fact.value === item.value && (!item.unit || fact.unit === item.unit));
  });
}

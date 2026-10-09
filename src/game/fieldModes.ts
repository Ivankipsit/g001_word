import {
  allFaces,
  cluesReady,
  facesFor,
  type ClueFace,
} from "@/dictionary/clues";
import { EnglishWorld } from "@/dictionary/english";
import {
  canFormWordFromSet,
  pickPlayableStartLetters,
} from "@/game/letters";
import type { GameMode } from "@/game/types";

export const FIELD_MODES = [
  "pos",
  "sense",
  "inflect",
  "synonym",
  "antonym",
  "blank",
  "origin",
  "homophone",
  "pronounce",
  "register",
  "kind",
  "kin",
  "relay",
  "double",
  "trap",
  "decoy",
  "hunt",
] as const;

export type FieldMode = (typeof FIELD_MODES)[number];

const STEP = "\u001f";

export function isFieldMode(mode: GameMode): mode is FieldMode {
  return (FIELD_MODES as readonly string[]).includes(mode);
}

/** Modes where the submit has to be one secret spelling. */
export function fieldHasTarget(mode: GameMode): boolean {
  return isFieldMode(mode) && mode !== "hunt";
}

export interface FieldOpening {
  letters: string[];
  defineTargetWord?: string;
  defineHint?: string;
  clueQueue?: string[];
  clueNote?: string;
}

function posLabel(pos: string): string {
  if (pos === "adj") return "Adjective";
  if (pos === "adv") return "Adverb";
  return pos ? pos.charAt(0).toUpperCase() + pos.slice(1) : "Word";
}

function lettersFor(words: string[]): string[] {
  const letters: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    for (const ch of word.toUpperCase()) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      letters.push(ch);
    }
  }
  const weights = EnglishWorld.letterWeights;
  const alphabet = EnglishWorld.alphabet;
  let guard = 0;
  while (letters.length < 5 && guard < 40) {
    guard += 1;
    let total = 0;
    for (const L of alphabet) total += weights[L] ?? 1;
    let roll = Math.random() * total;
    let pick = alphabet[0] ?? "E";
    for (const L of alphabet) {
      roll -= weights[L] ?? 1;
      if (roll <= 0) {
        pick = L;
        break;
      }
    }
    if (!seen.has(pick)) {
      seen.add(pick);
      letters.push(pick);
    }
  }
  for (let i = letters.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = letters[i]!;
    letters[i] = letters[j]!;
    letters[j] = swap;
  }
  return letters.slice(0, 8);
}

function pickFace(
  ok: (face: ClueFace) => boolean,
  exclude: Set<string>,
): ClueFace | null {
  const pool = allFaces();
  if (pool.length === 0) return null;
  const start = Math.floor(Math.random() * pool.length);
  const hits: ClueFace[] = [];
  for (let n = 0; n < pool.length && hits.length < 40; n += 1) {
    const face = pool[(start + n) % pool.length]!;
    if (exclude.has(face.word)) continue;
    if (face.word.length < 4 || face.word.length > 10) continue;
    if (!EnglishWorld.isValidWord(face.word)) continue;
    if (!ok(face)) continue;
    hits.push(face);
  }
  if (hits.length === 0) return null;
  return hits[Math.floor(Math.random() * hits.length)]!;
}

function pack(target: string, clue: string): string {
  return `${target}${STEP}${clue}`;
}

function unpack(step: string): { target: string; clue: string } {
  const cut = step.indexOf(STEP);
  if (cut < 0) return { target: step, clue: "" };
  return { target: step.slice(0, cut), clue: step.slice(cut + 1) };
}

function familySteps(word: string): { target: string; clue: string }[] {
  const group = facesFor(word);
  const steps: { target: string; clue: string }[] = [];
  const seen = new Set<string>();
  for (const face of group) {
    const key = `${face.pos}:${face.gloss}`;
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push({
      target: face.word,
      clue: `${posLabel(face.pos)} — ${face.gloss}`,
    });
  }
  for (const face of group) {
    for (const [form, tag] of face.forms) {
      if (!EnglishWorld.isValidWord(form) || seen.has(form)) continue;
      seen.add(form);
      steps.push({ target: form, clue: `${tag} of ${word}` });
    }
  }
  return steps;
}

function fromFace(
  face: ClueFace,
  clue: string,
  note = "",
  words: string[] = [face.word],
): FieldOpening {
  return {
    letters: lettersFor(words),
    defineTargetWord: face.word,
    defineHint: clue,
    clueNote: note,
    clueQueue: [],
  };
}

const RELAY = ["gloss", "example", "etym", "syn"] as const;

function relayClue(face: ClueFace, kind: (typeof RELAY)[number]): string {
  if (kind === "gloss") return face.gloss;
  if (kind === "example") return face.example;
  if (kind === "etym") return face.etym;
  if (face.syn) return face.syn;
  const form = face.forms[0];
  return form ? `${form[1]} of ${face.word}` : "";
}

function relayHas(face: ClueFace, kind: (typeof RELAY)[number]): boolean {
  if (kind === "gloss") return Boolean(face.gloss);
  if (kind === "example") return Boolean(face.example);
  if (kind === "etym") return Boolean(face.etym);
  return Boolean(face.syn || face.forms.length);
}

function openRelay(step: number, exclude: Set<string>): FieldOpening | null {
  for (let hop = 0; hop < RELAY.length; hop += 1) {
    const kind = RELAY[(step + hop) % RELAY.length]!;
    const face = pickFace((item) => relayHas(item, kind), exclude);
    if (!face) continue;
    const clue = relayClue(face, kind);
    if (!clue) continue;
    const target =
      kind === "syn" && face.forms[0] && !face.syn
        ? face.forms[0][0]
        : face.word;
    if (!EnglishWorld.isValidWord(target)) continue;
    return {
      letters: lettersFor([target]),
      defineTargetWord: target,
      defineHint: clue,
      clueNote: String((step + hop) % RELAY.length),
      clueQueue: [],
    };
  }
  return null;
}

export function openingFor(mode: FieldMode, exclude: Set<string> = new Set()): FieldOpening | null {
  if (!cluesReady()) return null;
  if (mode === "hunt") {
    return {
      letters: pickPlayableStartLetters(5),
      defineHint: "Ordinary words score. Slang, US, and uncommon words raise the combo.",
      clueQueue: [],
    };
  }
  if (mode === "pos") {
    const face = pickFace(
      (item) => item.pos === "noun" || item.pos === "verb" || item.pos === "adj",
      exclude,
    );
    return face ? fromFace(face, `${posLabel(face.pos)} — ${face.gloss}`) : null;
  }
  if (mode === "sense") {
    const face = pickFace((item) => Boolean(item.alt), exclude);
    return face ? fromFace(face, itemAlt(face)) : null;
  }
  if (mode === "inflect") {
    const face = pickFace(
      (item) => item.forms.some(([form]) => EnglishWorld.isValidWord(form) && !exclude.has(form)),
      exclude,
    );
    const form = face?.forms.find(
      ([spelling]) => EnglishWorld.isValidWord(spelling) && !exclude.has(spelling),
    );
    if (!face || !form) return null;
    return {
      letters: lettersFor([form[0]]),
      defineTargetWord: form[0],
      defineHint: `${form[1]} of ${face.word}`,
      clueQueue: [],
    };
  }
  if (mode === "synonym") {
    const face = pickFace((item) => Boolean(item.syn), exclude);
    return face ? fromFace(face, face.syn) : null;
  }
  if (mode === "antonym") {
    const face = pickFace((item) => Boolean(item.ant), exclude);
    return face ? fromFace(face, face.ant) : null;
  }
  if (mode === "blank") {
    const face = pickFace((item) => Boolean(item.example), exclude);
    return face ? fromFace(face, face.example) : null;
  }
  if (mode === "origin") {
    const face = pickFace((item) => Boolean(item.etym), exclude);
    return face ? fromFace(face, face.etym) : null;
  }
  if (mode === "homophone" || mode === "trap") {
    const face = pickFace((item) => Boolean(item.homo), exclude);
    return face ? fromFace(face, face.homo, face.homo) : null;
  }
  if (mode === "pronounce") {
    const face = pickFace((item) => Boolean(item.ipa), exclude);
    return face ? fromFace(face, face.ipa) : null;
  }
  if (mode === "register") {
    const face = pickFace((item) => Boolean(item.tag), exclude);
    return face ? fromFace(face, `${face.tag} — ${face.gloss}`) : null;
  }
  if (mode === "kind") {
    const face = pickFace((item) => Boolean(item.kind), exclude);
    return face ? fromFace(face, face.kind) : null;
  }
  if (mode === "kin") {
    const face = pickFace((item) => familySteps(item.word).length >= 2, exclude);
    if (!face) return null;
    const steps = familySteps(face.word);
    const [first, ...rest] = steps;
    if (!first) return null;
    return {
      letters: lettersFor(steps.map((step) => step.target)),
      defineTargetWord: first.target,
      defineHint: first.clue,
      clueQueue: rest.map((step) => pack(step.target, step.clue)),
    };
  }
  if (mode === "relay") return openRelay(0, exclude);
  if (mode === "double" || mode === "decoy") {
    const face = pickFace((item) => Boolean(item.alt) || facesFor(item.word).length > 1, exclude);
    if (!face) return null;
    const other =
      face.alt ||
      facesFor(face.word).find((item) => item.gloss !== face.gloss)?.gloss ||
      "";
    if (!other) return null;
    return fromFace(face, face.gloss, other);
  }
  return null;
}

function itemAlt(face: ClueFace): string {
  return face.alt;
}

export function nextFieldOpening(
  mode: FieldMode,
  current: {
    target: string;
    note: string;
    queue: string[];
    letters: string[];
  },
  exclude: Set<string>,
): FieldOpening | null {
  if (mode === "kin" && current.queue.length > 0) {
    const next = unpack(current.queue[0]!);
    return {
      letters: current.letters,
      defineTargetWord: next.target,
      defineHint: next.clue,
      clueQueue: current.queue.slice(1),
      clueNote: "",
    };
  }
  if (mode === "double" && current.note && current.note !== "reopen") {
    return {
      letters: current.letters,
      defineTargetWord: current.target,
      defineHint: current.note,
      clueNote: "reopen",
      clueQueue: [],
    };
  }
  if (mode === "trap") {
    const syn = facesFor(current.target).find((face) => face.syn)?.syn;
    if (syn && EnglishWorld.isValidWord(syn) && canFormWordFromSet(syn, current.letters)) {
      return {
        letters: current.letters,
        defineTargetWord: syn,
        defineHint: `Synonym of ${current.target}`,
        clueNote: "",
        clueQueue: [],
      };
    }
  }
  if (mode === "relay") {
    const step = Number(current.note);
    return openRelay(Number.isFinite(step) ? step + 1 : 1, exclude);
  }
  if (mode === "decoy") {
    const steps = familySteps(current.target);
    const rest = steps.slice(1);
    const next = rest[0];
    if (next) {
      return {
        letters: lettersFor(steps.map((step) => step.target)),
        defineTargetWord: next.target,
        defineHint: next.clue,
        clueQueue: rest.slice(1).map((step) => pack(step.target, step.clue)),
        clueNote: "",
      };
    }
  }
  return openingFor(mode, exclude);
}

export function decoyChoices(hint: string, other: string): { choices: [string, string]; correctIndex: number } | null {
  if (!hint || !other || hint === other) return null;
  const flip = Math.random() < 0.5;
  const choices: [string, string] = flip ? [other, hint] : [hint, other];
  return { choices, correctIndex: choices.indexOf(hint) };
}

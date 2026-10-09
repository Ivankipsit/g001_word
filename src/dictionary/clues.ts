export interface ClueFace {
  word: string;
  pos: string;
  gloss: string;
  alt: string;
  syn: string;
  ant: string;
  example: string;
  etym: string;
  homo: string;
  ipa: string;
  tag: string;
  kind: string;
  forms: [string, string][];
}

type Packed = {
  s?: string;
  a?: string;
  x?: string;
  y?: string;
  h?: string;
  i?: string;
  t?: string;
  k?: string;
  f?: [string, string][];
};

type RawFace = [string, string, string, string, Packed];

const faces: ClueFace[] = [];
const byWord = new Map<string, ClueFace[]>();

let loadPromise: Promise<void> | null = null;
let loaded = false;

function unpack(raw: RawFace): ClueFace {
  const packed = raw[4] ?? {};
  return {
    word: raw[0],
    pos: raw[1],
    gloss: raw[2],
    alt: raw[3] ?? "",
    syn: packed.s ?? "",
    ant: packed.a ?? "",
    example: packed.x ?? "",
    etym: packed.y ?? "",
    homo: packed.h ?? "",
    ipa: packed.i ?? "",
    tag: packed.t ?? "",
    kind: packed.k ?? "",
    forms: Array.isArray(packed.f) ? packed.f : [],
  };
}

export function loadEnglishClues(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const res = await fetch("/dictionary/english-clues.json.gz");
    if (!res.ok) throw new Error(`Clues HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const gzipped = bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    const stream = gzipped
      ? new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))
      : new Blob([buf]).stream();
    const rows = (await new Response(stream).json()) as RawFace[];
    faces.length = 0;
    byWord.clear();
    for (const row of rows) {
      const face = unpack(row);
      faces.push(face);
      const list = byWord.get(face.word);
      if (list) list.push(face);
      else byWord.set(face.word, [face]);
    }
    loaded = true;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

export function cluesReady(): boolean {
  return loaded && faces.length > 0;
}

export function allFaces(): readonly ClueFace[] {
  return faces;
}

export function facesFor(word: string): readonly ClueFace[] {
  return byWord.get(word.trim().toLowerCase()) ?? [];
}

export function wordRegister(word: string): string {
  return facesFor(word).find((face) => face.tag)?.tag ?? "";
}

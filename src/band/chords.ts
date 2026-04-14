export const NOTE_TO_SEMI: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const SEMI_TO_NOTE = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const NOTE_FREQ_4: Record<string, number> = {
  C: 261.63,
  "C#": 277.18,
  Db: 277.18,
  D: 293.66,
  "D#": 311.13,
  Eb: 311.13,
  E: 329.63,
  F: 349.23,
  "F#": 369.99,
  Gb: 369.99,
  G: 392.0,
  "G#": 415.3,
  Ab: 415.3,
  A: 440.0,
  "A#": 466.16,
  Bb: 466.16,
  B: 493.88,
};

const QUALITY_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dim: [0, 3, 6],
};

export interface ParsedChord {
  name: string;
  root: string;
  quality: string;
  rootFreq4: number;
  intervals: number[];
}

export function parseChord(name: string): ParsedChord {
  let root: string;
  let qualitySuffix: string;

  if (name.length >= 2 && (name[1] === "#" || name[1] === "b")) {
    root = name.substring(0, 2);
    qualitySuffix = name.substring(2);
  } else {
    root = name[0];
    qualitySuffix = name.substring(1);
  }

  let quality: string;
  if (qualitySuffix === "" || qualitySuffix === "maj") quality = "major";
  else if (qualitySuffix === "m" || qualitySuffix === "min") quality = "minor";
  else quality = qualitySuffix;

  const rootFreq4 = NOTE_FREQ_4[root] ?? 261.63;
  const intervals = QUALITY_INTERVALS[quality] ?? QUALITY_INTERVALS["major"];

  return { name, root, quality, rootFreq4, intervals };
}

export function getChordFreqs(chord: ParsedChord, octave: number): number[] {
  const octaveShift = Math.pow(2, octave - 4);
  const baseFreq = chord.rootFreq4 * octaveShift;
  return chord.intervals.map((i) => baseFreq * Math.pow(2, i / 12));
}

export function getRootFreq(chord: ParsedChord, octave: number): number {
  return chord.rootFreq4 * Math.pow(2, octave - 4);
}

export function getFifthFreq(chord: ParsedChord, octave: number): number {
  return getRootFreq(chord, octave) * Math.pow(2, 7 / 12);
}

// --- Transposition ---

export function transposeChord(name: string, semitones: number): string {
  const parsed = parseChord(name);
  const rootSemi = NOTE_TO_SEMI[parsed.root] ?? 0;
  const newSemi = ((rootSemi + semitones) % 12 + 12) % 12;
  const newRoot = SEMI_TO_NOTE[newSemi];
  let suffix = "";
  if (parsed.quality === "minor") suffix = "m";
  else if (parsed.quality !== "major") suffix = parsed.quality;
  return newRoot + suffix;
}

export function transposeChart(
  measures: string[],
  fromKey: string,
  toKey: string,
): string[] {
  const fromSemi = NOTE_TO_SEMI[fromKey] ?? 7;
  const toSemi = NOTE_TO_SEMI[toKey] ?? 7;
  const shift = toSemi - fromSemi;
  if (shift === 0) return measures;
  return measures.map((m) => transposeChord(m, shift));
}

// --- Guitar voicings (open chord shapes + capo) ---

// Standard tuning MIDI note numbers
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

// Fret positions for open chord shapes (-1 = muted string)
const GUITAR_SHAPES: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  C7: [-1, 3, 2, 3, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  Dm: [-1, -1, 0, 2, 3, 1],
  D7: [-1, -1, 0, 2, 1, 2],
  E: [0, 2, 2, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  E7: [0, 2, 0, 1, 0, 0],
  G: [3, 2, 0, 0, 0, 3],
  G7: [3, 2, 0, 0, 0, 1],
  A: [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  A7: [-1, 0, 2, 0, 2, 0],
  B7: [-1, 2, 1, 2, 0, 2],
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getCapoForKey(key: string): number {
  const keySemi = NOTE_TO_SEMI[key] ?? 7;
  return ((keySemi - 7) % 12 + 12) % 12;
}

function shapeKeyForChord(
  chordRoot: string,
  chordQuality: string,
  capo: number,
): string | null {
  const chordSemi = NOTE_TO_SEMI[chordRoot] ?? 0;
  const shapeSemi = ((chordSemi - capo) % 12 + 12) % 12;
  const shapeRoot = SEMI_TO_NOTE[shapeSemi];

  let shapeKey: string;
  if (chordQuality === "7") shapeKey = shapeRoot + "7";
  else if (chordQuality === "minor" || chordQuality === "m7")
    shapeKey = shapeRoot + "m";
  else shapeKey = shapeRoot;

  return GUITAR_SHAPES[shapeKey] ? shapeKey : null;
}

export interface GuitarVoicing {
  bass1: number; // root bass note (beat 1)
  bass2: number; // alternating bass (beat 3)
  chuck: number[]; // upper string chord tones (beats 2,4)
}

export function getGuitarVoicing(
  chord: ParsedChord,
  key: string,
): GuitarVoicing {
  const capo = getCapoForKey(key);
  const sKey = shapeKeyForChord(chord.root, chord.quality, capo);

  if (!sKey) {
    return {
      bass1: getRootFreq(chord, 3),
      bass2: getFifthFreq(chord, 2),
      chuck: getChordFreqs(chord, 4),
    };
  }

  const frets = GUITAR_SHAPES[sKey];
  const stringFreqs: number[] = [];
  frets.forEach((fret, i) => {
    if (fret >= 0) {
      stringFreqs.push(midiToFreq(OPEN_STRINGS[i] + capo + fret));
    }
  });

  if (stringFreqs.length < 3) {
    return {
      bass1: stringFreqs[0] ?? getRootFreq(chord, 3),
      bass2: stringFreqs[1] ?? getFifthFreq(chord, 2),
      chuck: getChordFreqs(chord, 4),
    };
  }

  return {
    bass1: stringFreqs[0],
    bass2: stringFreqs[1],
    chuck: stringFreqs.slice(2),
  };
}

// --- Presets ---

export interface Preset {
  name: string;
  key: string;
  measures: string[];
}

export const PRESETS: Preset[] = [
  {
    name: "Wagon Wheel",
    key: "G",
    measures: ["G", "D", "Em", "C", "G", "D", "Em", "C"],
  },
  {
    name: "I-IV-V",
    key: "G",
    measures: ["G", "G", "C", "C", "D", "D", "G", "G"],
  },
  {
    name: "Salty Dog",
    key: "G",
    measures: ["G", "G", "E7", "E7", "A7", "A7", "D7", "D7"],
  },
  {
    name: "Will the Circle",
    key: "G",
    measures: ["G", "G7", "C", "G", "G", "G", "D7", "G"],
  },
  {
    name: "Blue Moon of Kentucky",
    key: "A",
    measures: ["A", "A", "D", "D", "E7", "E7", "A", "A"],
  },
];

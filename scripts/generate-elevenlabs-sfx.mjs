import { mkdir, writeFile } from "node:fs/promises";

const apiKey = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;

if (!apiKey) {
  console.error("Missing ELEVENLABS_API_KEY or XI_API_KEY.");
  process.exit(1);
}

const outputDir = new URL("../public/audio/", import.meta.url);
const endpoint = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128";

const effects = [
  {
    key: "deal",
    file: "card-deal.mp3",
    duration_seconds: 0.7,
    prompt_influence: 0.55,
    text: "A glossy holographic playing card slides onto a futuristic casino table, crisp soft whoosh, subtle plastic tap, premium arcade UI, one-shot, no voice, no music.",
  },
  {
    key: "next",
    file: "card-next.mp3",
    duration_seconds: 0.45,
    prompt_influence: 0.5,
    text: "Short satisfying next-card pop: thin glossy card lifts from a deck with a tiny airy whoosh and soft click, futuristic arcade casino, one-shot, no voice, no music.",
  },
  {
    key: "commit",
    file: "card-commit.mp3",
    duration_seconds: 0.4,
    prompt_influence: 0.55,
    text: "Fast swipe commit sound for a glossy holographic card, bright electric whoosh, tiny sparkle burst, tactile arcade UI, one-shot, no voice, no music.",
  },
  {
    key: "correct",
    file: "card-correct.mp3",
    duration_seconds: 0.55,
    prompt_influence: 0.5,
    text: "Positive arcade correct-answer chime: glassy holographic sparkle, soft casino slot-machine reward tick, clean and satisfying, one-shot, no voice, no melody loop.",
  },
  {
    key: "wrong",
    file: "card-wrong.mp3",
    duration_seconds: 0.55,
    prompt_influence: 0.55,
    text: "Wrong-answer feedback for a futuristic card game: short rubbery buzz, muted electronic thud, not harsh, playful arcade fail, one-shot, no voice, no music.",
  },
  {
    key: "fallAway",
    file: "card-fall-away.mp3",
    duration_seconds: 0.65,
    prompt_influence: 0.55,
    text: "A glossy card misses and falls away off-screen: quick fluttering plastic whoosh, downward slip, soft vanish, futuristic arcade UI, one-shot, no voice, no music.",
  },
];

await mkdir(outputDir, { recursive: true });

for (const effect of effects) {
  console.log(`Generating ${effect.key}...`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: effect.text,
      duration_seconds: effect.duration_seconds,
      prompt_influence: effect.prompt_influence,
      model_id: "eleven_text_to_sound_v2",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs failed for ${effect.key}: ${response.status} ${detail}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(new URL(effect.file, outputDir), bytes);
}

const manifest = {
  enabled: true,
  provider: "elevenlabs",
  files: Object.fromEntries(effects.map((effect) => [effect.key, `/audio/${effect.file}`])),
};

await writeFile(new URL("sfx-manifest.json", outputDir), `${JSON.stringify(manifest, null, 2)}\n`);
console.log("ElevenLabs SFX generated in public/audio.");

# Binary Sort Audio

This folder is ready for ElevenLabs-generated game SFX.

Run this after setting `ELEVENLABS_API_KEY`:

```bash
npm run sfx:elevenlabs
```

The game reads `sfx-manifest.json`. When `enabled` is `false`, it uses lightweight Web Audio synth fallback sounds. The generation script writes MP3 files here and flips the manifest to `enabled: true`.

import { stat } from "node:fs/promises";
import sharp from "sharp";

const assets = [
  {
    source: "public/images/background-option-b.png",
    output: "public/images/background-option-b.webp",
    quality: 82,
  },
  {
    source: "public/images/cards/card-aurora-foil-shell-fit.png",
    output: "public/images/cards/card-aurora-foil-shell-fit.webp",
    quality: 88,
  },
  {
    source: "public/images/cards/card-aurora-foil-back-fit.png",
    output: "public/images/cards/card-aurora-foil-back-fit.webp",
    quality: 88,
  },
  {
    source: "public/images/outcomes/outcome-check-fit.png",
    output: "public/images/outcomes/outcome-check-fit.webp",
    quality: 90,
  },
  {
    source: "public/images/outcomes/outcome-x-fit.png",
    output: "public/images/outcomes/outcome-x-fit.webp",
    quality: 90,
  },
];

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

for (const asset of assets) {
  await sharp(asset.source)
    .webp({
      quality: asset.quality,
      effort: 6,
      smartSubsample: true,
    })
    .toFile(asset.output);

  const sourceSize = (await stat(asset.source)).size;
  const outputSize = (await stat(asset.output)).size;
  const savings = Math.round((1 - outputSize / sourceSize) * 100);
  console.log(`${asset.output}: ${formatBytes(sourceSize)} -> ${formatBytes(outputSize)} (${savings}% smaller)`);
}

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryDirectory = mkdtempSync(join(tmpdir(), "karaoke-react-compat-"));
const reactVersions = ["18.3.1", "19.1.1"];

const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

try {
  const packOutput = JSON.parse(
    run(
      "npm",
      ["pack", "--json", "--pack-destination", temporaryDirectory],
      packageDirectory,
    ),
  );
  const tarball = join(temporaryDirectory, packOutput[0].filename);

  for (const reactVersion of reactVersions) {
    const consumerDirectory = join(
      temporaryDirectory,
      `react-${reactVersion.replaceAll(".", "-")}`,
    );
    mkdirSync(consumerDirectory);
    writeFileSync(
      join(consumerDirectory, "package.json"),
      JSON.stringify(
        {
          private: true,
          type: "module",
          dependencies: {
            "@tidepool/karaoke-player": `file:${tarball}`,
            react: reactVersion,
            "react-dom": reactVersion,
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(consumerDirectory, "verify.mjs"),
      `
        import { createElement } from 'react'
        import { renderToStaticMarkup } from 'react-dom/server'
        import {
          buildSyncedLyricsModel,
          KaraokePlayer,
        } from '@tidepool/karaoke-player'

        const lyrics = [{
          name: 'Verse',
          lines: ['Sing along'],
          durationMs: 900,
        }]
        const model = buildSyncedLyricsModel(lyrics, {
          words_timestamps: [
            { word: 'Sing', start_ms: 0, end_ms: 350 },
            { word: 'along', start_ms: 400, end_ms: 900 },
          ],
        })
        if (model.sections[0].lines[0].words.length !== 2) {
          throw new Error('Alignment exports are not usable')
        }

        const markup = renderToStaticMarkup(
          createElement(KaraokePlayer, {
            audioSrc: '/song.mp3',
            lyrics,
            alignment: {
              words_timestamps: [
                { word: 'Sing', start_ms: 0, end_ms: 350 },
                { word: 'along', start_ms: 400, end_ms: 900 },
              ],
            },
            title: 'Compatibility check',
          }),
        )
        if (!markup.includes('Compatibility check')) {
          throw new Error('KaraokePlayer did not render')
        }
      `,
    );

    run(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
      consumerDirectory,
    );
    run("node", ["verify.mjs"], consumerDirectory);
    process.stdout.write(`React ${reactVersion}: compatible\n`);
  }

  const packageManifest = JSON.parse(
    readFileSync(join(packageDirectory, "package.json"), "utf8"),
  );
  process.stdout.write(
    `${packageManifest.name}@${packageManifest.version}: React compatibility verified\n`,
  );
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}

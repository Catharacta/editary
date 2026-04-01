import { execSync } from "node:child_process";

const commands = [
  "bun run node_modules/electrobun-builder-for-windows/dist/index.js --help",
  "bun x electrobun-builder --help",
  "electrobun-builder --help"
];

for (const cmd of commands) {
  console.log(`\nTesting: ${cmd}`);
  try {
    const output = execSync(cmd, { stdio: "pipe" }).toString();
    console.log("Success!");
    console.log(output.split("\n")[0]); // First line
  } catch (err) {
    console.error(`Failed: ${err.message}`);
    if (err.stderr) console.error(err.stderr.toString());
  }
}

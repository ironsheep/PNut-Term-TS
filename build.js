const { exec } = require("child_process");
const os = require("os");

const platform = os.platform();

let buildCommand =
  "electron-builder build --win --linux --config electron.builder.json";

if (platform === "darwin") {
  buildCommand =
    "electron-builder build --mac --win --linux --config electron.builder.json";
}

console.log(`> ${buildCommand} # from build.js`);

exec(`DEBUG=electron-builder ${buildCommand}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error during build: [${error}]`);
    console.error(`stderr: [${stderr}]`);
    return;
  }
  console.log(`Build output: ${stdout}`);
  console.error(`Build errors: ${stderr}`);
});

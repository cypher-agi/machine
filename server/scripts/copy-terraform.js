/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Terraform dir not found at ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function main() {
  const serverRoot = path.join(__dirname, '..');
  const srcTerraform = path.join(serverRoot, 'src', 'terraform');
  const distTerraform = path.join(serverRoot, 'dist', 'terraform');

  copyDir(srcTerraform, distTerraform);
  console.log(`✓ Copied terraform modules: ${srcTerraform} -> ${distTerraform}`);
}

main();



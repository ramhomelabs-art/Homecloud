const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEPS_DIR = path.join(ROOT_DIR, 'dependencies');

if (!fs.existsSync(DEPS_DIR)) {
    fs.mkdirSync(DEPS_DIR);
}

const targetFolders = ['server', 'client', 'agent'];

console.log('--- NexaDisk Offline Packager ---');

targetFolders.forEach(folder => {
    const pkgPath = path.join(ROOT_DIR, folder, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    console.log(`\nProcessing folder: ${folder}`);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    Object.keys(deps).forEach(dep => {
        try {
            console.log(`  Packing ${dep}...`);
            // Use npm pack to get the .tgz file
            execSync(`npm pack ${dep}`, { cwd: DEPS_DIR, stdio: 'ignore' });
        } catch (error) {
            console.error(`  [ERROR] Failed to pack ${dep}: ${error.message}`);
        }
    });
});

console.log('\n--- Pack Complete ---');
console.log(`All dependencies are saved in: ${DEPS_DIR}`);
console.log('You can now use "npm install ./dependencies/package-name.tgz" for offline installs.');

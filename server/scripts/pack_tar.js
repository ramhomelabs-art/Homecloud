const fs = require('fs');
const path = require('path');
const { TarArchive } = require('archiver');

const sourceDir = path.resolve(__dirname, '..', '..'); // Root folder d:\opt\nexadisk\nexadisk-v2
const targetTarPath = path.resolve(__dirname, '..', '..', 'nexadisk.tar.gz');

console.log('=== NexaDisk Codebase Packager ===');
console.log(`Source Directory: ${sourceDir}`);
console.log(`Target Tarball: ${targetTarPath}`);

function buildTarball() {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(targetTarPath);
        const archive = new TarArchive({ gzip: true });

        output.on('close', () => {
            console.log(`Packed successfully! File size: ${(archive.pointer() / (1024 * 1024)).toFixed(2)} MB`);
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Add the directory excluding node_modules, build directories, and uploads
        archive.glob('**/*', {
            cwd: sourceDir,
            ignore: [
                '**/node_modules/**',
                '**/.git/**',
                'server/uploads/**',
                'debian/build/**',
                'agent/node_modules/**',
                'client/node_modules/**',
                '*.tar.gz',
                'nexadisk.tar.gz'
            ]
        });

        archive.finalize();
    });
}

buildTarball().catch(err => {
    console.error('Packaging failed:', err);
    process.exit(1);
});

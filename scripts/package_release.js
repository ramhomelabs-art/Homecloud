const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { execSync } = require('child_process');

function computeFileSHA256(filePath) {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function buildLocalRelease() {
    console.log('=====================================================');
    console.log('📦 NexaDisk v2 Local Distribution Release Packager');
    console.log('=====================================================\n');

    const rootDir = path.resolve(__dirname, '..');
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'server', 'package.json'), 'utf8'));
    const version = 'v' + (pkg.version || '2.4.0');
    const distDir = path.join(rootDir, 'dist-release');

    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    // 1. Build Client Frontend
    console.log('⚡ Step 1/4: Compiling frontend distribution bundle...');
    try {
        execSync('npm run build', { cwd: path.join(rootDir, 'client'), stdio: 'inherit' });
        console.log('✅ Frontend compiled successfully.');
    } catch (err) {
        console.error('❌ Frontend compilation failed:', err.message);
        process.exit(1);
    }

    // 2. Prepare Zip Archive
    console.log('\n📦 Step 2/4: Packaging server, agent, and compiled client into distribution ZIP...');
    const zip = new AdmZip();

    // Add server (excluding node_modules, logs, uploads)
    const serverDir = path.join(rootDir, 'server');
    const serverFiles = fs.readdirSync(serverDir);
    for (const file of serverFiles) {
        if (['node_modules', 'logs', 'uploads', 'quarantine', 'security_staging', 'scratch'].includes(file)) continue;
        const fullPath = path.join(serverDir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            zip.addLocalFolder(fullPath, path.join('nexadisk-v2', 'server', file));
        } else {
            zip.addLocalFile(fullPath, path.join('nexadisk-v2', 'server'));
        }
    }

    // Add agent
    const agentDir = path.join(rootDir, 'agent');
    if (fs.existsSync(agentDir)) {
        const agentFiles = fs.readdirSync(agentDir);
        for (const file of agentFiles) {
            if (['node_modules', 'logs'].includes(file)) continue;
            const fullPath = path.join(agentDir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                zip.addLocalFolder(fullPath, path.join('nexadisk-v2', 'agent', file));
            } else {
                zip.addLocalFile(fullPath, path.join('nexadisk-v2', 'agent'));
            }
        }
    }

    // Add client dist & package.json
    const clientDist = path.join(rootDir, 'client', 'dist');
    if (fs.existsSync(clientDist)) {
        zip.addLocalFolder(clientDist, path.join('nexadisk-v2', 'client', 'dist'));
    }
    const clientPkg = path.join(rootDir, 'client', 'package.json');
    if (fs.existsSync(clientPkg)) {
        zip.addLocalFile(clientPkg, path.join('nexadisk-v2', 'client'));
    }

    // Add root configs
    const rootConfigs = ['.env.example', 'docker-compose.yml', 'Dockerfile', 'Dockerfile.agent', 'INSTALL.md'];
    for (const cf of rootConfigs) {
        const fp = path.join(rootDir, cf);
        if (fs.existsSync(fp)) {
            zip.addLocalFile(fp, 'nexadisk-v2');
        }
    }

    // Add release manifest
    const manifest = {
        version,
        releaseDate: new Date().toISOString().split('T')[0],
        builtAt: new Date().toISOString(),
        buildPlatform: process.platform,
        nodeVersion: process.version
    };
    zip.addFile(path.join('nexadisk-v2', 'release-manifest.json'), Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    const zipName = `nexadisk-${version}.zip`;
    const zipPath = path.join(distDir, zipName);
    zip.writeZip(zipPath);
    console.log(`✅ Created distribution archive: ${zipPath}`);

    // 3. Compute Checksum
    console.log('\n🔒 Step 3/4: Calculating SHA-256 cryptographic checksum...');
    const checksum = computeFileSHA256(zipPath);
    const checksumFile = path.join(distDir, 'checksums.sha256');
    fs.writeFileSync(checksumFile, `${checksum}  ${zipName}\n`);
    console.log(`Checksum: ${checksum}`);

    // 4. Output Summary
    const stats = fs.statSync(zipPath);
    console.log('\n=====================================================');
    console.log(`🎉 Release ${version} Ready!`);
    console.log(`📁 Package Path: ${zipPath}`);
    console.log(`📊 Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`🔑 SHA-256: ${checksum}`);
    console.log('=====================================================');
}

if (require.main === module) {
    buildLocalRelease().catch(err => {
        console.error('Fatal packager error:', err);
        process.exit(1);
    });
}

module.exports = { buildLocalRelease };

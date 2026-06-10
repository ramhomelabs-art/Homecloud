const fs = require('fs');
const path = require('path');
const os = require('os');
const { TarArchive } = require('archiver');
const { Client } = require('ssh2');

const HOST = '10.10.20.158';
const PORT = 22;
const USERNAME = 'ramhomelabs';
const PASSWORD = process.env.SSH_PASSWORD;

if (!PASSWORD) {
    console.error('ERROR: SSH_PASSWORD environment variable is missing.');
    process.exit(1);
}

const sourceDir = path.resolve(__dirname, '..', '..'); // Root folder d:\opt\nexadisk\nexadisk-v2
const tempTarPath = path.join(os.tmpdir(), 'nexadisk.tar.gz');
const remoteTarPath = '/tmp/nexadisk.tar.gz';

console.log('=== NexaDisk Remote Deployer ===');
console.log(`Source Directory: ${sourceDir}`);
console.log(`Target Host: ${USERNAME}@${HOST}:${PORT}`);
console.log(`Temp Archive: ${tempTarPath}`);

// 1. Archive the codebase excluding heavy directories
function buildTarball() {
    return new Promise((resolve, reject) => {
        console.log('\n[1/4] Packing codebase into tarball...');
        const output = fs.createWriteStream(tempTarPath);
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
                '*.tar.gz'
            ]
        });

        archive.finalize();
    });
}

// 2. Upload file via SFTP
function uploadTarball(conn) {
    return new Promise((resolve, reject) => {
        console.log('\n[2/4] Connecting SFTP and uploading tarball...');
        conn.sftp((err, sftp) => {
            if (err) return reject(err);

            const readStream = fs.createReadStream(tempTarPath);
            const writeStream = sftp.createWriteStream(remoteTarPath);

            writeStream.on('close', () => {
                console.log('Upload complete!');
                resolve();
            });

            writeStream.on('error', (sftpErr) => {
                reject(sftpErr);
            });

            readStream.pipe(writeStream);
        });
    });
}

// 3. Execute remote commands
function executeRemoteCommands(conn) {
    return new Promise((resolve, reject) => {
        console.log('\n[3/4] Running installation commands on remote VM...');
        
        // Commands to extract, build Debian package, install package, and restart service
        const commands = [
            'mkdir -p /tmp/nexadisk-deploy',
            `tar -xzf ${remoteTarPath} -C /tmp/nexadisk-deploy`,
            'cd /tmp/nexadisk-deploy',
            'chmod +x install_deb.sh',
            './install_deb.sh',
            `echo "${PASSWORD}" | sudo -S dpkg -i debian/build/nexadisk_*.deb || (echo "${PASSWORD}" | sudo -S apt-get update && echo "${PASSWORD}" | sudo -S apt-get install -f -y)`,
            `echo "${PASSWORD}" | sudo -S systemctl daemon-reload`,
            `echo "${PASSWORD}" | sudo -S systemctl restart nexadisk`
        ].join(' && ');

        conn.exec(commands, (err, stream) => {
            if (err) return reject(err);

            stream.on('close', (code, signal) => {
                if (code === 0) {
                    console.log('\n[4/4] Remote commands executed successfully!');
                    resolve();
                } else {
                    reject(new Error(`Command exited with code ${code}`));
                }
            }).on('data', (data) => {
                // Pipe standard output from remote commands (filtering password prompts)
                const line = data.toString();
                if (!line.includes('[sudo] password')) {
                    process.stdout.write(line);
                }
            }).stderr.on('data', (data) => {
                const line = data.toString();
                if (!line.includes('[sudo] password')) {
                    process.stderr.write(line);
                }
            });
        });
    });
}

// Main execution flow
async function main() {
    try {
        await buildTarball();

        const conn = new Client();
        conn.on('ready', async () => {
            console.log('SSH connection established successfully!');
            try {
                await uploadTarball(conn);
                await executeRemoteCommands(conn);
                conn.end();
                // Clean up local temp file
                fs.unlinkSync(tempTarPath);
                console.log('\nDeployment finished successfully! 🚀');
                process.exit(0);
            } catch (err) {
                console.error('\nDeployment failed during remote execution:', err.message);
                conn.end();
                process.exit(1);
            }
        }).on('error', (err) => {
            console.error('\nSSH connection failed:', err.message);
            process.exit(1);
        }).connect({
            host: HOST,
            port: PORT,
            username: USERNAME,
            password: PASSWORD,
            readyTimeout: 10000
        });

    } catch (err) {
        console.error('\nDeployment failed:', err.message);
        process.exit(1);
    }
}

main();

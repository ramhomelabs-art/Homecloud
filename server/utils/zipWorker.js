const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const paths = JSON.parse(process.argv[2]);
const outputPath = process.argv[3];

const getAllFiles = (dirs) => {
    let files = [];
    const scan = (itemPath) => {
        if (!fs.existsSync(itemPath)) return;
        try {
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
                const children = fs.readdirSync(itemPath);
                children.forEach(child => scan(path.join(itemPath, child)));
            } else {
                files.push(itemPath);
            }
        } catch (e) {
            console.error(`Error scanning path ${itemPath}: ${e.message}`);
        }
    };
    dirs.forEach(scan);
    return files;
};

const run = async () => {
    try {
        const fileList = getAllFiles(paths);
        const total = fileList.length;
        if (total === 0) {
            if (process.send) process.send({ status: 'completed', progress: 100 });
            process.exit(0);
        }

        const zip = new AdmZip();
        let count = 0;

        const preserveParent = paths.length === 1 && fs.statSync(paths[0]).isDirectory();
        const baseDir = preserveParent ? path.dirname(paths[0]) : paths[0];

        for (const file of fileList) {
            let zipPath = '';
            if (preserveParent) {
                zipPath = path.dirname(path.relative(baseDir, file));
            } else {
                const matchedParent = paths.find(p => file.startsWith(p));
                if (matchedParent && fs.statSync(matchedParent).isDirectory()) {
                    zipPath = path.join(path.basename(matchedParent), path.dirname(path.relative(matchedParent, file)));
                } else {
                    zipPath = '';
                }
            }

            zipPath = zipPath.replace(/\\/g, '/');
            if (zipPath === '.') zipPath = '';

            zip.addLocalFile(file, zipPath);
            count++;
            
            if (process.send && (count % 5 === 0 || count === total)) {
                const progress = Math.round((count / total) * 100);
                process.send({ status: 'progress', progress });
            }
        }

        zip.writeZip(outputPath);
        if (process.send) process.send({ status: 'completed', progress: 100 });
        process.exit(0);
    } catch (err) {
        if (process.send) process.send({ status: 'failed', error: err.message });
        process.exit(1);
    }
};

run();

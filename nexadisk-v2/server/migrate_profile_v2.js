const { pool } = require('./config/database');

const query = `
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS email VARCHAR(255);
`;

pool.query(query).then(() => {
    console.log('Schema updated successfully: added display_name and email columns');
    process.exit(0);
}).catch(e => {
    console.error('Schema update failed', e);
    process.exit(1);
});

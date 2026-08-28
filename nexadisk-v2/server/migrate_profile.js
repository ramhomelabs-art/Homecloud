const { pool } = require('./config/database');

const query = `
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100), 
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100), 
ADD COLUMN IF NOT EXISTS phone VARCHAR(50), 
ADD COLUMN IF NOT EXISTS department VARCHAR(150), 
ADD COLUMN IF NOT EXISTS job_title VARCHAR(150), 
ADD COLUMN IF NOT EXISTS time_zone VARCHAR(50) DEFAULT 'UTC', 
ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'en', 
ADD COLUMN IF NOT EXISTS bio TEXT, 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE, 
ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active', 
ADD COLUMN IF NOT EXISTS avatar_path TEXT, 
ADD COLUMN IF NOT EXISTS avatar_thumbnail_path TEXT, 
ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMP WITH TIME ZONE;
`;

pool.query(query).then(() => {
    console.log('Schema updated successfully');
    process.exit(0);
}).catch(e => {
    console.error('Schema update failed', e);
    process.exit(1);
});

// Migration script: Add share_links, share_security, share_uploads tables
// and fix share_access_logs to reference share_links instead of old shares table
const db = require('./config/database');

async function migrate() {
  console.log('Starting share tables migration...');
  
  try {
    // Step 1: Create share_links table
    await db.query(`
      CREATE TABLE IF NOT EXISTS share_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token VARCHAR(100) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'download',
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        path TEXT NOT NULL,
        title VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE
      )
    `);
    console.log('✅ share_links table ready');

    await db.query('CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token)');
    
    // Step 2: Create share_security table
    await db.query(`
      CREATE TABLE IF NOT EXISTS share_security (
        id SERIAL PRIMARY KEY,
        share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
        password_hash VARCHAR(255),
        email_verification BOOLEAN DEFAULT FALSE,
        max_views INTEGER DEFAULT -1,
        max_downloads INTEGER DEFAULT -1,
        allowed_extensions TEXT,
        max_file_size BIGINT DEFAULT -1
      )
    `);
    console.log('✅ share_security table ready');
    
    // Step 3: Create share_uploads table
    await db.query(`
      CREATE TABLE IF NOT EXISTS share_uploads (
        id SERIAL PRIMARY KEY,
        share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        size BIGINT NOT NULL,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(50)
      )
    `);
    console.log('✅ share_uploads table ready');
    
    // Step 4: Fix share_access_logs - check current structure
    const colRes = await db.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'share_access_logs'
      ORDER BY ordinal_position
    `);
    console.log('Current share_access_logs columns:', colRes.rows.map(r => `${r.column_name}(${r.data_type})`).join(', '));
    
    // Check if share_id column references share_links or old shares table
    const fkRes = await db.query(`
      SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'share_access_logs' AND tc.constraint_type = 'FOREIGN KEY'
    `);
    console.log('FK constraints on share_access_logs:', JSON.stringify(fkRes.rows));
    
    // If share_id exists but references old shares table, fix it
    const needsRebuild = fkRes.rows.some(r => r.foreign_table === 'shares');
    if (needsRebuild) {
      console.log('Rebuilding share_access_logs to reference share_links...');
      
      // Drop old FK constraint
      for (const fk of fkRes.rows.filter(r => r.foreign_table === 'shares')) {
        await db.query(`ALTER TABLE share_access_logs DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
      }
      
      // Add new share_link_id column or alter share_id type
      const hasShareId = colRes.rows.some(r => r.column_name === 'share_id');
      if (hasShareId) {
        // Add new column for the new reference
        await db.query(`
          ALTER TABLE share_access_logs 
          ADD COLUMN IF NOT EXISTS share_link_id UUID REFERENCES share_links(id) ON DELETE CASCADE
        `);
        console.log('Added share_link_id column to share_access_logs');
      }
    } else if (!fkRes.rows.some(r => r.foreign_table === 'share_links')) {
      // share_access_logs exists but has no FK to share_links, add it
      const hasShareLinkId = colRes.rows.some(r => r.column_name === 'share_id' && r.udt_name === 'uuid');
      if (!hasShareLinkId) {
        await db.query(`
          ALTER TABLE share_access_logs 
          ADD COLUMN IF NOT EXISTS share_id UUID REFERENCES share_links(id) ON DELETE CASCADE
        `);
        console.log('Added share_id UUID FK column to share_access_logs');
      }
    } else {
      console.log('share_access_logs already references share_links - OK');
    }
    
    // Verify final state
    const verify = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' AND table_name IN ('share_links','share_security','share_uploads','share_access_logs')
    `);
    console.log('\n✅ Migration complete! Tables:', verify.rows.map(r => r.table_name).join(', '));
    
    // Test a quick insert
    const testInsert = await db.query(
      "INSERT INTO share_links (token, type, path, title, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, token",
      ['MIGTEST', 'download', 'D:/test', 'Migration Test', new Date(Date.now() + 3600000).toISOString()]
    );
    console.log('✅ Test insert OK:', testInsert.rows[0].token);
    await db.query("DELETE FROM share_links WHERE token='MIGTEST'");
    console.log('✅ Test cleanup OK');
    
  } catch(e) {
    console.error('❌ Migration error:', e.message);
    if (e.detail) console.error('Detail:', e.detail);
    if (e.hint) console.error('Hint:', e.hint);
  }
  
  process.exit(0);
}

migrate();

const { Client } = require('pg');

async function cleanupConnections() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:KidsTracker2024@34.42.149.102:5432/kidsactivity'
  });

  try {
    await client.connect();
    
    // Get current connection stats
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total_connections,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle' AND NOW() - state_change > interval '15 minutes') as zombie_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
    `);
    
    const stats = statsResult.rows[0];
    console.log('Current database connections:');
    console.log(`  Total: ${stats.total_connections}`);
    console.log(`  Active: ${stats.active}`);
    console.log(`  Idle: ${stats.idle}`);
    console.log(`  Zombies (idle > 15 min): ${stats.zombie_connections}`);
    
    // Terminate zombie connections (idle for more than 15 minutes)
    if (stats.zombie_connections > 0) {
      const terminateResult = await client.query(`
        SELECT 
          pg_terminate_backend(pid) as terminated,
          pid,
          usename,
          application_name,
          EXTRACT(EPOCH FROM (NOW() - state_change))/60 as idle_minutes,
          LEFT(query, 100) as last_query
        FROM pg_stat_activity 
        WHERE datname = current_database()
          AND state = 'idle'
          AND NOW() - state_change > interval '15 minutes'
          AND pid <> pg_backend_pid()
      `);
      
      console.log(`\nTerminated ${terminateResult.rows.length} zombie connections:`);
      terminateResult.rows.forEach(row => {
        console.log(`  - PID ${row.pid} (${row.usename}) idle for ${Math.round(row.idle_minutes)} minutes`);
        console.log(`    Last query: ${row.last_query.substring(0, 50)}...`);
      });
    } else {
      console.log('\nNo zombie connections found.');
    }
    
    // Also terminate any connections that have been idle in transaction for too long
    const idleInTransactionResult = await client.query(`
      SELECT 
        pg_terminate_backend(pid) as terminated,
        pid,
        usename,
        EXTRACT(EPOCH FROM (NOW() - state_change))/60 as idle_minutes
      FROM pg_stat_activity 
      WHERE datname = current_database()
        AND state = 'idle in transaction'
        AND NOW() - state_change > interval '5 minutes'
        AND pid <> pg_backend_pid()
    `);
    
    if (idleInTransactionResult.rows.length > 0) {
      console.log(`\nTerminated ${idleInTransactionResult.rows.length} idle-in-transaction connections.`);
    }
    
    // Show final stats
    const finalStatsResult = await client.query(`
      SELECT 
        COUNT(*) as total_connections,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'active') as active
      FROM pg_stat_activity 
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
    `);
    
    const finalStats = finalStatsResult.rows[0];
    console.log('\nFinal connection count:');
    console.log(`  Total: ${finalStats.total_connections}`);
    console.log(`  Active: ${finalStats.active}`);
    console.log(`  Idle: ${finalStats.idle}`);
    
  } catch (error) {
    console.error('Error cleaning up connections:', error);
  } finally {
    await client.end();
  }
}

// Run the cleanup
cleanupConnections();
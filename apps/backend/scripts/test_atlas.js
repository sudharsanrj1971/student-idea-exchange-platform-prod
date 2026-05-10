import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  console.log('Testing connection to:', uri ? 'Atlas Cluster (Redacted)' : 'MISSING URI');
  
  if (!uri) process.exit(1);

  try {
    console.log('Attempting connection with 30s timeout...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    
    console.log('✅ SUCCESS: Connected to Atlas!');
    const dbName = mongoose.connection.db.databaseName;
    console.log('Database Name:', dbName);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ CONNECTION FAILED');
    console.error('Error Name:', err.name);
    console.error('Error Code:', err.code);
    console.error('Message:', err.message);
    
    if (err.message.includes('authentication failed')) {
      console.log('👉 Tip: Check your database user password in .env');
    } else if (err.message.includes('whitelist') || err.message.includes('server selection timeout')) {
      console.log('👉 Tip: Even though you whitelisted your IP, it might still be propagating or a firewall is blocking port 27017.');
    }
    
    process.exit(1);
  }
}

testConnection();

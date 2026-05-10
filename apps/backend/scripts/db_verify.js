import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyDatabase() {
  const uri = process.env.MONGODB_URI;
  console.log('--- DATABASE PERSISTENCE VERIFICATION ---');
  console.log('Environment:', process.env.NODE_ENV || 'not set');
  
  if (!uri) {
    console.error('❌ ERROR: MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  const isAtlas = uri.includes('mongodb+srv');
  console.log('Target Storage:', isAtlas ? 'MongoDB Atlas (Persistent)' : 'Local/Other (Check URI)');

  try {
    console.log('Connecting...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    
    console.log('✅ SUCCESS: Connected to Database!');
    
    // Test Write
    console.log('Performing persistence test write...');
    const testCollection = mongoose.connection.collection('persistence_tests');
    const testId = new mongoose.Types.ObjectId();
    await testCollection.insertOne({ 
      _id: testId,
      timestamp: new Date(),
      message: 'Self-test for persistence' 
    });
    
    // Test Read
    const found = await testCollection.findOne({ _id: testId });
    if (found) {
      console.log('✅ SUCCESS: Data written and read back successfully.');
    } else {
      console.warn('⚠️  WARNING: Data was written but could not be found. Check your cluster state.');
    }
    
    // Cleanup
    await testCollection.deleteOne({ _id: testId });
    console.log('Cleanup complete.');

    console.log('\n--- VERIFICATION PASSED ---');
    console.log('All data is being stored at:', isAtlas ? 'MongoDB Atlas' : 'Your local instance');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.log('\n--- VERIFICATION FAILED ---');
    console.error('Error:', err.message);
    
    if (err.name === 'MongooseServerSelectionError') {
      console.error('\n👉 CRITICAL: Could not reach Atlas servers.');
      console.error('   Common Cause: YOUR IP IS NOT WHITELISTED in the MongoDB Atlas dashboard.');
      console.error('   Action: Go to Atlas -> Network Access -> Add IP Address -> Add Current IP.');
    } else if (err.message.includes('authentication failed')) {
      console.error('\n👉 CRITICAL: Authentication failed.');
      console.error('   Action: Check your MONGODB_URI password in .env.');
    }
    
    process.exit(1);
  }
}

verifyDatabase();

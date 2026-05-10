import mongoose from 'mongoose';

const uri = 'mongodb+srv://sudharsanrj1971_db_user:MyDatabasePass123@cluster0.khudzha.mongodb.net/ichange?appName=Cluster0';

async function test() {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('SUCCESS: Connected to MongoDB Atlas');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

test();

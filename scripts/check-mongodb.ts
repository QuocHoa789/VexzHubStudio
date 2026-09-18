import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "vexzhubstudio";

if (!uri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

const client = new MongoClient(uri);
try {
  await client.connect();
  await client.db(databaseName).command({ ping: 1 });
  console.log(`MongoDB connection OK: ${databaseName}`);
} finally {
  await client.close();
}

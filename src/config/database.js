import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  const connectOptions = {
    connectTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: env.MONGODB_SOCKET_TIMEOUT_MS,
  };

  // Fall back to IPv4 if MongoDB Atlas has trouble resolving DNS over IPv6
  if (env.MONGODB_FORCE_IPV4) {
    connectOptions.family = 4;
  }

  await mongoose.connect(env.MONGODB_URI, connectOptions);
  // eslint-disable-next-line no-console
  console.log(`MongoDB connected => database: ${mongoose.connection.name}`);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

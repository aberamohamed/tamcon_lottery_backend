import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  const connectOptions = {
    connectTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: env.MONGODB_SOCKET_TIMEOUT_MS,
  };

  /** Prefer IPv4 for `mongodb+srv` when Atlas SRV returns IPv6-first and the path is broken. */
  if (env.MONGODB_FORCE_IPV4) {
    connectOptions.family = 4;
  }

  await mongoose.connect(env.MONGODB_URI, connectOptions);
  // eslint-disable-next-line no-console
  console.log(`MongoDB connected → database: ${mongoose.connection.name}`);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

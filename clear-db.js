import mongoose from 'mongoose';
import { WalletTransaction } from './src/models/WalletTransaction.js';
import { Payment } from './src/models/Payment.js';
import { Ticket } from './src/models/Ticket.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  await WalletTransaction.deleteMany({});
  await Payment.deleteMany({});
  await Ticket.deleteMany({});
  console.log('Cleared WalletTransactions, Payments, and Tickets');
  process.exit(0);
}
run();

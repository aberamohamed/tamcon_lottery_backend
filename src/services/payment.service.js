import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { initializeTransaction, verifyTransaction } from './chapa.service.js';
import { chapaConfig } from '../config/chapa.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { generateTxRef, generateTicketNumber } from '../utils/cryptoRandom.js';
import { getActiveDrawForNow, recalculateDrawRevenue } from './lottery.service.js';
import { splitFullName } from '../utils/name.js';

// Start a Chapa payment session for a ticket. Checks if they already bought a ticket this week, creates a pending Payment record, and hits Chapa to get the checkout page URL.
export async function createCheckoutSession({ user, quantity }) {
  const draw = await getActiveDrawForNow();
  
  // Check if user already has a ticket for this draw
  const existingTicket = await Ticket.findOne({ userId: user._id, drawId: draw._id });
  if (existingTicket) {
    throw new ApiError(400, 'You already have an active ticket for this draw. Only one ticket per draw is allowed.');
  }

  const amount = 1 * env.TICKET_PRICE_ETB; // Enforce only 1 ticket per purchase

  const txRef = generateTxRef('LOT');
  const { firstName, lastName } = splitFullName(user.fullName);

  const payment = await Payment.create({
    userId: user._id,
    userFullName: user.fullName,
    drawId: draw._id,
    txRef,
    quantity: 1, // Enforce only 1 ticket per purchase
    amount,
    currency: 'ETB',
    status: 'pending',
    paymentMethod: 'chapa',
  });

  const payload = {
    amount: String(amount),
    currency: 'ETB',
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    tx_ref: txRef,
    callback_url: chapaConfig.callbackUrl,
    return_url: `${env.BACKEND_URL}/api/v1/payments/chapa/callback?trx_ref=${txRef}`,
    customization: {
      title: env.APP_NAME,
      description: 'Weekly Lottery Tickets',
    },
    meta: {
      drawId: String(draw._id),
      userId: String(user._id),
      quantity: 1,
    },
  };

  let chapa;
  try {
    chapa = await initializeTransaction(payload);
  } catch (error) {
    await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
    await WalletTransaction.create({
      userId: user._id,
      userFullName: user.fullName,
      type: 'deposit',
      amount,
      balanceBefore: user.walletBalance || 0,
      balanceAfter: user.walletBalance || 0,
      referenceId: payment._id,
      description: `Failed to initialize Chapa payment: ${error.message || 'Network timeout'}`,
      status: 'failed',
    });
    throw new ApiError(502, `Payment initialization failed: ${error.message || 'Connection timeout'}`, error);
  }

  const checkoutUrl = chapa?.data?.checkout_url;
  if (!checkoutUrl) {
    await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
    await WalletTransaction.create({
      userId: user._id,
      userFullName: user.fullName,
      type: 'deposit',
      amount,
      balanceBefore: user.walletBalance || 0,
      balanceAfter: user.walletBalance || 0,
      referenceId: payment._id,
      description: 'Chapa failed to return a checkout URL.',
      status: 'failed',
    });
    throw new ApiError(502, 'Could not start payment session', chapa);
  }

  payment.checkoutUrl = checkoutUrl;
  await payment.save();

  return { checkoutUrl, txRef, paymentId: payment._id, amount, drawId: draw._id };
}



// Generate a ticket number and make sure it's not already taken in this draw. Retries up to 50 times before giving up.
async function generateUniqueTicketNumber(session, drawId) {
  for (let i = 0; i < 50; i += 1) {
    const ticketNumber = generateTicketNumber();
    const exists = await Ticket.findOne({ drawId, ticketNumber })
      .session(session)
      .select('_id')
      .lean();
    if (!exists) return ticketNumber;
  }
  throw new ApiError(500, 'Could not allocate unique ticket numbers');
}

// Once Chapa verifies the payment, this function completes the order: records the deposit, deducts the ticket cost, generates unique tickets, and updates draw statistics. All inside a database transaction to prevent errors.
export async function fulfillPaymentFromChapa(txRef) {
  const payment = await Payment.findOne({ txRef }).populate('drawId');
  if (!payment) {
    throw new ApiError(404, 'Payment record not found for this reference');
  }

  // If already success, just return it
  if (payment.status === 'success' && payment.ticketsIssued) {
    console.log(`[Fulfill] Payment ${txRef} already processed successfully.`);
    return { alreadyProcessed: true, payment };
  }

  let remote;
  try {
    remote = await verifyTransaction(txRef);
  } catch (error) {
    payment.status = 'failed';
    await payment.save();

    const exists = await WalletTransaction.findOne({ referenceId: payment._id, status: 'failed' });
    if (!exists) {
      const user = await User.findById(payment.userId);
      if (user) {
        await WalletTransaction.create({
          userId: payment.userId,
          userFullName: payment.userFullName,
          type: 'deposit',
          amount: payment.amount,
          balanceBefore: user.walletBalance || 0,
          balanceAfter: user.walletBalance || 0,
          referenceId: payment._id,
          description: `Chapa verification query failed: ${error.message || 'Connection timeout'}`,
          status: 'failed',
        });
      }
    }
    throw new ApiError(502, `Payment verification query failed: ${error.message || 'Connection timeout'}`, error);
  }

  const data = remote?.data ?? remote;
  const status = String(data?.status || data?.payment_status || remote?.status || '').toLowerCase();

  if (status !== 'success') {
    payment.status = 'failed';
    await payment.save();

    const exists = await WalletTransaction.findOne({ referenceId: payment._id, status: 'failed' });
    if (!exists) {
      const user = await User.findById(payment.userId);
      if (user) {
        await WalletTransaction.create({
          userId: payment.userId,
          userFullName: payment.userFullName,
          type: 'deposit',
          amount: payment.amount,
          balanceBefore: user.walletBalance || 0,
          balanceAfter: user.walletBalance || 0,
          referenceId: payment._id,
          description: `Payment verification failed: Chapa reported status as "${status}"`,
          status: 'failed',
        });
      }
    }
    throw new ApiError(400, `Payment verification failed: status is ${status}`);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // Re-fetch within session to prevent race conditions
      const payment = await Payment.findOne({ txRef }).session(session).populate('drawId');
      if (!payment) throw new ApiError(404, 'Payment not found in session');
      
      if (payment.status === 'success' && payment.ticketsIssued) {
        result = { alreadyProcessed: true, payment };
        return;
      }

      const expected = payment.amount;
      const paid = Number.parseFloat(String(data.amount));
      if (!Number.isFinite(paid) || Math.abs(paid - expected) > 0.01) {
        throw new ApiError(400, 'Paid amount mismatch');
      }
      if (String(data.currency || '').toUpperCase() !== 'ETB') {
        throw new ApiError(400, 'Currency mismatch');
      }

      payment.status = 'success';
      payment.chapaReference = data.reference || data.chapa_reference;
      payment.verifiedAt = new Date();
      payment.meta = { chapaVerify: data };
      await payment.save({ session });

      // Handle Ticket Purchase
        const draw = payment.drawId;
        if (!draw || draw.status !== 'open') {
          throw new ApiError(400, 'Draw is not open for ticket issuance');
        }

        const user = await User.findById(payment.userId).session(session);
        if (!user) throw new ApiError(404, 'User not found for balance update');

        // Step 1: Deposit paid amount to wallet
        const balanceBeforeDeposit = user.walletBalance || 0;
        const balanceAfterDeposit = balanceBeforeDeposit + payment.amount;

        await WalletTransaction.create(
          [
            {
              userId: payment.userId,
              userFullName: user.fullName,
              type: 'deposit',
              amount: payment.amount,
              balanceBefore: balanceBeforeDeposit,
              balanceAfter: balanceAfterDeposit,
              referenceId: payment._id,
              description: 'Auto-deposit for ticket purchase',
            },
          ],
          { session }
        );

        // Step 2: Deduct ticket cost from wallet
        const ticketTotalCost = payment.quantity * env.TICKET_PRICE_ETB;
        if (balanceAfterDeposit < ticketTotalCost) {
           throw new ApiError(400, 'Insufficient funds after deposit');
        }
        
        const balanceAfterPurchase = balanceAfterDeposit - ticketTotalCost;
        user.walletBalance = balanceAfterPurchase;
        await user.save({ session });

        await WalletTransaction.create(
          [
            {
              userId: payment.userId,
              userFullName: user.fullName,
              type: 'ticket_purchase',
              amount: -ticketTotalCost, // Negative amount for deduction
              balanceBefore: balanceAfterDeposit,
              balanceAfter: balanceAfterPurchase,
              referenceId: payment._id,
              description: `Ticket purchase deduction (${payment.quantity} tickets)`,
            },
          ],
          { session }
        );

        // Step 3: Issue Tickets
        const purchaseDate = new Date();
        const tickets = [];
        for (let n = 0; n < payment.quantity; n += 1) {
          const ticketNumber = await generateUniqueTicketNumber(session, draw._id);
          const created = await Ticket.create(
            [
              {
                userId: payment.userId,
                drawId: draw._id,
                ticketNumber,
                paymentId: payment._id,
                ticketPrice: env.TICKET_PRICE_ETB,
                purchaseDate,
                status: 'active',
              },
            ],
            { session },
          );
          tickets.push(created[0]);
        }

        payment.ticketsIssued = true;
        await payment.save({ session });

        const revenue = await recalculateDrawRevenue(draw._id, session);
        result = { payment, tickets, revenue, type: 'ticket', newBalance: balanceAfterPurchase };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

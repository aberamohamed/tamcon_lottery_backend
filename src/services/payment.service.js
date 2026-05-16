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

/**
 * Initiates a new checkout session for a ticket purchase using Chapa.
 * Validates the user does not already have a ticket for the current draw,
 * creates a pending Payment record, and gets the checkout URL from Chapa.
 * 
 * @param {Object} params - The checkout parameters.
 * @param {Object} params.user - The user initiating the checkout.
 * @param {number} params.quantity - The number of tickets to purchase.
 * @returns {Promise<Object>} An object containing the checkout URL, transaction reference, payment ID, amount, and draw ID.
 * @throws {ApiError} If the user already has a ticket or the payment session could not be started.
 */
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

  const chapa = await initializeTransaction(payload);
  const checkoutUrl = chapa?.data?.checkout_url;
  if (!checkoutUrl) {
    await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
    throw new ApiError(502, 'Could not start payment session', chapa);
  }

  payment.checkoutUrl = checkoutUrl;
  await payment.save();

  return { checkoutUrl, txRef, paymentId: payment._id, amount, drawId: draw._id };
}



/**
 * Generates a unique, non-colliding ticket number for a specific draw.
 * Retries up to 50 times to find a unique number.
 * 
 * @param {mongoose.ClientSession} session - The current Mongoose transaction session.
 * @param {mongoose.Types.ObjectId} drawId - The ID of the draw for which the ticket is generated.
 * @returns {Promise<string>} A unique ticket number.
 * @throws {ApiError} If a unique number cannot be found after 50 attempts.
 */
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

/**
 * Fulfills a payment after successful verification from Chapa.
 * Updates the payment status, deposits funds into the user's wallet,
 * deducts the ticket cost, issues the tickets, and updates the draw revenue.
 * All these operations are wrapped in a database transaction to ensure atomicity.
 * 
 * @param {string} txRef - The transaction reference of the payment to fulfill.
 * @returns {Promise<Object>} An object containing the updated payment, issued tickets, and new user balance.
 * @throws {ApiError} If the payment is not found, verification fails, or there are insufficient funds.
 */
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

  const remote = await verifyTransaction(txRef);
  const data = remote?.data ?? remote;
  const status = String(data?.status || data?.payment_status || remote?.status || '').toLowerCase();

  if (status !== 'success') {
    if (status === 'failed' || status === 'cancelled') {
      payment.status = status;
      await payment.save();
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

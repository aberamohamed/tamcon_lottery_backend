import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';
import { Ticket } from '../models/Ticket.js';
import { initializeTransaction, verifyTransaction } from './chapa.service.js';
import { chapaConfig } from '../config/chapa.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { generateTxRef, generateTicketNumber } from '../utils/cryptoRandom.js';
import { getActiveDrawForNow, recalculateDrawRevenue } from './lottery.service.js';
import { splitFullName } from '../utils/name.js';

export async function createCheckoutSession({ user, quantity }) {
  const draw = await getActiveDrawForNow();
  const amount = quantity * env.TICKET_PRICE_ETB;
  const txRef = generateTxRef('LOT');
  const { firstName, lastName } = splitFullName(user.fullName);

  const payment = await Payment.create({
    userId: user._id,
    drawId: draw._id,
    txRef,
    quantity,
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
    return_url: chapaConfig.returnUrl,
    customization: {
      title: env.APP_NAME,
      description: `Weekly lottery — ${quantity} ticket(s)`,
    },
    meta: {
      drawId: String(draw._id),
      userId: String(user._id),
      quantity,
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

export async function fulfillPaymentFromChapa(txRef) {
  const remote = await verifyTransaction(txRef);
  const data = remote?.data ?? remote;
  const status = String(data?.status || data?.payment_status || remote?.status || '').toLowerCase();
  if (status !== 'success') {
    throw new ApiError(400, 'Payment not successful');
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({ txRef }).session(session).populate('drawId');
      if (!payment) {
        throw new ApiError(404, 'Payment not found');
      }
      if (payment.ticketsIssued) {
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

      const draw = payment.drawId;
      if (!draw || draw.status !== 'open') {
        throw new ApiError(400, 'Draw is not open for ticket issuance');
      }

      payment.status = 'success';
      payment.chapaReference = data.reference || data.chapa_reference;
      payment.verifiedAt = new Date();
      payment.meta = { chapaVerify: data };
      await payment.save({ session });

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

      result = { payment, tickets, revenue };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

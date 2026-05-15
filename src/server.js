import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { startOtpCleanupJob } from './jobs/otpCleanup.job.js';

async function main() {
  await connectDatabase();
  startOtpCleanupJob();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`${env.APP_NAME} listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', err);
  const name = err?.name || '';
  const msg = String(err?.message || '');
  if (name === 'MongooseServerSelectionError' || msg.includes('Server selection timed out')) {
    // eslint-disable-next-line no-console
    console.error(`
MongoDB could not reach any server (often Atlas Network Access or IPv6).

  • Atlas → Network Access → Add IP Address → “Add Current IP Address” (or 0.0.0.0/0 only for dev).
  • Confirm the database user/password and that the DB name in your URI path exists.
  • If you are on VPN / strict firewall, allow outbound TLS to port 27017 on Atlas hosts.
`);
  }
  if (name === 'MongoNetworkTimeoutError' || msg.includes('secureConnect')) {
    // eslint-disable-next-line no-console
    console.error(`
TLS handshake to MongoDB timed out (TCP may be reaching Atlas but TLS stalls).

  • Temporarily disable VPN / “web shield” / HTTPS scanning in antivirus (common cause).
  • Try another network (e.g. phone hotspot) to rule out ISP or office firewall.
  • In .env you can raise timeouts: MONGODB_CONNECT_TIMEOUT_MS=90000 MONGODB_SERVER_SELECTION_TIMEOUT_MS=90000
  • Atlas → Network Access must still allow your IP (see message above).
`);
  }
  process.exit(1);
});

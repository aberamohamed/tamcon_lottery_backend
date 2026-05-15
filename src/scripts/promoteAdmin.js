import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';

const email = process.argv[2];
if (!email) {
  // eslint-disable-next-line no-console
  console.error('Usage: node src/scripts/promoteAdmin.js user@example.com');
  process.exit(1);
}

async function main() {
  await connectDatabase();
  const normalized = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalized });
  if (!user) {
    // eslint-disable-next-line no-console
    console.error('User not found. Sign up once via OTP first.');
    process.exit(1);
  }
  user.role = 'admin';
  await user.save();
  // eslint-disable-next-line no-console
  console.log(`Promoted ${user.email} to admin`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectDatabase();
  });

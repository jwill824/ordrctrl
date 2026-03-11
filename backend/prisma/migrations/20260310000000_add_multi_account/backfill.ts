// Backfill accountIdentifier from stored tokens for existing integrations.
// Run AFTER applying the migration SQL (step 2 sets a placeholder).
// Decrypts each integration's token to extract the real account email.

import { PrismaClient } from '@prisma/client';
import { decrypt } from '../../../src/lib/encryption.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const integrations = await prisma.integration.findMany({
    where: { accountIdentifier: { startsWith: 'unknown@' } },
    select: { id: true, serviceId: true, encryptedAccessToken: true, encryptedRefreshToken: true },
  });

  console.log(`Backfilling ${integrations.length} integration(s)...`);

  for (const integration of integrations) {
    let email = `unknown@${integration.serviceId}`;

    try {
      if (integration.serviceId === 'apple_calendar') {
        // For Apple, encryptedAccessToken stores the email directly
        email = decrypt(integration.encryptedAccessToken);
      } else if (integration.serviceId === 'gmail') {
        // For Gmail, id_token is in the token data — placeholder already set
        // Real extraction needs the id_token which isn't stored separately
        // Best effort: keep the unknown placeholder (user will reconnect)
        email = `unknown@gmail.com`;
      } else if (integration.serviceId === 'microsoft_tasks') {
        email = `unknown@microsoft.com`;
      }
    } catch {
      // decryption failed — keep placeholder
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: { accountIdentifier: email },
    });

    console.log(`  Updated ${integration.id} → ${email}`);
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

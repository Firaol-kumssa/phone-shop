import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      fullName: 'Shop Owner',
      username: 'admin',
      email: 'admin@phoneshop.local',
      passwordHash,
      role: UserRole.Admin,
    },
  });

  console.log(
    `Seeded admin user "${admin.username}"` +
      (process.env.SEED_ADMIN_PASSWORD ? ' (password from SEED_ADMIN_PASSWORD)' : ' (default password: Admin123! — change it)'),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

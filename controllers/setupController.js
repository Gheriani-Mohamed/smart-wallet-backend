//** The Setup Controller to create basic data ** just bech nesn3o basics/



const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create test user and wallet
exports.setupTestData = async (req, res) => {
  try {
    // 1. Create test user
    const user = await prisma.user.upsert({
      where: { id: 'user123' },
      update: {},
      create: {
        id: 'user123',
        email: 'test@example.com',
        password: 'test123', // hedha lezmo cypted Sirine--
        name: 'Test User',
      },
    });

    console.log('✅ User created:', user.id);

    // 2. Create test wallet
    const wallet = await prisma.wallet.upsert({
      where: { id: 'wallet123' },
      update: {},
      create: {
        id: 'wallet123',
        name: 'Personal Wallet',
        type: 'personal',
        balance: 1000.0,
      },
    });

    console.log('✅ Wallet created:', wallet.id);


    const foodCategory = await prisma.category.findFirst({
      where: { name: 'Food' }
    });

    
    const budget = await prisma.budget.create({
      data: {
        userId: 'user123',
        walletId: 'wallet123',
        categoryId: foodCategory.id,  // CHANGED
        monthlyLimit: 500,
        month: '2026-02',
      },
        });


    // 3. Link user to wallet
    const walletMember = await prisma.walletMember.upsert({
      where: {
        userId_walletId: {
          userId: 'user123',
          walletId: 'wallet123',
        },
      },
      update: {},
      create: {
        userId: 'user123',
        walletId: 'wallet123',
      },
    });

    console.log('✅ Wallet member created');

    res.json({
      message: 'Test data created successfully!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      wallet: {
        id: wallet.id,
        name: wallet.name,
        balance: wallet.balance,
      },
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Clear all test data ba3d mankmlo
exports.clearTestData = async (req, res) => {
  try {
    // Delete in order (respect foreign keys)
    await prisma.alert.deleteMany({ where: { userId: 'user123' } });
    await prisma.budget.deleteMany({ where: { userId: 'user123' } });
    await prisma.transaction.deleteMany({ where: { userId: 'user123' } });
    await prisma.walletMember.deleteMany({ where: { userId: 'user123' } });
    await prisma.wallet.deleteMany({ where: { id: 'wallet123' } });
    await prisma.user.deleteMany({ where: { id: 'user123' } });

    res.json({ message: 'Test data cleared!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
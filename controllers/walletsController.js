const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all wallets
exports.getWallets = async (req, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      include: {
        members: true,
        transactions: true,
        budgets: true,
        savingGoals: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(wallets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Create wallet
exports.createWallet = async (req, res) => {
  try {
    const { name, type, balance = 0, currency = 'USD' } = req.body;

    // prevent duplicate wallet type
    const existing = await prisma.wallet.findFirst({
      where: { type },
    });

    if (existing) {
      return res.status(400).json({
        error: `Wallet with type ${type} already exists`,
      });
    }

    const wallet = await prisma.wallet.create({
      data: {
        name,
        type,
        balance,
        currency,
      },
    });

    res.json(wallet);
  } catch (error) {
    console.error("Error creating wallet:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update balance only
exports.updateWalletBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { balance } = req.body;

    const wallet = await prisma.wallet.update({
      where: { id },
      data: { balance },
    });

    res.json(wallet);
  } catch (error) {
    console.error("Error updating wallet:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete wallet
exports.deleteWallet = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.wallet.delete({
      where: { id },
    });

    res.json({ message: "Wallet deleted successfully" });
  } catch (error) {
    console.error("Error deleting wallet:", error);
    res.status(500).json({ error: error.message });
  }
};


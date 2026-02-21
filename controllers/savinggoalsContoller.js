const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== SAVING GOAL CRUD ====================

// Create saving goal
exports.createSavingGoal = async (req, res) => {
  try {
    const { userId, walletId, title, targetAmount, startDate, endDate } = req.body;

    // Parse dates at noon to avoid timezone issues
    const parseDate = (dateString) => {
      if (!dateString) return null;
      const parts = dateString.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    };

    const savingGoal = await prisma.savingGoal.create({
  data: {
    title,
    targetAmount,
    currentAmount: 0,
    startDate: parseDate(startDate),
    endDate: parseDate(endDate) ?? new Date(), // ensure non-null
    isCompleted: false,

    user: { connect: { id: userId } },
    wallet: { connect: { id: walletId } },
  },
  include: {
    wallet: {
      select: { id: true, name: true, type: true },
    },
  },
});

    res.status(201).json(savingGoal);
  } catch (error) {
    console.error('Error creating saving goal:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all saving goals for a user
exports.getUserSavingGoals = async (req, res) => {
  try {
    const { userId } = req.params;

    const savingGoals = await prisma.savingGoal.findMany({
      where: { userId },
      include: {
        wallet: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(savingGoals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get saving goals for a wallet
exports.getWalletSavingGoals = async (req, res) => {
  try {
    const { walletId } = req.params;

    const savingGoals = await prisma.savingGoal.findMany({
      where: { walletId },
      include: {
        wallet: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(savingGoals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single saving goal
exports.getSavingGoalById = async (req, res) => {
  try {
    const { id } = req.params;

    const savingGoal = await prisma.savingGoal.findUnique({
      where: { id },
      include: {
        wallet: true,
      },
    });

    if (!savingGoal) {
      return res.status(404).json({ error: 'Saving goal not found' });
    }

    res.json(savingGoal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update saving goal
exports.updateSavingGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, targetAmount, endDate } = req.body;

    const savingGoal = await prisma.savingGoal.update({
      where: { id },
      data: {
        title,
        targetAmount,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });

    res.json(savingGoal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add money to saving goal (manual contribution)
exports.addContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;

    const savingGoal = await prisma.savingGoal.findUnique({
      where: { id },
    });

    if (!savingGoal) {
      return res.status(404).json({ error: 'Saving goal not found' });
    }

    const newAmount = savingGoal.currentAmount + amount;
    const isCompleted = newAmount >= savingGoal.targetAmount;

    // Create corresponding expense transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: savingGoal.userId,
        walletId: savingGoal.walletId,
        categoryId: "6f5e99b1-8148-4506-b5c2-a461167bf470", // e.g., "saving contributions"
        amount,
        type: "expense",
        description: description || `Contribution to ${savingGoal.title}`,
        date: new Date(),
      },
     
    });

    //update wallet balance
    const balanceChange = -amount;
    await prisma.wallet.update({
      where: { id: savingGoal.walletId },
      data: {
        balance: {
          increment: balanceChange,
        },
      },
    });
    // Update saving goal
    const updatedGoal = await prisma.savingGoal.update({
      where: { id },
      data: {
        currentAmount: newAmount,
        isCompleted,
      },
    });

    res.json({ savingGoal: updatedGoal, transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Withdraw money from saving goal
exports.withdrawFromGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const savingGoal = await prisma.savingGoal.findUnique({
      where: { id },
    });

    if (!savingGoal) {
      return res.status(404).json({ error: 'Saving goal not found' });
    }

    if (amount > savingGoal.currentAmount) {
      return res.status(400).json({ error: 'Insufficient funds in goal' });
    }

    const newAmount = savingGoal.currentAmount - amount;

      // Create corresponding expense transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: savingGoal.userId,
        walletId: savingGoal.walletId,
        categoryId: "c58708fc-b25c-4d68-b4f4-61d497710154", // e.g., "saving contributions"
        amount,
        type: "income",
        description: `Withdraw from saving: ${savingGoal.title}`,
        date: new Date(),
      },
     
    });
    
    //update wallet balance
    const balanceChange = +amount;
    await prisma.wallet.update({
      where: { id: savingGoal.walletId },
      data: {
        balance: {
          increment: balanceChange,
        },
      },
    });
    // Update saving goal
    const updatedGoal = await prisma.savingGoal.update({
      where: { id },
      data: {
        currentAmount: newAmount,
        isCompleted: false, // No longer completed if withdrawn
      },
    });

    res.json(updatedGoal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete saving goal
exports.deleteSavingGoal = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.savingGoal.delete({
      where: { id },
    });

    res.json({ message: 'Saving goal deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
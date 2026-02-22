const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== RECURRING TRANSACTION CRUD ====================

// Create recurring transaction
exports.createRecurringTransaction = async (req, res) => {
  try {
    const { userId, walletId, categoryId, amount, type, description, frequency, startDate, endDate } = req.body;

    const parseDate = (dateString) => {
      if (!dateString) return null;
      const parts = dateString.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    };

    const recurringTransaction = await prisma.recurringTransaction.create({
      data: {
        userId,
        walletId,
        categoryId,
        amount,
        type,
        description,
        frequency,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        lastGenerated: parseDate(startDate),
        isActive: true,
      },
      include: {
        wallet: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // Create the first transaction immediately on creation
    const now = new Date();
    const transaction = await prisma.transaction.create({
      data: {
        userId: recurringTransaction.userId,
        walletId: recurringTransaction.walletId,
        categoryId: recurringTransaction.categoryId,
        amount: recurringTransaction.amount,
        type: recurringTransaction.type,
        description: recurringTransaction.description
          ? `${recurringTransaction.description} (Auto-generated)`
          : 'Auto-generated from recurring transaction',
        date: now,
        recurringTransactionId: recurringTransaction.id,
      },
      include: { category: true },
    });

    // ✅ Update wallet balance for the first transaction
    const balanceChange = recurringTransaction.type === 'income'
      ? recurringTransaction.amount
      : -recurringTransaction.amount;

    await prisma.wallet.update({
      where: { id: recurringTransaction.walletId },
      data: { balance: { increment: balanceChange } },
    });

    // ✅ Update budget if expense
    if (recurringTransaction.type === 'expense') {
      const currentMonth = now.toISOString().slice(0, 7);
      const budget = await prisma.budget.findFirst({
        where: {
          walletId: recurringTransaction.walletId,
          categoryId: recurringTransaction.categoryId,
          month: currentMonth,
          isActive: true,
        },
      });

      if (budget) {
        const updatedBudget = await prisma.budget.update({
          where: { id: budget.id },
          data: { currentSpent: { increment: recurringTransaction.amount } },
        });
        await checkBudgetThreshold(
          budget.id,
          updatedBudget.currentSpent,
          updatedBudget.monthlyLimit,
          budget.userId
        );
      }
    }

    res.status(201).json(recurringTransaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all recurring transactions for a user
exports.getUserRecurringTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const recurringTransactions = await prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
      include: {
        wallet: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(recurringTransactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get recurring transactions for a wallet
exports.getWalletRecurringTransactions = async (req, res) => {
  try {
    const { walletId } = req.params;
    const recurringTransactions = await prisma.recurringTransaction.findMany({
      where: { walletId, isActive: true },
      include: {
        wallet: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(recurringTransactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single recurring transaction
exports.getRecurringTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const recurringTransaction = await prisma.recurringTransaction.findUnique({
      where: { id },
      include: {
        wallet: true,
        transactions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });
    if (!recurringTransaction) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }
    res.json(recurringTransaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update recurring transaction
exports.updateRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, amount, type, description, frequency, endDate, isActive } = req.body;
    const recurringTransaction = await prisma.recurringTransaction.update({
      where: { id },
      data: {
        categoryId,
        amount,
        type,
        description,
        frequency,
        endDate: endDate ? new Date(endDate) : null,
        isActive,
      },
      include: {
        wallet: { select: { id: true, name: true, type: true } },
      },
    });
    res.json(recurringTransaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete recurring transaction (soft delete)
exports.deleteRecurringTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const recurringTransaction = await prisma.recurringTransaction.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ message: 'Recurring transaction deleted successfully', recurringTransaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== AUTO-GENERATION ====================

// Generate due transactions for a specific recurring transaction
exports.generateTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const recurringTransaction = await prisma.recurringTransaction.findUnique({ where: { id } });

    if (!recurringTransaction) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }
    if (!recurringTransaction.isActive) {
      return res.status(400).json({ error: 'Recurring transaction is not active' });
    }

    const generatedTransactions = await generateDueTransactions(recurringTransaction);
    res.json({
      message: `Generated ${generatedTransactions.length} transaction(s)`,
      transactions: generatedTransactions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Generate all due transactions for a user
exports.generateAllUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const recurringTransactions = await prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
    });

    let totalGenerated = 0;
    for (const recurring of recurringTransactions) {
      const transactions = await generateDueTransactions(recurring);
      totalGenerated += transactions.length;
    }

    res.json({
      message: `Generated ${totalGenerated} transaction(s) from ${recurringTransactions.length} recurring templates`,
      totalGenerated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== HELPER FUNCTIONS ====================

async function generateDueTransactions(recurringTransaction) {
  const generatedTransactions = [];
  //const now = new Date(); 
  const now = new Date(2026, 2, 3, 20, 42, 0);
  let nextDate = getNextOccurrence(recurringTransaction.lastGenerated, recurringTransaction.frequency);

  while (nextDate <= now) {
    // Check if past end date
    if (recurringTransaction.endDate && nextDate > recurringTransaction.endDate) {
      await prisma.recurringTransaction.update({
        where: { id: recurringTransaction.id },
        data: { isActive: false },
      });
      break;
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: recurringTransaction.userId,
        walletId: recurringTransaction.walletId,
        categoryId: recurringTransaction.categoryId,
        amount: recurringTransaction.amount,
        type: recurringTransaction.type,
        description: recurringTransaction.description
          ? `${recurringTransaction.description} (Auto-generated)`
          : 'Auto-generated from recurring transaction',
        date: nextDate,
        recurringTransactionId: recurringTransaction.id,
      },
      include: { category: true },
    });

    generatedTransactions.push(transaction);

    // ✅ Update wallet balance
    const balanceChange = recurringTransaction.type === 'income'
      ? recurringTransaction.amount
      : -recurringTransaction.amount;

    await prisma.wallet.update({
      where: { id: recurringTransaction.walletId },
      data: { balance: { increment: balanceChange } },
    });

    // ✅ Update budget if expense
    if (recurringTransaction.type === 'expense') {
      const month = nextDate.toISOString().slice(0, 7);
      const budget = await prisma.budget.findFirst({
        where: {
          walletId: recurringTransaction.walletId,
          categoryId: recurringTransaction.categoryId,
          month,
          isActive: true,
        },
      });

      if (budget) {
        const updatedBudget = await prisma.budget.update({
          where: { id: budget.id },
          data: { currentSpent: { increment: recurringTransaction.amount } },
        });
        await checkBudgetThreshold(
          budget.id,
          updatedBudget.currentSpent,
          updatedBudget.monthlyLimit,
          updatedBudget.userId
        );
      }
    }

    // Update lastGenerated
    await prisma.recurringTransaction.update({
      where: { id: recurringTransaction.id },
      data: { lastGenerated: nextDate },
    });

    nextDate = getNextOccurrence(nextDate, recurringTransaction.frequency);
  }

  return generatedTransactions;
}

function getNextOccurrence(lastDate, frequency) {
  const date = new Date(lastDate);
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }
  return date;
}

async function checkBudgetThreshold(budgetId, currentSpent, monthlyLimit, userId) {
  const percentageSpent = (currentSpent / monthlyLimit) * 100;
  let alertType = null;
  let message = null;

  if (percentageSpent >= 100) {
    alertType = 'danger';
    message = `🚨 Budget exceeded! You've spent ${percentageSpent.toFixed(0)}% of your budget.`;
  } else if (percentageSpent >= 90) {
    alertType = 'danger';
    message = `⚠️ Alert! You've spent ${percentageSpent.toFixed(0)}% of your budget.`;
  } else if (percentageSpent >= 75) {
    alertType = 'warning';
    message = `⚡ Warning! You've spent ${percentageSpent.toFixed(0)}% of your budget.`;
  }

  if (alertType && message) {
    const existingAlert = await prisma.alert.findFirst({
      where: { budgetId, isRead: false, alertType },
    });
    if (!existingAlert) {
      await prisma.alert.create({
        data: { userId, budgetId, message, alertType, isRead: false },
      });
    }
  }
}

module.exports = exports;
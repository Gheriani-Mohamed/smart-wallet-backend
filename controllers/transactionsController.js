const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== TRANSACTION CRUD ====================

// Create a new transaction
exports.createTransaction = async (req, res) => {
  try {
    const { userId, walletId, categoryId, amount, type, description, date } = req.body;

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        walletId,
        categoryId,
        amount,
        type,
        description,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        category: true,
        wallet: true,
      },
    });

    // Update wallet balance
    const balanceChange = type === 'income' ? amount : -amount;
    await prisma.wallet.update({
      where: { id: walletId },
      data: {
        balance: {
          increment: balanceChange,
        },
      },
    });

    // Update budget if expense
    if (type === 'expense') {
      const currentMonth = transaction.date.toISOString().slice(0, 7); // "2026-02"
      
      const budget = await prisma.budget.findFirst({
        where: {
          walletId,
          categoryId,
          month: currentMonth,
          isActive: true,
        },
      });

      if (budget) {
        await prisma.budget.update({
          where: { id: budget.id },
          data: {
            currentSpent: {
              increment: amount,
            },
          },
        });

        // Check threshold and create alerts
        await checkBudgetThreshold(budget.id, budget.currentSpent + amount, budget.monthlyLimit, budget.userId);
      }
    }

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all transactions for a user
exports.getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: {
        category: true,
        wallet: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: limit ? parseInt(limit) : undefined,
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all transactions for a wallet
exports.getWalletTransactions = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { limit } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: { walletId },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: limit ? parseInt(limit) : undefined,
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single transaction
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        category: true,
        wallet: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update transaction
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, amount, type, description, date } = req.body;

    // Get old transaction to reverse changes
    const oldTransaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!oldTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update transaction
    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        categoryId,
        amount,
        type,
        description,
        date: date ? new Date(date) : undefined,
      },
      include: {
        category: true,
        wallet: true,
      },
    });

    // Reverse old wallet balance change
    const oldBalanceChange = oldTransaction.type === 'income' ? -oldTransaction.amount : oldTransaction.amount;
    // Apply new wallet balance change
    const newBalanceChange = type === 'income' ? amount : -amount;
    const totalChange = oldBalanceChange + newBalanceChange;

    await prisma.wallet.update({
      where: { id: transaction.walletId },
      data: {
        balance: {
          increment: totalChange,
        },
      },
    });

    // Update budgets (reverse old, apply new)
    if (oldTransaction.type === 'expense') {
      const oldMonth = oldTransaction.date.toISOString().slice(0, 7);
      const oldBudget = await prisma.budget.findFirst({
        where: {
          walletId: oldTransaction.walletId,
          categoryId: oldTransaction.categoryId,
          month: oldMonth,
          isActive: true,
        },
      });

      if (oldBudget) {
        await prisma.budget.update({
          where: { id: oldBudget.id },
          data: {
            currentSpent: {
              decrement: oldTransaction.amount,
            },
          },
        });
      }
    }

    if (type === 'expense') {
      const newMonth = transaction.date.toISOString().slice(0, 7);
      const newBudget = await prisma.budget.findFirst({
        where: {
          walletId: transaction.walletId,
          categoryId: transaction.categoryId,
          month: newMonth,
          isActive: true,
        },
      });

      if (newBudget) {
        const updatedBudget = await prisma.budget.update({
          where: { id: newBudget.id },
          data: {
            currentSpent: {
              increment: amount,
            },
          },
        });

        await checkBudgetThreshold(updatedBudget.id, updatedBudget.currentSpent, updatedBudget.monthlyLimit, updatedBudget.userId);
      }
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete transaction
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Reverse wallet balance
    const balanceChange = transaction.type === 'income' ? -transaction.amount : transaction.amount;
    await prisma.wallet.update({
      where: { id: transaction.walletId },
      data: {
        balance: {
          increment: balanceChange,
        },
      },
    });

    // Reverse budget if expense
    if (transaction.type === 'expense') {
      const month = transaction.date.toISOString().slice(0, 7);
      const budget = await prisma.budget.findFirst({
        where: {
          walletId: transaction.walletId,
          categoryId: transaction.categoryId,
          month,
          isActive: true,
        },
      });

      if (budget) {
        await prisma.budget.update({
          where: { id: budget.id },
          data: {
            currentSpent: {
              decrement: transaction.amount,
            },
          },
        });
      }
    }

    // Delete transaction
    await prisma.transaction.delete({
      where: { id },
    });

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== QUERIES ====================

// Get transactions by category
exports.getTransactionsByCategory = async (req, res) => {
  try {
    const { walletId, categoryId } = req.params;

    const transactions = await prisma.transaction.findMany({
      where: {
        walletId,
        categoryId,
      },
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get transactions by type
exports.getTransactionsByType = async (req, res) => {
  try {
    const { walletId, type } = req.params;

    const transactions = await prisma.transaction.findMany({
      where: {
        walletId,
        type,
      },
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get transactions by date range
exports.getTransactionsByDateRange = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { startDate, endDate } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: {
        walletId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get transaction statistics for wallet
exports.getWalletStats = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { month } = req.query;

    let dateFilter = {};
    if (month) {
      const startDate = new Date(`${month}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      dateFilter = {
        date: {
          gte: startDate,
          lt: endDate,
        },
      };
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        walletId,
        ...dateFilter,
      },
    });

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const byCategory = transactions.reduce((acc, t) => {
      if (!acc[t.categoryId]) {
        acc[t.categoryId] = {
          income: 0,
          expense: 0,
          count: 0,
        };
      }
      
      if (t.type === 'income') {
        acc[t.categoryId].income += t.amount;
      } else {
        acc[t.categoryId].expense += t.amount;
      }
      
      acc[t.categoryId].count += 1;
      
      return acc;
    }, {});

    res.json({
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      transactionCount: transactions.length,
      byCategory,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== HELPER FUNCTIONS ====================

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
      where: {
        budgetId,
        isRead: false,
        alertType,
      },
    });

    if (!existingAlert) {
      await prisma.alert.create({
        data: {
          userId,
          budgetId,
          message,
          alertType,
          isRead: false,
        },
      });
    }
  }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create a new budget
exports.createBudget = async (req, res) => {
  try {
    const { userId, walletId, categoryId, monthlyLimit, month } = req.body;

    const budget = await prisma.budget.create({
      data: {
        userId,
        walletId,
        categoryId,
        monthlyLimit,
        month,
        currentSpent: 0,
        isActive: true,
      },
      include: {
        category: true, // Include category details in response
      },
    });

    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all budgets for a user
exports.getUserBudgets = async (req, res) => {
  try {
    const { userId } = req.params;

    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        wallet: true,
      },
    });

    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get budgets for a specific wallet
exports.getWalletBudgets = async (req, res) => {
  try {
    const { walletId } = req.params;

    const budgets = await prisma.budget.findMany({
      where: {
        walletId,
        isActive: true,
      },
    });

    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get budgets for a specific month
exports.getMonthlyBudgets = async (req, res) => {
  try {
    const { userId, month } = req.params;

    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        month,
        isActive: true,
      },
      include: {
        wallet: true,
      },
    });

    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single budget by ID
exports.getBudgetById = async (req, res) => {
  try {
    const { id } = req.params;

    const budget = await prisma.budget.findUnique({
      where: { id },
      include: {
        wallet: true,
        alerts: true,
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update budget
exports.updateBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { monthlyLimit, category, isActive } = req.body;

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        monthlyLimit,
        category,
        isActive,
        updatedAt: new Date(),
      },
    });

    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete budget (soft delete)
exports.deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Delete associated alerts
    await prisma.alert.deleteMany({
      where: { budgetId: id },
    });

    res.json({ message: 'Budget deleted successfully', budget });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update budget spent amount
exports.updateBudgetSpent = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        currentSpent: {
          increment: amount,
        },
        updatedAt: new Date(),
      },
    });

    // Check threshold after update
    await checkBudgetThreshold(budget);

    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reset budget spent
exports.resetBudget = async (req, res) => {
  try {
    const { id } = req.params;

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        currentSpent: 0,
        updatedAt: new Date(),
      },
    });

    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Check budget threshold and create alerts
exports.checkThreshold = async (req, res) => {
  try {
    const { id } = req.params;

    const budget = await prisma.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    await checkBudgetThreshold(budget);

    res.json({ message: 'Threshold check completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Sync budget with transactions
exports.syncWithTransactions = async (req, res) => {
  try {
    const { budgetId } = req.params;

    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Get all transactions for this wallet/category/month
    const transactions = await prisma.transaction.findMany({
      where: {
        walletId: budget.walletId,
        category: budget.category,
        type: 'expense',
      },
    });

    // Calculate total spent for this month
    let totalSpent = 0;
    transactions.forEach((transaction) => {
      const transactionMonth = `${transaction.date.getFullYear()}-${String(
        transaction.date.getMonth() + 1
      ).padStart(2, '0')}`;

      if (transactionMonth === budget.month) {
        totalSpent += transaction.amount;
      }
    });

    // Update budget
    const updatedBudget = await prisma.budget.update({
      where: { id: budgetId },
      data: {
        currentSpent: totalSpent,
        updatedAt: new Date(),
      },
    });

    // Check threshold
    await checkBudgetThreshold(updatedBudget);

    res.json(updatedBudget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Sync all budgets for a user
exports.syncAllBudgets = async (req, res) => {
  try {
    const { userId } = req.params;

    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    for (const budget of budgets) {
      // Get transactions for this budget
      const transactions = await prisma.transaction.findMany({
        where: {
          walletId: budget.walletId,
          category: budget.category,
          type: 'expense',
        },
      });

      // Calculate spent for this month
      let totalSpent = 0;
      transactions.forEach((transaction) => {
        const transactionMonth = `${transaction.date.getFullYear()}-${String(
          transaction.date.getMonth() + 1
        ).padStart(2, '0')}`;

        if (transactionMonth === budget.month) {
          totalSpent += transaction.amount;
        }
      });

      // Update budget
      await prisma.budget.update({
        where: { id: budget.id },
        data: {
          currentSpent: totalSpent,
          updatedAt: new Date(),
        },
      });

      // Check threshold
      await checkBudgetThreshold({ ...budget, currentSpent: totalSpent });
    }

    res.json({ message: 'All budgets synced successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper function to check budget threshold and create alerts
async function checkBudgetThreshold(budget) {
  const percentageSpent = (budget.currentSpent / budget.monthlyLimit) * 100;

  let alertType = null;
  let message = null;

  if (percentageSpent >= 100) {
    alertType = 'danger';
    message = `🚨 Budget exceeded! You've spent ${percentageSpent.toFixed(0)}% of your ${budget.category} budget.`;
  } else if (percentageSpent >= 90) {
    alertType = 'danger';
    message = `⚠️ Alert! You've spent ${percentageSpent.toFixed(0)}% of your ${budget.category} budget.`;
  } else if (percentageSpent >= 75) {
    alertType = 'warning';
    message = `⚡ Warning! You've spent ${percentageSpent.toFixed(0)}% of your ${budget.category} budget.`;
  }

  if (alertType && message) {
    // Check if alert already exists
    const existingAlert = await prisma.alert.findFirst({
      where: {
        budgetId: budget.id,
        isRead: false,
        alertType,
      },
    });

    // Only create if no unread alert exists
    if (!existingAlert) {
      await prisma.alert.create({
        data: {
          userId: budget.userId,
          budgetId: budget.id,
          message,
          alertType,
          isRead: false,
        },
      });
    }
  }
}
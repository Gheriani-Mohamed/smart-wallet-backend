const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== ANALYTICS ====================

// Get spending by category for a time period
exports.getSpendingByCategory = async (req, res) => {
  try {
    const { walletId, period, startDate, endDate } = req.query;

    if (!walletId || !period) {
      return res.status(400).json({ error: 'walletId and period are required' });
    }

    let start, end;
    const now = new Date();

    // Calculate date range based on period
    switch (period) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        start = new Date(now.setDate(now.getDate() - now.getDay()));
        end = new Date(now.setDate(now.getDate() - now.getDay() + 7));
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'startDate and endDate required for custom period' });
        }
        start = new Date(startDate);
        end = new Date(endDate);
        break;
      default:
        return res.status(400).json({ error: 'Invalid period' });
    }

    // Get transactions grouped by category
    const transactions = await prisma.transaction.findMany({
      where: {
        walletId,
        date: {
          gte: start,
          lt: end,
        },
      },
      include: {
        category: true,
      },
    });

    // Group by category and type
    const categoryData = {};
    
    transactions.forEach(tx => {
      const categoryName = tx.category?.name || 'Uncategorized';
      const type = tx.type;
      
      if (!categoryData[categoryName]) {
        categoryData[categoryName] = {
          name: categoryName,
          income: 0,
          expense: 0,
          total: 0,
          color: tx.category?.colorValue || '4288585374',
          icon: tx.category?.iconName || 'category',
        };
      }
      
      if (type === 'income') {
        categoryData[categoryName].income += tx.amount;
      } else {
        categoryData[categoryName].expense += tx.amount;
      }
      
      categoryData[categoryName].total = categoryData[categoryName].expense - categoryData[categoryName].income;
    });

    // Convert to array and sort by total
    const result = Object.values(categoryData).sort((a, b) => b.total - a.total);

    res.json({
      period,
      startDate: start,
      endDate: end,
      categories: result,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get income vs expense over time
exports.getIncomeVsExpense = async (req, res) => {
  try {
    const { walletId, period } = req.query;

    if (!walletId || !period) {
      return res.status(400).json({ error: 'walletId and period are required' });
    }

    const now = new Date();
    let start, end, groupBy;

    switch (period) {
      case 'week':
        start = new Date(now.setDate(now.getDate() - now.getDay() - 7 * 4)); // Last 4 weeks
        end = new Date();
        groupBy = 'day';
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        groupBy = 'day';
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        groupBy = 'month';
        break;
      default:
        return res.status(400).json({ error: 'Invalid period' });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        walletId,
        date: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Group by time period
    const timeData = {};
    
    transactions.forEach(tx => {
      let key;
      if (groupBy === 'day') {
        key = tx.date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else {
        key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      }
      
      if (!timeData[key]) {
        timeData[key] = { date: key, income: 0, expense: 0, net: 0 };
      }
      
      if (tx.type === 'income') {
        timeData[key].income += tx.amount;
      } else {
        timeData[key].expense += tx.amount;
      }
      
      timeData[key].net = timeData[key].income - timeData[key].expense;
    });

    const result = Object.values(timeData).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      period,
      startDate: start,
      endDate: end,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get summary statistics
exports.getSummary = async (req, res) => {
  try {
    const { walletId, period } = req.query;

    if (!walletId || !period) {
      return res.status(400).json({ error: 'walletId and period are required' });
    }

    const now = new Date();
    let start, end;

    switch (period) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        start = new Date(now.setDate(now.getDate() - now.getDay()));
        end = new Date(now.setDate(now.getDate() - now.getDay() + 7));
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        return res.status(400).json({ error: 'Invalid period' });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        walletId,
        date: {
          gte: start,
          lt: end,
        },
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let transactionCount = transactions.length;

    transactions.forEach(tx => {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }
    });

    const net = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100) : 0;

    res.json({
      period,
      startDate: start,
      endDate: end,
      totalIncome,
      totalExpense,
      net,
      transactionCount,
      savingsRate: Math.round(savingsRate * 100) / 100,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
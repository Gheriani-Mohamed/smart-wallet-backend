const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== ALERT CRUD ====================

// Create alert (usually called by budget system)
exports.createAlert = async (req, res) => {
  try {
    const { userId, budgetId, message, alertType } = req.body;

    const alert = await prisma.alert.create({
      data: {
        userId,
        budgetId,
        message,
        alertType,
        isRead: false,
      },
      include: {
        budget: {
          include: {
            category: true,
          },
        },
      },
    });

    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all alerts for a user
exports.getUserAlerts = async (req, res) => {
  try {
    const { userId } = req.params;

    const alerts = await prisma.alert.findMany({
      where: {
        userId,
      },
      include: {
        budget: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get unread alerts for a user
exports.getUnreadAlerts = async (req, res) => {
  try {
    const { userId } = req.params;

    const alerts = await prisma.alert.findMany({
      where: {
        userId,
        isRead: false,
      },
      include: {
        budget: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single alert
exports.getAlertById = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({
      where: { id },
      include: {
        budget: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark alert as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        isRead: true,
      },
    });

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark all alerts as read for a user
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await prisma.alert.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.json({
      message: 'All alerts marked as read',
      count: result.count,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete alert
exports.deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.alert.delete({
      where: { id },
    });

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete all alerts for a user
exports.deleteAllAlerts = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await prisma.alert.deleteMany({
      where: {
        userId,
      },
    });

    res.json({
      message: 'All alerts deleted',
      count: result.count,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const count = await prisma.alert.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
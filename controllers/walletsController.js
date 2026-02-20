const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== WALLET CRUD ====================

// Create a new wallet
exports.createWallet = async (req, res) => {
  try {
    const { userId, name, type, balance, currency } = req.body;

    // Create wallet
    const wallet = await prisma.wallet.create({
      data: {
        name,
        type: type || 'personal',
        balance: balance || 0,
        currency: currency || 'USD',
      },
    });

    // Automatically add creator as member
    await prisma.walletMember.create({
      data: {
        userId,
        walletId: wallet.id,
      },
    });

    // Return wallet with members
    const walletWithMembers = await prisma.wallet.findUnique({
      where: { id: wallet.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(walletWithMembers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all wallets for a user
exports.getUserWallets = async (req, res) => {
  try {
    const { userId } = req.params;

    const walletMembers = await prisma.walletMember.findMany({
      where: { userId },
      include: {
        wallet: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Extract wallets from members
    const wallets = walletMembers.map(wm => wm.wallet);

    res.json(wallets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single wallet by ID
exports.getWalletById = async (req, res) => {
  try {
    const { id } = req.params;

    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            transactions: true,
            budgets: true,
          },
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update wallet
exports.updateWallet = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, currency } = req.body;

    const wallet = await prisma.wallet.update({
      where: { id },
      data: {
        name,
        type,
        currency,
        updatedAt: new Date(),
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update wallet balance
exports.updateWalletBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const wallet = await prisma.wallet.update({
      where: { id },
      data: {
        balance: {
          increment: amount, // Positive for income, negative for expense
        },
        updatedAt: new Date(),
      },
    });

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete wallet
exports.deleteWallet = async (req, res) => {
  try {
    const { id } = req.params;

    // Prisma will cascade delete members, transactions, budgets
    await prisma.wallet.delete({
      where: { id },
    });

    res.json({ message: 'Wallet deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER MANAGEMENT ====================

// Add member to wallet
exports.addMember = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { userId, email } = req.body;

    let targetUserId = userId;

    // If email provided instead of userId, find user by email
    if (email && !userId) {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found with that email' });
      }

      targetUserId = user.id;
    }

    // Check if already a member
    const existingMember = await prisma.walletMember.findUnique({
      where: {
        userId_walletId: {
          userId: targetUserId,
          walletId,
        },
      },
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this wallet' });
    }

    // Add member
    const member = await prisma.walletMember.create({
      data: {
        userId: targetUserId,
        walletId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Remove member from wallet
exports.removeMember = async (req, res) => {
  try {
    const { walletId, userId } = req.params;

    // Check if this is the last member
    const memberCount = await prisma.walletMember.count({
      where: { walletId },
    });

    if (memberCount === 1) {
      return res.status(400).json({ 
        error: 'Cannot remove the last member. Delete the wallet instead.' 
      });
    }

    // Remove member
    await prisma.walletMember.delete({
      where: {
        userId_walletId: {
          userId,
          walletId,
        },
      },
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get wallet members
exports.getWalletMembers = async (req, res) => {
  try {
    const { walletId } = req.params;

    const members = await prisma.walletMember.findMany({
      where: { walletId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Check if user has access to wallet
exports.checkAccess = async (req, res) => {
  try {
    const { walletId, userId } = req.params;

    const member = await prisma.walletMember.findUnique({
      where: {
        userId_walletId: {
          userId,
          walletId,
        },
      },
    });

    res.json({ hasAccess: !!member });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== QUERIES ====================

// Get shared wallets (wallets with multiple members)
exports.getSharedWallets = async (req, res) => {
  try {
    const { userId } = req.params;

    const wallets = await prisma.wallet.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Filter only wallets with more than 1 member
    const sharedWallets = wallets.filter(w => w.members.length > 1);

    res.json(sharedWallets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get personal wallets (wallets with only one member)
exports.getPersonalWallets = async (req, res) => {
  try {
    const { userId } = req.params;

    const wallets = await prisma.wallet.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Filter only wallets with 1 member
    const personalWallets = wallets.filter(w => w.members.length === 1);

    res.json(personalWallets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
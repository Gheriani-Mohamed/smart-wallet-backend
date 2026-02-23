const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// POST /api/wallets/transfer
exports.transferMoney = async (req, res) => {
  const { fromWalletId, toWalletId, amount, description, userId: bodyUserId } = req.body;
  const userId = req.userId || req.user?.id || bodyUserId;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!fromWalletId || !toWalletId || !amount) {
    return res.status(400).json({ error: 'fromWalletId, toWalletId and amount are required' });
  }

  if (fromWalletId === toWalletId) {
    return res.status(400).json({ error: 'Cannot transfer to the same wallet' });
  }

  const transferAmount = parseFloat(amount);
  if (isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero' });
  }

  try {
    // ── Fetch both wallets ────────────────────────────────────────────────────
    const fromWallet = await prisma.wallet.findFirst({
      where: {
        id: fromWalletId,
        members: { some: { userId } }, // user must be a member
      },
    });

    if (!fromWallet) {
      return res.status(404).json({ error: 'Source wallet not found or access denied' });
    }

    const toWallet = await prisma.wallet.findFirst({
      where: {
        id: toWalletId,
        members: { some: { userId } }, // user must be a member of destination too
      },
    });

    if (!toWallet) {
      return res.status(404).json({ error: 'Destination wallet not found or access denied' });
    }

    // ── Check sufficient balance ──────────────────────────────────────────────
    if (fromWallet.balance < transferAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const transferNote = description?.trim() || `Transfer to ${toWallet.name}`;
    const receiveNote = description?.trim() || `Transfer from ${fromWallet.name}`;

    // ── Find or create a "Transfer" category ─────────────────────────────────
    // We reuse an existing Transfer category or pick the first generic one
    let transferCategory = await prisma.category.findFirst({
      where: {
        OR: [
          { name: { contains: 'Transfer', mode: 'insensitive' } },
          { name: { contains: 'Other', mode: 'insensitive' } },
        ],
      },
    });

    // Absolute fallback — just grab any category
    if (!transferCategory) {
      transferCategory = await prisma.category.findFirst();
    }

    if (!transferCategory) {
      return res.status(400).json({ error: 'No categories found. Please create one first.' });
    }

    // ── Run as a transaction (atomic) ─────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      // 1. Deduct from source wallet
      const updatedFromWallet = await tx.wallet.update({
        where: { id: fromWalletId },
        data: { balance: { decrement: transferAmount } },
      });

      // 2. Add to destination wallet
      const updatedToWallet = await tx.wallet.update({
        where: { id: toWalletId },
        data: { balance: { increment: transferAmount } },
      });

      // 3. Create expense transaction on source wallet
      const expenseTx = await tx.transaction.create({
        data: {
          userId,
          walletId: fromWalletId,
          categoryId: transferCategory.id,
          amount: transferAmount,
          type: 'expense',
          description: transferNote,
          date: new Date(),
        },
      });

      // 4. Create income transaction on destination wallet
      const incomeTx = await tx.transaction.create({
        data: {
          userId,
          walletId: toWalletId,
          categoryId: transferCategory.id,
          amount: transferAmount,
          type: 'income',
          description: receiveNote,
          date: new Date(),
        },
      });

      return { updatedFromWallet, updatedToWallet, expenseTx, incomeTx };
    });

    res.status(201).json({
      message: 'Transfer successful',
      fromWallet: {
        id: result.updatedFromWallet.id,
        name: result.updatedFromWallet.name,
        newBalance: result.updatedFromWallet.balance,
      },
      toWallet: {
        id: result.updatedToWallet.id,
        name: result.updatedToWallet.name,
        newBalance: result.updatedToWallet.balance,
      },
      amount: transferAmount,
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: error.message });
  }
};
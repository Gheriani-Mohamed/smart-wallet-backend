const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ── Email transporter (Gmail) ─────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password from Google (not your real password)
  },
});

async function sendResetCodeEmail(toEmail, userName, resetCode) {
  const mailOptions = {
    from: `"Smart Wallet" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your Password Reset Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
        
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #76A82F; margin: 0;">Smart Wallet</h1>
          <p style="color: #666; margin-top: 4px;">Password Reset Request</p>
        </div>

        <div style="background: #fff; padding: 24px; border-radius: 10px; border: 1px solid #e0e0e0;">
          <p style="margin-top: 0;">Hi <strong>${userName}</strong>,</p>
          <p>We received a request to reset your password. Use the code below:</p>

          <div style="text-align: center; margin: 28px 0;">
            <span style="
              display: inline-block;
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 10px;
              color: #76A82F;
              background: #f0f7e6;
              padding: 16px 28px;
              border-radius: 10px;
              border: 2px dashed #76A82F;
            ">${resetCode}</span>
          </div>

          <p style="color: #888; font-size: 13px; text-align: center;">
            ⏱ This code expires in <strong>15 minutes</strong>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #aaa; font-size: 12px; margin-bottom: 0;">
            If you didn't request this, you can safely ignore this email. Your password won't change.
          </p>
        </div>

      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// ==================== REGISTER ====================

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ message: 'Registration successful', token, user: userWithoutPassword });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== LOGIN ====================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password: _, ...userWithoutPassword } = user;
    res.json({ message: 'Login successful', token, user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET CURRENT USER ====================

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, createdAt: true, profileImage: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== UPDATE PROFILE ====================

exports.updateProfile = async (req, res) => {
  try {
    const { name, profileImage } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name,
        ...(profileImage !== undefined && { profileImage }),
      },
      select: { id: true, name: true, email: true, profileImage: true },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== CHANGE PASSWORD ====================

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== FORGOT PASSWORD ====================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return same message — don't reveal if user exists (security)
    if (!user) {
      return res.json({ message: 'If this email exists, a reset code has been sent.' });
    }

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { email },
      data: { resetCode, resetCodeExpiry: resetExpiry },
    });

    // Send real email
    try {
      await sendResetCodeEmail(email, user.name, resetCode);
      console.log(`Reset code sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send email:', emailError.message);
      return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }

    res.json({ message: 'If this email exists, a reset code has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== VERIFY RESET CODE ====================

exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.resetCode || !user.resetCodeExpiry) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    if (new Date() > user.resetCodeExpiry) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    if (user.resetCode !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    res.json({ message: 'Code verified successfully', email: user.email });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== RESET PASSWORD ====================

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.resetCode || !user.resetCodeExpiry) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    if (new Date() > user.resetCodeExpiry) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    if (user.resetCode !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetCode: null,
        resetCodeExpiry: null,
      },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
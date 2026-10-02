import { Request, Response } from 'express';
import pool from '../db/pool';
import { User } from '../models/user';
import jwt from 'jsonwebtoken';

export const getMyUser = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;

  try {
    const { rows } = await pool.query('SELECT * FROM "user" WHERE user_id = $1', [userId]);
    const user = rows[0];

    if (!user) {
      res.status(404).json({ error: 'User not found' }); return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("PG fetch error:", error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const getFilteredUsers = async (req: Request, res: Response) => {
  const { username } = req.body;
  const userId = (req.user as jwt.JwtPayload).sub;

  try {
    const { rows: users } = await pool.query(
      'SELECT username, name FROM "user" WHERE username ILIKE $1 AND user_id != $2', 
      [`%${username}%`, userId]
    );

    res.status(200).json(users);
  } catch (error) {
    console.error("PG filter error:", error);
    res.status(500).json({ error: 'Failed to fetch filtered users' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;
  const newUser: User = req.body;

  try {
    const updates = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(newUser)) {
      updates.push(`"${key}" = $${i}`);
      values.push(value);
      i++;
    }
    values.push(userId);

    const query = `UPDATE "user" SET ${updates.join(', ')} WHERE user_id = $${i} RETURNING *`;
    const { rows } = await pool.query(query, values);
    const user = rows[0];

    res.status(201).json(user);
  } catch (error) {
    console.error("PG update error:", error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;

  try {
    await pool.query('DELETE FROM "user" WHERE user_id = $1', [userId]);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Get user's available savings (total savings minus allocated amounts)
export const getUserSavings = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub;

  try {
    console.log("=== GET USER SAVINGS ===");
    console.log("User ID:", user_id);

    // Get user's basic info
    const { rows: userRows } = await pool.query('SELECT * FROM "user" WHERE user_id = $1', [user_id]);
    const user = userRows[0];

    if (!user) {
      res.status(404).json({ error: "User not found" }); return;
    }

    // Calculate total allocated amount by this user across all goals
    const { rows: allocations } = await pool.query(
      'SELECT allocated_amount FROM goal_participant WHERE user_id = $1',
      [user_id]
    );

    const totalAllocated = allocations?.reduce((sum: any, allocation: any) => 
      sum + Number(allocation.allocated_amount || 0), 0) || 0;

    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const { rows: transaction } = await pool.query(
      'SELECT amount, type, "dateTime" FROM transaction WHERE user_id = $1 AND "dateTime" < $2',
      [user_id, firstOfMonth]
    );

    const { rows: transaction2 } = await pool.query(
      'SELECT amount, type, "dateTime" FROM transaction WHERE user_id = $1 AND "dateTime" >= $2 AND "dateTime" < $3',
      [user_id, startOfLastMonth, firstOfMonth]
    );

    let totalIncome = 0;
    let totalExpenses = 0;

    transaction?.forEach(tx => {
      if (tx.type === 'income') {
        totalIncome += Number(tx.amount || 0);
      } else if (tx.type === 'expense') {
        totalExpenses += Number(tx.amount || 0);
      }
    });

    let totalIncomeLastMonth = 0;
    let totalExpensesLastMonth = 0;

    transaction2?.forEach(tx => {
      if (tx.type === 'income') {
        totalIncomeLastMonth += Number(tx.amount || 0);
      } else if (tx.type === 'expense') {
        totalExpensesLastMonth += Number(tx.amount || 0);
      }
    });

    const baseSavings = totalIncome - totalExpenses;
    const baseSavingsLastMonth = totalIncomeLastMonth - totalExpensesLastMonth;
    const availableSavings = Math.max(0, baseSavings - totalAllocated);
    const availableSavingsLastMonth = Math.min(baseSavingsLastMonth, availableSavings);

    res.status(200).json({
      availableSavings,
      availableSavingsLastMonth,
      totalAllocated,
      baseSavings
    });

  } catch (error) {
    console.error("Error calculating user savings:", error);
    res.status(500).json({ error: "Failed to calculate savings" });
  }
};

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';
import { Transaction, FilteredTransaction } from '../models/transaction';

export const getAllTransactions = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;
  try {
    const { rows: data } = await pool.query(
      'SELECT * FROM "transaction" WHERE user_id = $1 ORDER BY "dateTime" DESC',
      [userId]
    );
    
    // Map snake_case to camelCase
    res.status(200).json(
      data.map((tx: any) => ({
        transId: tx.trans_id || tx.transId,
        description: tx.description,
        type: tx.type,
        amount: tx.amount,
        dateTime: tx.dateTime,
        category: tx.category,
        userId: tx.user_id || tx.userId,
      }))
    );
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
    return;
  }
};

export const createTransaction = async (req: Request, res: Response) => {
  req.body.user_id = (req.user as jwt.JwtPayload).sub;
  const newTransaction: Transaction = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO "transaction" (description, type, amount, "dateTime", category, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [newTransaction.description, newTransaction.type, newTransaction.amount, newTransaction.dateTime, newTransaction.category, (newTransaction as any).user_id]
    );
    res.status(201).json({ message: "Transaction created", data: rows[0] });
    return;
  } catch (error) {
    console.error("Pg insert error:", error);
    res.status(500).json({ error: 'Failed to create transaction' });
    return;
  }
};

export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const {transId} = req.body;
    console.log("Received transactionId:", transId);
    
    const { rows, rowCount } = await pool.query(
      'DELETE FROM "transaction" WHERE trans_id = $1 RETURNING *',
      [transId]
    );
    
    if (rowCount === 0) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.status(200).json(rows);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete transaction' });
    return;
  }
};

export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const {transId, ...updateFields} = req.body as Transaction;
    
    // Construct dynamic update query
    const keys = Object.keys(updateFields);
    if (keys.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const setClause = keys.map((key, i) => {
      let colName = key;
      if (key === 'dateTime') colName = '"dateTime"';
      return `${colName} = $${i + 2}`;
    }).join(', ');
    const values = Object.values(updateFields);
    
    const { rows, rowCount } = await pool.query(
      `UPDATE "transaction" SET ${setClause} WHERE trans_id = $1 RETURNING *`,
      [transId, ...values]
    );
    
    if (rowCount === 0) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    
    res.status(200).json(rows);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to update transaction' });
    return;
  }
};

export const getFilterTransactions = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;
  let { description, type, amount, amountDirection, dateTime, dateDirection, category, numOfTrx }: FilteredTransaction = req.body;

  try {
    numOfTrx = numOfTrx || 5;
    
    let whereClauses: string[] = ['user_id = $1'];
    let values: any[] = [userId];
    let paramIndex = 2;

    if (description) {
      whereClauses.push(`description ILIKE $${paramIndex}`);
      values.push(`%${description}%`);
      paramIndex++;
    }
    if (type) {
      whereClauses.push(`type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }
    if (category) {
      if (Array.isArray(category) && category.length > 0) {
        const catParams = category.map((_, i) => `$${paramIndex + i}`).join(', ');
        whereClauses.push(`category IN (${catParams})`);
        values.push(...category);
        paramIndex += category.length;
      }
    }

    if (amount) {
      if (amountDirection === 'equal') {
        whereClauses.push(`amount = $${paramIndex}`);
        values.push(amount);
        paramIndex++;
      } else if (amountDirection === 'greater') {
        whereClauses.push(`amount > $${paramIndex}`);
        values.push(amount);
        paramIndex++;
      } else if (amountDirection === 'less') {
        whereClauses.push(`amount < $${paramIndex}`);
        values.push(amount);
        paramIndex++;
      }
    }

    if (dateTime) {
      if (dateDirection === 'on') {
        whereClauses.push(`"dateTime" >= $${paramIndex} AND "dateTime" < $${paramIndex + 1}`);
        values.push(new Date(dateTime), new Date(dateTime + 'T23:59:59'));
        paramIndex += 2;
      } else if (dateDirection === 'before') {
        whereClauses.push(`"dateTime" < $${paramIndex}`);
        values.push(new Date(dateTime));
        paramIndex++;
      } else if (dateDirection === 'after') {
        whereClauses.push(`"dateTime" > $${paramIndex}`);
        values.push(new Date(dateTime));
        paramIndex++;
      }
    }

    const whereStr = whereClauses.join(' AND ');
    const sql = `SELECT * FROM "transaction" WHERE ${whereStr} ORDER BY "dateTime" DESC LIMIT $${paramIndex}`;
    values.push(numOfTrx);

    const { rows: data } = await pool.query(sql, values);

    res.status(200).json(
      data.map((tx: any) => ({
        transId: tx.trans_id || tx.transId,
        description: tx.description,
        type: tx.type,
        amount: tx.amount,
        dateTime: tx.dateTime,
        category: tx.category,
        userId: tx.user_id || tx.userId,
      }))
    );
    return;
  } catch (error) {
    console.error("Pg fetch error:", error);
    res.status(500).json({ error: 'Failed to filter transactions' });
    return;
  }
}

export const getMonthlyTransactions = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;
  const type = req.query.type as string; // 'expense' or 'income'
  const currentYear = new Date().getFullYear();

  try {
    const { rows: data } = await pool.query(
      `SELECT "dateTime", amount FROM "transaction" 
       WHERE user_id = $1 AND type = $2 AND "dateTime" >= $3`,
      [userId, type, new Date(`${currentYear}-01-01T00:00:00`)]
    );

    // Process rows into a monthly sum
    let monthlySums: Record<string, number> = {};

    data.forEach((row: any) => {
      const month = new Date(row.dateTime).toLocaleString('en-GB', { month: 'short', year: 'numeric' }); // e.g., "Jan 2023"
      monthlySums[month] = (monthlySums[month] || 0) + Number(row.amount);
    });

    // Sort months
    const entries = Object.entries(monthlySums);
    const sortedEntries = entries.sort(([a], [b]) => {
      return new Date(a) > new Date(b) ? 1 : -1;
    });
    monthlySums = Object.fromEntries(sortedEntries);

    res.status(200).json(monthlySums);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monthly transactions' });
    return;
  }
}

export const getYearlyTransactions = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;
  const type = req.query.type as string; // 'expense' or 'income'

  try {
    const { rows: data } = await pool.query(
      `SELECT "dateTime", amount FROM "transaction" WHERE user_id = $1 AND type = $2`,
      [userId, type]
    );

    // Process rows into a yearly sum
    let yearlySum: Record<string, number> = {};

    data.forEach((row: any) => {
      const year = new Date(row.dateTime).toLocaleString('en-GB', { year: 'numeric' }); // e.g., "2023"
      yearlySum[year] = (yearlySum[year] || 0) + Number(row.amount);
    });

    // Sort years
    const entries = Object.entries(yearlySum);
    const sortedEntries = entries.sort(([a], [b]) => {
      return new Date(a) > new Date(b) ? 1 : -1;
    });
    yearlySum = Object.fromEntries(sortedEntries);

    res.status(200).json(yearlySum);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch yearly transactions' });
    return;
  }
}

export const getMonthTransactions = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;
  const type = req.query.type as string; // 'expense' or 'income'
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  try {
    const { rows: data } = await pool.query(
      `SELECT "dateTime", amount FROM "transaction" 
       WHERE user_id = $1 AND type = $2 AND "dateTime" >= $3`,
      [userId, type, new Date(`${currentYear}-${currentMonth}-01T00:00:00`)]
    );

    // Process rows into a yearly sum
    let monthSum: Record<string, number> = {};

    data.forEach((row: any) => {
      const day = new Date(row.dateTime).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); // e.g., "01 Jan 2023"
      monthSum[day] = (monthSum[day] || 0) + Number(row.amount);
    });

    // Sort years
    const entries = Object.entries(monthSum);
    const sortedEntries = entries.sort(([a], [b]) => { // taking out the key (month) from the entries
      return new Date(a) > new Date(b) ? 1 : -1;
    });
    monthSum = Object.fromEntries(sortedEntries);

    res.status(200).json(monthSum);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch month transactions' });
    return;
  }
}

export const getCurrentMonthCategoryExpenses = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // JS months are 0-based
  const start = `${year}-${month}-01T00:00:00`;
  // Get the first day of the next month
  const nextMonth = new Date(year, now.getMonth() + 1, 1);
  const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;

  try {
    const { rows: data } = await pool.query(
      `SELECT category, amount FROM "transaction" 
       WHERE user_id = $1 AND type = 'expense' AND "dateTime" >= $2 AND "dateTime" < $3`,
      [userId, new Date(start), new Date(end)]
    );

    // Group and sum by category (case-insensitive)
    const categorySums: Record<string, number> = {};
    data.forEach((row: any) => {
      if (!row.category || row.category.trim() === "") return;
      const key = row.category.trim().toLowerCase();
      categorySums[key] = (categorySums[key] || 0) + Number(row.amount);
    });

    // Return with original casing for the first occurrence
    const result: Record<string, number> = {};
    data.forEach((row: any) => {
      if (!row.category || row.category.trim() === "") return;
      const key = row.category.trim().toLowerCase();
      if (!(row.category.trim() in result)) {
        result[row.category.trim()] = categorySums[key];
      }
    });

    res.status(200).json(result);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch category expenses for current month' });
    return;
  }
};

export const getTodaysExpenses = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const start = `${year}-${month}-${day}T00:00:00`;
  const end = `${year}-${month}-${day}T23:59:59`;

  try {
    const { rows: data } = await pool.query(
      `SELECT amount FROM "transaction" 
       WHERE user_id = $1 AND type = 'expense' AND "dateTime" >= $2 AND "dateTime" <= $3`,
      [userId, new Date(start), new Date(end)]
    );

    const total = data.reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0);
    res.status(200).json({ total });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch today\'s expenses' });
    return;
  }
};
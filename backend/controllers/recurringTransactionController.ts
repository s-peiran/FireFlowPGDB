import { Request, Response } from 'express';
import pool from '../db/pool';
import jwt from 'jsonwebtoken';
import { RecurringTransaction } from '../models/recurringTransaction';

export const getAllRecurringTransactions = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub as string;
  try {
    const { rows: data } = await pool.query(
      'SELECT * FROM "recurring_transaction" WHERE user_id = $1',
      [userId]
    );
    
    res.status(200).json(data);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recurring transactions' });
    return;
  }
};

export const createRecurringTransaction = async (req: Request, res: Response) => {
  req.body.user_id = (req.user as jwt.JwtPayload).sub;
  const t: RecurringTransaction = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO "recurring_transaction" (description, type, amount, category, frequency, "repeatDay", "endDate", "isActive", user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [t.description, t.type, t.amount, t.category, t.frequency, (t as any).repeatDay, (t as any).endDate, (t as any).isActive, (t as any).user_id]
    );
    res.status(201).json({ message: "Recurring transaction created", data: rows[0] });
    return;
  } catch (error) {
    console.error("Pg insert error:", error);
    res.status(500).json({ error: 'Failed to create recurring transaction' });
    return;
  }
};

export const deleteRecurringTransaction = async (req: Request, res: Response) => {
    const { recTransId } = req.body;

    try {
        const { rowCount } = await pool.query(
          'DELETE FROM "recurring_transaction" WHERE rec_trans_id = $1 RETURNING *',
          [recTransId]
        );

        if (rowCount === 0) {
            res.status(404).json({ error: 'Recurring transaction not found' });
            return;
        }

        res.status(200).json({ message: "Recurring transaction deleted successfully" });
        return;
    } catch (error: any) {
        console.error("Pg delete error:", error);
        res.status(500).json({ error: 'Failed to delete recurring transaction' });
        return;
    }
};

export const updateRecurringTransaction = async (req: Request, res: Response) => {
  try {
    const { recTransId, ...updateFields } = req.body;
    
    const keys = Object.keys(updateFields);
    if (keys.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const setClause = keys.map((key, i) => {
      let colName = key;
      if (key === 'repeatDay') colName = '"repeatDay"';
      if (key === 'endDate') colName = '"endDate"';
      if (key === 'isActive') colName = '"isActive"';
      return `${colName} = $${i + 2}`;
    }).join(', ');
    const values = Object.values(updateFields);
    
    const { rows, rowCount } = await pool.query(
      `UPDATE "recurring_transaction" SET ${setClause} WHERE rec_trans_id = $1 RETURNING *`,
      [recTransId, ...values]
    );

    if (rowCount === 0) {
        res.status(404).json({ error: 'Recurring transaction not found' });
        return;
    }
    
    res.status(200).json({ message: "Recurring transaction updated", data: rows });
    return;
  } catch (error: any) {
    console.error("Pg update error:", error);
    res.status(500).json({ error: 'Failed to update recurring transaction' });
    return;
  }
};

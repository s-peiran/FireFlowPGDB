import { Request, Response } from 'express';
import pool from '../db/pool';
import jwt from 'jsonwebtoken';

function getTodayDate() {
  const now = new Date(); // create a new Date object with the current date and time
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()); 

  const yyyy = midnight.getFullYear();
  const mm = String(midnight.getMonth() + 1).padStart(2, '0'); 
  const dd = String(midnight.getDate()).padStart(2, '0');
  const hh = '00';
  const min = '00';
  const ss = '00';

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`; 
}

function getNextDate() {
  const now = new Date();
  let midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()); 
  midnight.setDate(midnight.getDate() + 1); // Move to the next day

  const yyyy = midnight.getFullYear();
  const mm = String(midnight.getMonth() + 1).padStart(2, '0'); 
  const dd = String(midnight.getDate()).padStart(2, '0');
  const hh = '00';
  const min = '00';
  const ss = '00';

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`; 
}

function getThisMonth() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const yyyy = firstDayOfMonth.getFullYear();
  const mm = String(firstDayOfMonth.getMonth() + 1).padStart(2, '0');
  const dd = String(firstDayOfMonth.getDate()).padStart(2, '0');
  const hh = '00';
  const min = '00';
  const ss = '00';

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function getNextMonth() {
  const now = new Date();
  let firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  firstDayOfMonth.setMonth(firstDayOfMonth.getMonth() + 1); // Move to the next month
  
  const yyyy = firstDayOfMonth.getFullYear();
  const mm = String(firstDayOfMonth.getMonth() + 1).padStart(2, '0');
  const dd = String(firstDayOfMonth.getDate()).padStart(2, '0');
  const hh = '00';
  const min = '00';
  const ss = '00';

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export const getDayExpense = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;

  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM "transaction" 
       WHERE user_id = $1 AND type = 'expense' AND "dateTime" >= $2 AND "dateTime" < $3`,
      [userId, new Date(getTodayDate()), new Date(getNextDate())]
    );

    res.status(200).json(Number(rows[0].total) || 0);
    return;
  } catch (error) {
    console.error('Error fetching daily expenses:', error);
    res.status(500).json({ error: 'Failed to fetch daily expenses' });
    return;
  }
}

export const getMonthExpense = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;

  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM "transaction" 
       WHERE user_id = $1 AND type = 'expense' AND "dateTime" >= $2 AND "dateTime" < $3`,
      [userId, new Date(getThisMonth()), new Date(getNextMonth())]
    );

    res.status(200).json(Number(rows[0].total) || 0);
    return;
  } catch (error) {
    console.error('Error fetching monthly expenses:', error);
    res.status(500).json({ error: 'Failed to fetch monthly expenses' });
    return;
  }
}

export const getMonthIncome = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;

  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM "transaction" 
       WHERE user_id = $1 AND type = 'income' AND "dateTime" >= $2 AND "dateTime" < $3`,
      [userId, new Date(getThisMonth()), new Date(getNextMonth())]
    );

    res.status(200).json(Number(rows[0].total) || 0);
    return;
  } catch (error) {
    console.error('Error fetching monthly income:', error);
    res.status(500).json({ error: 'Failed to fetch monthly income' });
    return;
  }
}

export const getFilteredMonthExpense = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub;
  const { category } = req.body;

  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM "transaction" 
       WHERE user_id = $1 AND type = 'expense' AND category = $2 AND "dateTime" >= $3 AND "dateTime" < $4`,
      [userId, category, new Date(getThisMonth()), new Date(getNextMonth())]
    );

    res.status(200).json(Number(rows[0].total) || 0);
    return;
  } catch (error) {
    console.error('Error fetching filtered monthly expenses:', error);
    res.status(500).json({ error: 'Failed to fetch filtered monthly expenses' });
    return;
  }
}
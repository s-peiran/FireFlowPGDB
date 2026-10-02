import { Request, Response } from 'express';
import pool from '../db/pool';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export const registerUser = async (req: Request, res: Response) => {
  const { email, password, username } = req.body;

  try {
    const { rows: existingUserRows } = await pool.query(
      'SELECT * FROM "user" WHERE email = $1 OR username = $2 LIMIT 1',
      [email, username]
    );

    if (existingUserRows.length > 0) {
      res.status(400).json({ error: 'Email or username already in use' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO "user" (email, username, password_hash) VALUES ($1, $2, $3)',
      [email, username, password_hash]
    );

    res.status(201).json({ message: 'User registered successfully' });
    return;
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Registration failed' });
    return;
  }
}

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "user" WHERE email = $1 LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const access_token = jwt.sign(
      { sub: user.user_id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ message: 'Login successful', token: access_token });
    return;
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Login failed' });
    return;
  }
}

export const logoutUser = async (req: Request, res: Response) => {
  try {
    res.status(200).json({ message: 'Logout successful' });
    return;
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Logout failed' });
    return;
  }
}
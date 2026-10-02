import { Request, Response } from 'express';
import pool from '../db/pool';
import { GoalParticipant } from '../models/goalParticipant'; 
import jwt from 'jsonwebtoken';

export const getGoalParticipants = async (req: Request, res: Response) => {
  try {
    const { rows: data } = await pool.query('SELECT * FROM goal_participant');

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching goal participants:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
};
 
// Controller to create a new goal
export const createGoalParticipant = async (req: Request, res: Response) => {
  console.log("Received request body:", req.body);
  req.body.user_id = (req.user as jwt.JwtPayload).sub;
  const newGoalParticipant = req.body;
  
  try {
    const keys = Object.keys(newGoalParticipant);
    const values = Object.values(newGoalParticipant);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    
    const { rows: data } = await pool.query(
      `INSERT INTO goal_participant (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.status(201).json({ message: "Goal created", data: data[0] });
  } catch (error: any) {
    console.error("PG insert error:", error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
};

export const updateGoalParticipant = async (req: Request, res: Response) => {
  try {
    const user_id = (req.user as jwt.JwtPayload).sub;
    const {goal_id, ...updateFields} = req.body;

    const updates = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updateFields)) {
      updates.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    values.push(goal_id);
    values.push(user_id);

    const { rowCount } = await pool.query(
      `UPDATE goal_participant SET ${updates.join(', ')} WHERE goal_id = $${i} AND user_id = $${i+1}`,
      values
    );
    
    if (rowCount === 0) {
      res.status(404).json({ error: 'goal not found' });
    }
    res.status(200).json({ message: "Goal participant updated" });
    return; 
  } catch (error) {
    console.error("PG update error:", error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
};

// Controller to delete a goal by ID for the authenticated user
export const deleteGoalParticipant = async (req: Request, res: Response) => {
  try {
    const user_id = (req.user as jwt.JwtPayload).sub;
    const { goal_id } = req.body;

    const { rowCount } = await pool.query(
      'DELETE FROM goal_participant WHERE goal_id = $1 AND user_id = $2',
      [goal_id, user_id]
    );
    
    if (rowCount === 0) {
      res.status(404).json({ error: 'Transaction not found' });
    }
    res.status(200).json({ message: "Goal participant deleted" });
  } catch (error: any) {
    console.error("PG delete error:", error);
    res.status(500).json({ error: 'Failed to delete goal participant' });
  }
};

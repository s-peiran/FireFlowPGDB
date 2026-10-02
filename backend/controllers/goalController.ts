import { Request, Response } from 'express';
import pool from '../db/pool';
import { Goal } from '../models/goal'; 
import jwt from 'jsonwebtoken';

export const getAllGoals = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub as string;

  try {
    const { rows: ownedGoals } = await pool.query(
      'SELECT * FROM goal WHERE user_id = $1 ORDER BY target_date ASC',
      [user_id]
    );

    const { rows: participantGoals } = await pool.query(`
      SELECT gp.role, g.* 
      FROM goal_participant gp
      JOIN goal g ON gp.goal_id = g.goal_id
      WHERE gp.user_id = $1
    `, [user_id]);

    const allGoals: any[] = [...(ownedGoals || [])];
    
    participantGoals?.forEach(participant => {
      const { role, ...goalData } = participant;
      allGoals.push({
        ...goalData,
        userRole: role
      });
    });

    const uniqueGoals = allGoals.filter((goal, index, self) => 
      index === self.findIndex(g => g.goal_id === goal.goal_id)
    );

    const goalIds = uniqueGoals.map(goal => goal.goal_id);
    
    if (goalIds.length === 0) {
      res.status(200).json([]);
      return;
    }

    const { rows: participantCounts } = await pool.query(
      'SELECT goal_id FROM goal_participant WHERE goal_id = ANY($1::int[])',
      [goalIds]
    );

    const participantCountMap: { [key: number]: number } = {};
    participantCounts?.forEach(participant => {
      participantCountMap[participant.goal_id] = (participantCountMap[participant.goal_id] || 0) + 1;
    });

    const { rows: allocations } = await pool.query(
      'SELECT goal_id, allocated_amount FROM goal_participant WHERE goal_id = ANY($1::int[])',
      [goalIds]
    );

    const currentAmountMap: { [key: number]: number } = {};
    allocations?.forEach(allocation => {
      const goalId = allocation.goal_id;
      const amount = allocation.allocated_amount || 0;
      currentAmountMap[goalId] = (currentAmountMap[goalId] || 0) + Number(amount);
    });

    const goalsWithExtendedInfo = uniqueGoals.map(goal => ({
      ...goal,
      current_amount: currentAmountMap[goal.goal_id] || 0,
      participantCount: participantCountMap[goal.goal_id] || 1,
      userRole: goal.userRole || 'owner'
    }));

    res.status(200).json(goalsWithExtendedInfo);
    return;
  } catch (error) {
    console.error("Failed to fetch goals:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
    return;
  }
};

export const getCurrentAmounts = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub as string;

  try {
    const { rows: ownedGoals } = await pool.query(
      'SELECT goal_id FROM goal WHERE user_id = $1',
      [user_id]
    );

    if (!ownedGoals || ownedGoals.length === 0) {
      res.status(200).json({});
      return;
    }

    const goalIds = ownedGoals.map(goal => goal.goal_id);

    const { rows: participants } = await pool.query(
      'SELECT goal_id, allocated_amount FROM goal_participant WHERE goal_id = ANY($1::int[])',
      [goalIds]
    );

    const currentAmounts: { [key: string]: number } = {};
    goalIds.forEach(goalId => {
      currentAmounts[goalId] = 0;
    });

    participants?.forEach(participant => {
      const goalId = participant.goal_id;
      currentAmounts[goalId] = (currentAmounts[goalId] || 0) + Number(participant.allocated_amount || 0);
    });

    res.status(200).json(currentAmounts);
    return;
  } catch (error) {
    console.error("Error fetching current amounts:", error);
    res.status(500).json({ error: "Failed to fetch current amounts" });
    return;
  }
};

export const createGoal = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub as string;
  const { selectedFriends = [], ...goalData } = req.body;
  goalData.user_id = user_id;

  try {
    const { rows } = await pool.query(
      'INSERT INTO goal (title, category, description, status, amount, target_date, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [goalData.title, goalData.category, goalData.description, goalData.status, goalData.amount, new Date(goalData.target_date), user_id]
    );
    const createdGoal = rows[0];

    await pool.query(
      'INSERT INTO goal_participant (goal_id, user_id, role, allocated_amount) VALUES ($1, $2, $3, $4)',
      [createdGoal.goal_id, user_id, 'owner', 0]
    );

    if (selectedFriends.length > 0) {
      for (const friendId of selectedFriends) {
        await pool.query(
          'INSERT INTO goal_participant (goal_id, user_id, role, allocated_amount) VALUES ($1, $2, $3, $4)',
          [createdGoal.goal_id, friendId, 'pending', 0]
        );
      }
    }

    res.status(201).json({ 
      message: "Goal created successfully", 
      data: createdGoal,
      participants: selectedFriends.length + 1
    });
    return;
  } catch (error: any) {
    console.error("PG insert error:", error);
    res.status(500).json({ error: 'Failed to create goal' });
    return;
  }
};

export const updateGoal = async (req: Request, res: Response) => {
  try {
    const { goal_id, ...updateFields } = req.body;
    
    if (updateFields.target_date) {
      updateFields.target_date = new Date(updateFields.target_date);
    }
    
    const updates = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updateFields)) {
      updates.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    values.push(parseInt(goal_id));

    const { rows } = await pool.query(
      `UPDATE goal SET ${updates.join(', ')} WHERE goal_id = $${i} RETURNING *`,
      values
    );
    
    res.status(200).json(rows[0]);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to update goal' });
    return;
  }
};

export const deleteGoal = async (req: Request, res: Response) => {
  try {
    const { goal_id } = req.body;
    await pool.query('DELETE FROM goal WHERE goal_id = $1', [parseInt(goal_id)]);
    res.status(200).json({ message: "Goal deleted successfully" });
    return;
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete goal' });
    return;
  }
};

export const getGoalsWithParticipants = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub as string;
  
  try {
    const { rows: dataRaw } = await pool.query(`
      SELECT gp.goal_id, gp.user_id, gp.role, gp.allocated_amount, 
             g.title as g_title, g.category as g_category, g.description as g_description,
             g.status as g_status, g.amount as g_amount, g.target_date as g_target_date, g.user_id as g_user_id
      FROM goal_participant gp
      JOIN goal g ON gp.goal_id = g.goal_id
      WHERE gp.user_id = $1
      ORDER BY g.target_date ASC
    `, [user_id]);

    const data = dataRaw.map(row => ({
      goal_id: row.goal_id,
      user_id: row.user_id,
      role: row.role,
      allocated_amount: row.allocated_amount,
      goal: {
        goal_id: row.goal_id,
        title: row.g_title,
        category: row.g_category,
        description: row.g_description,
        status: row.g_status,
        amount: row.g_amount,
        target_date: row.g_target_date,
        user_id: row.g_user_id
      }
    }));
      
    if (!data || data.length === 0) {
      res.status(200).json([]);
      return;
    }

    const goalIds = data.map(item => item.goal_id);
    
    const { rows: participantCounts } = await pool.query(
      'SELECT goal_id, user_id, role FROM goal_participant WHERE goal_id = ANY($1::int[])',
      [goalIds]
    );

    const participantCountMap = participantCounts.reduce((acc, participant) => {
      acc[participant.goal_id] = (acc[participant.goal_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const { rows: allAllocations } = await pool.query(
      'SELECT goal_id, allocated_amount FROM goal_participant WHERE goal_id = ANY($1::int[])',
      [goalIds]
    );

    const currentAmountMap: { [key: number]: number } = {};
    allAllocations.forEach(allocation => {
      const goalId = allocation.goal_id;
      const amount = allocation.allocated_amount || 0;
      currentAmountMap[goalId] = (currentAmountMap[goalId] || 0) + Number(amount);
    });

    const enhancedData = data.map(item => ({
      ...item,
      goal: {
        ...item.goal,
        participantCount: participantCountMap[item.goal_id] || 1,
        current_amount: currentAmountMap[item.goal_id] || 0
      }
    }));

    res.status(200).json(enhancedData);
    return;
  } catch (error) {
    console.error("Error fetching goals with participants:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
    return;
  }
};

export const getGoalParticipants = async (req: Request, res: Response) => {
  const { goalId } = req.params;
  const user_id = (req.user as jwt.JwtPayload).sub as string;
  
  try {
    const { rows: data } = await pool.query(`
      SELECT gp.goal_id, gp.user_id, gp.role, gp.allocated_amount, u.name as user_name
      FROM goal_participant gp
      LEFT JOIN "user" u ON gp.user_id = u.user_id
      WHERE gp.goal_id = $1
    `, [parseInt(goalId)]);

    if (!data || data.length === 0) {
      res.status(200).json([]);
      return;
    }

    const userParticipant = data.find(participant => participant.user_id === user_id);
    if (!userParticipant) {
      res.status(403).json({ error: "Access denied to this goal" });
      return;
    }

    const enrichedParticipants = data.map(participant => ({
      goal_id: participant.goal_id,
      user_id: participant.user_id,
      role: participant.role,
      allocated_amount: participant.allocated_amount,
      user: { name: participant.user_name || 'Unknown User' }
    }));

    res.status(200).json(enrichedParticipants);
    return;
  } catch (error) {
    console.error("Error fetching goal participants:", error);
    res.status(500).json({ error: "Failed to fetch goal participants" });
    return;
  }
};

export const allocateToGoals = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub as string;
  const { allocations } = req.body; 

  try {
    if (!allocations || typeof allocations !== 'object') {
      res.status(400).json({ error: "Invalid allocations data" });
      return;
    }

    const allocationEntries = Object.entries(allocations).filter(([_, amount]) => Number(amount) > 0);
    
    if (allocationEntries.length === 0) {
      res.status(400).json({ error: "No valid allocations provided" });
      return;
    }

    const completedGoals: number[] = [];

    for (const [goalId, amount] of allocationEntries) {
      const { rows: existingRows } = await pool.query(
        'SELECT allocated_amount FROM goal_participant WHERE goal_id = $1 AND user_id = $2',
        [parseInt(goalId), user_id]
      );
      const existingParticipant = existingRows[0];

      if (existingParticipant) {
        const oldAmount = existingParticipant.allocated_amount || 0;
        const newAmount = Number(oldAmount) + Number(amount);
        
        await pool.query(
          'UPDATE goal_participant SET allocated_amount = $1 WHERE goal_id = $2 AND user_id = $3',
          [newAmount, parseInt(goalId), user_id]
        );
      } else {
        const { rows: goalRows } = await pool.query(
          'SELECT user_id FROM goal WHERE goal_id = $1',
          [parseInt(goalId)]
        );
        const goalData = goalRows[0];

        if (!goalData) {
          throw new Error("Goal not found");
        }

        const role = goalData.user_id === user_id ? 'owner' : 'collaborator';

        await pool.query(
          'INSERT INTO goal_participant (goal_id, user_id, role, allocated_amount) VALUES ($1, $2, $3, $4)',
          [parseInt(goalId), user_id, role, Number(amount)]
        );
      }

      const { rows: gDataRows } = await pool.query(
        'SELECT amount, status FROM goal WHERE goal_id = $1',
        [parseInt(goalId)]
      );
      const goalData = gDataRows[0];
      
      if (!goalData) continue;

      const { rows: allParticipants } = await pool.query(
        'SELECT allocated_amount FROM goal_participant WHERE goal_id = $1',
        [parseInt(goalId)]
      );

      const totalAllocated = allParticipants.reduce((sum, participant) => 
        sum + Number(participant.allocated_amount || 0), 0) || 0;

      if (totalAllocated >= goalData.amount && goalData.status !== 'completed') {
        await pool.query(
          'UPDATE goal SET status = $1 WHERE goal_id = $2',
          ['completed', parseInt(goalId)]
        );
        completedGoals.push(parseInt(goalId));
      } else if (goalData.status === 'pending' && totalAllocated > 0) {
        await pool.query(
          'UPDATE goal SET status = $1 WHERE goal_id = $2',
          ['in-progress', parseInt(goalId)]
        );
      }
    }

    const updatedGoals = [];
    
    for (const goalId of Object.keys(allocations)) {
      try {
        const { rows: gRows } = await pool.query(
          'SELECT * FROM goal WHERE goal_id = $1',
          [parseInt(goalId)]
        );
        const goalData = gRows[0];

        if (goalData) {
          const { rows: pRows } = await pool.query(
            'SELECT allocated_amount FROM goal_participant WHERE goal_id = $1',
            [parseInt(goalId)]
          );

          const totalAllocated = pRows.reduce((sum, participant) => 
            sum + Number(participant.allocated_amount || 0), 0) || 0;
            
          updatedGoals.push({
            ...goalData,
            current_amount: totalAllocated
          });
        }
      } catch (error) {
        console.error(`Error fetching updated data for goal ${goalId}:`, error);
      }
    }

    res.status(200).json({ 
      message: "Allocations processed successfully",
      allocations: allocations,
      completedGoals: completedGoals,
      updatedGoals: updatedGoals
    });
    return;

  } catch (error) {
    console.error("Error processing allocations:", error);
    res.status(500).json({ error: "Failed to process allocations" });
    return;
  }
};

export const getPendingInvitations = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub as string;

  try {
    const { rows: rawData } = await pool.query(`
      SELECT gp.goal_id, gp.user_id, gp.role, gp.allocated_amount, 
             g.title as g_title, g.category as g_category, g.description as g_description,
             g.status as g_status, g.amount as g_amount, g.target_date as g_target_date, g.user_id as g_user_id,
             u.name as u_name
      FROM goal_participant gp
      JOIN goal g ON gp.goal_id = g.goal_id
      JOIN "user" u ON g.user_id = u.user_id
      WHERE gp.user_id = $1 AND gp.role = 'pending'
      ORDER BY g.target_date ASC
    `, [user_id]);

    const data = rawData.map(row => ({
      goal_id: row.goal_id,
      user_id: row.user_id,
      role: row.role,
      allocated_amount: row.allocated_amount,
      goal: {
        goal_id: row.goal_id,
        title: row.g_title,
        category: row.g_category,
        description: row.g_description,
        status: row.g_status,
        amount: row.g_amount,
        target_date: row.g_target_date,
        user_id: row.g_user_id,
        user: { name: row.u_name }
      }
    }));

    res.status(200).json(data || []);
    return;
  } catch (error) {
    console.error("Error fetching pending invitations:", error);
    res.status(500).json({ error: "Failed to fetch pending invitations" });
    return;
  }
};

export const acceptInvitation = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub as string;
  const { goalId } = req.params;

  try {
    const { rowCount } = await pool.query(
      'UPDATE goal_participant SET role = $1 WHERE goal_id = $2 AND user_id = $3 AND role = $4',
      ['collaborator', parseInt(goalId), user_id, 'pending']
    );

    if (rowCount === 0) {
      res.status(404).json({ error: "Invitation not found or already processed" });
      return;
    }

    const { rows: updatedParticipants } = await pool.query(
      'SELECT * FROM goal_participant WHERE goal_id = $1 AND user_id = $2',
      [parseInt(goalId), user_id]
    );

    res.status(200).json({ message: "Invitation accepted successfully", data: updatedParticipants[0] });
    return;
  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(500).json({ error: "Failed to accept invitation" });
    return;
  }
};

export const rejectInvitation = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub as string;
  const { goalId } = req.params;

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM goal_participant WHERE goal_id = $1 AND user_id = $2 AND role = $3',
      [parseInt(goalId), user_id, 'pending']
    );

    if (rowCount === 0) {
      res.status(404).json({ error: "Invitation not found or already processed" });
      return;
    }

    const { rows: remainingParticipants } = await pool.query(
      'SELECT user_id, role FROM goal_participant WHERE goal_id = $1',
      [parseInt(goalId)]
    );

    const participantCount = remainingParticipants.length;

    res.status(200).json({ 
      message: "Goal invitation rejected successfully", 
      deletedParticipant: { count: rowCount },
      remainingParticipants: participantCount
    });
    return;
  } catch (error) {
    console.error("Error rejecting invitation:", error);
    res.status(500).json({ error: "Failed to reject invitation" });
    return;
  }
};

export const debugDatabase = async (req: Request, res: Response) => {
  const user_id = (req.user as jwt.JwtPayload).sub as string;

  try {
    const { rows: goals } = await pool.query('SELECT * FROM goal WHERE user_id = $1', [user_id]);
    const { rows: participants } = await pool.query('SELECT * FROM goal_participant WHERE user_id = $1', [user_id]);

    const goalIds = goals.map(g => g.goal_id);
    let allParticipants: any[] = [];
    if (goalIds.length > 0) {
      const { rows } = await pool.query(
        'SELECT * FROM goal_participant WHERE goal_id = ANY($1::int[])',
        [goalIds]
      );
      allParticipants = rows;
    }

    res.status(200).json({
      user_id,
      goals: goals || [],
      userParticipations: participants || [],
      allParticipants: allParticipants || []
    });
    return;
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({ error: "Debug failed" });
    return;
  }
};

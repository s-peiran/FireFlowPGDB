import { Request, Response } from 'express';
import pool from '../db/pool';
import jwt from 'jsonwebtoken';

/**
 * 
 * @param req 
 * @param res 
 * @returns username + name of all friends
 */
export const getAllFriends = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub as string;
  
  try {
    const { rows: friend1 } = await pool.query(
      'SELECT "friendId", relationship FROM friend WHERE status = $1 AND "userId" = $2',
      ['accepted', userId]
    );
    
    const { rows: friend2 } = await pool.query(
      'SELECT "userId", relationship FROM friend WHERE status = $1 AND "friendId" = $2',
      ['accepted', userId]
    );

    const friend1Ids = friend1.map(row => row.friendId);
    const friend2Ids = friend2.map(row => row.userId);
    const allFriendIds = [...friend1Ids, ...friend2Ids];

    if (allFriendIds.length === 0) {
      res.status(200).json([]);
      return;
    }

    const { rows: users } = await pool.query(
      'SELECT user_id, username, name FROM "user" WHERE user_id = ANY($1::text[])',
      [allFriendIds]
    );

    const result = users.map(user => {
      const friend1Data = friend1.find(f => f.friendId === user.user_id);
      const friend2Data = friend2.find(f => f.userId === user.user_id);
      const relationship = friend1Data?.relationship || friend2Data?.relationship || 'friend';
      
      return {
        username: user.username,
        name: user.name,
        friend: [{
          status: 'accepted',
          relationship: relationship
        }]
      };
    });

    res.status(200).json(result);
    return;
  } catch (error) {
    console.error("PG error:", error);
    res.status(500).json({ error: 'Failed to fetch friends' });
    return;
  }
};

export const getAllFriendsRequests = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub as string;
  const toAccept = req.query.toAccept === 'true';
  
  try {
    if (toAccept) {
      const { rows: friendRequests } = await pool.query(
        'SELECT relationship, "userId" FROM friend WHERE "friendId" = $1 AND status = $2',
        [userId, 'pending']
      );

      if (friendRequests.length === 0) {
        res.status(200).json([]);
        return;
      }

      const senderIds = friendRequests.map(req => req.userId);
      const { rows: senders } = await pool.query(
        'SELECT user_id, username, name FROM "user" WHERE user_id = ANY($1::text[])',
        [senderIds]
      );

      const result = friendRequests.map(friendReq => {
        const sender = senders.find(sender => sender.user_id === friendReq.userId);
        return {
          relationship: friendReq.relationship,
          user: sender || null
        };
      }).filter(item => item.user !== null);

      res.status(200).json(result);
      return;
    } else {
      const { rows: friendRequests } = await pool.query(
        'SELECT relationship, "friendId" FROM friend WHERE "userId" = $1 AND status = $2',
        [userId, 'pending']
      );

      if (friendRequests.length === 0) {
        res.status(200).json([]);
        return;
      }

      const receiverIds = friendRequests.map(req => req.friendId);
      const { rows: receivers } = await pool.query(
        'SELECT user_id, username, name FROM "user" WHERE user_id = ANY($1::text[])',
        [receiverIds]
      );

      const result = friendRequests.map(friendReq => {
        const receiver = receivers.find(receiver => receiver.user_id === friendReq.friendId);
        return {
          relationship: friendReq.relationship,
          user: receiver || null
        };
      }).filter(item => item.user !== null);

      res.status(200).json(result);
      return;
    }

  } catch (error) {
    console.error("PG error in getAllFriendsRequests:", error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
    return;
  }
}

export const sendFriendRequest = async (req: Request, res: Response) => {
  const username = req.body.username;
  const currentUserId = (req.user as jwt.JwtPayload).sub as string;

  try {
    const { rows: users } = await pool.query(
      'SELECT user_id FROM "user" WHERE username = $1',
      [username]
    );
    const user = users[0];

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { rows: insertedData } = await pool.query(
      'INSERT INTO friend ("userId", "friendId", relationship, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [currentUserId, user.user_id, req.body.relationship || 'friend', 'pending']
    );

    res.status(201).json({ message: "Friend Request Sent", data: insertedData });
    return;
  } catch (error) {
    console.error("PG error in sendFriendRequest:", error);
    res.status(500).json({ error: 'Failed to send friend request' });
    return;
  }
};

export const acceptFriendRequest = async (req: Request, res: Response) => {
    const { username } = req.body;
    const userId = (req.user as jwt.JwtPayload).sub as string;

    try {
      const { rows: users } = await pool.query(
        'SELECT user_id FROM "user" WHERE username = $1',
        [username]
      );
      const sender = users[0];

      if (!sender) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const senderId = sender.user_id;

      const { rowCount } = await pool.query(
        'UPDATE friend SET status = $1 WHERE "userId" = $2 AND "friendId" = $3 AND status = $4',
        ['accepted', senderId, userId, 'pending']
      );

      if (rowCount === 0) {
        res.status(404).json({ error: 'Friend request not found' });
        return;
      }

      res.status(200).json({ message: "Friend request accepted", data: [{ status: 'accepted' }] });
      return;
    } catch (error) {
      console.error("PG update error:", error);
      res.status(500).json({ error: 'Failed to accept friend request' });
      return;
    }
}

export const rejectFriendRequest = async (req: Request, res: Response) => {
    deleteFriend(req, res);
}

export const cancelFriendRequest = async (req: Request, res: Response) => {
    const userId = (req.user as jwt.JwtPayload).sub as string;
    const { username } = req.body;

    try {
      const { rows: users } = await pool.query(
        'SELECT user_id FROM "user" WHERE username = $1',
        [username]
      );
      const friend = users[0];

      if (!friend) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const friendId = friend.user_id;

      const { rowCount } = await pool.query(
        'DELETE FROM friend WHERE "userId" = $1 AND "friendId" = $2 AND status = $3',
        [userId, friendId, 'pending']
      );

      if (rowCount === 0) {
        res.status(404).json({ error: 'Friend request not found' });
        return;
      }

      res.status(200).json({ message: "Friend request cancelled successfully" });
      return;
    } catch (error) {
      console.error("PG delete error:", error);
      res.status(500).json({ error: 'Failed to cancel friend request' });
      return;
    }
}

export const deleteFriend = async (req: Request, res: Response) => {
    const userId = (req.user as jwt.JwtPayload).sub as string;
    const { username } = req.body;

    try {
      const { rows: users } = await pool.query(
        'SELECT user_id FROM "user" WHERE username = $1',
        [username]
      );
      const friend = users[0];

      if (!friend) {
        res.status(404).json({ error: 'Friend not found' });
        return;
      }
      const friendId = friend.user_id;

      const { rowCount: count1 } = await pool.query(
        'DELETE FROM friend WHERE "userId" = $1 AND "friendId" = $2',
        [userId, friendId]
      );
        
      const { rowCount: count2 } = await pool.query(
        'DELETE FROM friend WHERE "userId" = $1 AND "friendId" = $2',
        [friendId, userId]
      );

      if (count1 === 0 && count2 === 0) {
        res.status(404).json({ error: 'Friend relationship not found' });
        return;
      }

      res.status(200).json({ message: "Friend deleted successfully" });
      return;
    } catch (error) {
      console.error("PG delete error:", error);
      res.status(500).json({ error: 'Failed to delete friend' });
      return;
    }
}

export const getFriendsForGoals = async (req: Request, res: Response) => {
  const userId = (req.user as jwt.JwtPayload).sub as string;
  
  try {
    const { rows: friend1 } = await pool.query(
      'SELECT "friendId" FROM friend WHERE status = $1 AND "userId" = $2',
      ['accepted', userId]
    );
    
    const { rows: friend2 } = await pool.query(
      'SELECT "userId" FROM friend WHERE status = $1 AND "friendId" = $2',
      ['accepted', userId]
    );

    const friend1Ids = friend1.map(row => row.friendId);
    const friend2Ids = friend2.map(row => row.userId);
    const allFriendIds = [...friend1Ids, ...friend2Ids];

    if (allFriendIds.length === 0) {
      res.status(200).json([]); 
      return;
    }

    const { rows: users } = await pool.query(
      'SELECT user_id, username, name FROM "user" WHERE user_id = ANY($1::text[])',
      [allFriendIds]
    );

    res.status(200).json(users);
    return;
  } catch (error: any) {
    console.error("Error in getFriendsForGoals:", error);
    res.status(500).json({ error: 'Failed to fetch friends' });
    return;
  }
};


export interface GoalParticipant {
    goal_id: number; // PostgreSQL goal foreign key ID
    user_id: string; // User ID of the participant
    role: 'owner' | 'collaborator' | 'pending'; // pending for invitation
    allocated_amount: number; // Amount of savings allocated by the participant towards the goal
  }
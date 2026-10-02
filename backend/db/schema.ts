import pool from './pool';

const schema = `
CREATE TABLE IF NOT EXISTS "user" (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  "monthlySavings" DOUBLE PRECISION DEFAULT 0,
  "monthlyResetDate" INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "transaction" (
  trans_id SERIAL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  "dateTime" TIMESTAMP NOT NULL,
  category VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goal (
  goal_id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  target_date TIMESTAMP NOT NULL,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goal_participant (
  goal_id INTEGER NOT NULL REFERENCES goal(goal_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  allocated_amount DOUBLE PRECISION DEFAULT 0,
  PRIMARY KEY (goal_id, user_id)
);

CREATE TABLE IF NOT EXISTS friend (
  "userId" UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  "friendId" UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  relationship VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  PRIMARY KEY ("userId", "friendId")
);

CREATE TABLE IF NOT EXISTS recurring_transaction (
  rec_trans_id SERIAL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  category VARCHAR(255) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  "repeatDay" VARCHAR(50) NOT NULL,
  "endDate" TIMESTAMP,
  "isActive" BOOLEAN DEFAULT true,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE
);
`;

export async function initSchema(): Promise<void> {
  try {
    await pool.query(schema);
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
}

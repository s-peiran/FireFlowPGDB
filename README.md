# 🔥 FireFlow - Personal Finance Management System

A comprehensive full-stack personal finance management application built with Next.js, Express, TypeScript, and PostgreSQL (fully compatible with CloudNativePG / CNPG and air-gapped environments). FireFlow helps users track expenses, set financial goals, manage recurring transactions, and collaborate on shared financial objectives.

![Status](https://img.shields.io/badge/Status-Active%20Development-green)
![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql&logoColor=white)
![CloudNativePG](https://img.shields.io/badge/CloudNativePG-Supported-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)

## 🚀 Features

### 💰 Transaction Management
- **Income & Expense Tracking**: Add, categorize, and monitor all financial transactions
- **Real-time Dashboard**: Visual overview of financial health with charts and metrics
- **Transaction Filtering**: Advanced filtering by date, category, and amount
- **Monthly Breakdown**: Detailed monthly financial summaries

### 🎯 Goal Setting & Tracking
- **Personal Goals**: Set individual financial targets with progress tracking
- **Collaborative Goals**: Share and work towards goals with friends and family
- **Goal Categories**: Organize goals by categories (Car, Home, Travel, Education, etc.)
- **Progress Visualization**: Real-time progress bars and percentage tracking
- **Deadline Management**: Track days remaining for each goal

### 🔄 Recurring Transactions
- **Automated Tracking**: Set up recurring income and expenses
- **Flexible Frequencies**: Daily, weekly, bi-weekly, monthly options
- **Smart Scheduling**: Automatic calculation of next occurrence dates
- **End Date Management**: Optional end dates for temporary recurring items

### 👥 Social Features
- **Friend System**: Add friends and manage friend requests
- **Goal Collaboration**: Invite friends to collaborate on shared financial goals
- **Role Management**: Owner/Collaborator/Pending role system
- **Invitation System**: Accept/reject goal collaboration invites
- **Participant Tracking**: View all participants and their contributions

### 📊 Financial Analytics
- **Savings Tracking**: Monitor available savings and monthly accumulation
- **Goal Allocation**: Allocate available savings to specific goals
- **Progress Analytics**: Track progress across all goals and categories
- **Financial Health**: Overview of income, expenses, and savings trends

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15.3.4 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Radix UI primitives
- **Icons**: Lucide React
- **State Management**: React Hooks (`useState`, `useEffect`)

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Authentication**: JWT authentication with `bcrypt` password hashing
- **Database Driver**: Native `pg` (node-postgres) connection pool
- **Architecture**: Self-contained schema initialization (`CREATE TABLE IF NOT EXISTS`), pure JavaScript driver with zero external binary dependencies (fully air-gap compatible)

### Database & Infrastructure
- **Database Engine**: PostgreSQL 17 (`cloudnative-pg/postgresql:17.10`)
- **Containerization**: Multi-stage Docker builds for frontend and backend
- **Local Orchestration**: Docker Compose
- **Kubernetes Operator**: CloudNativePG (CNPG) Cluster CRD

### Database Schema
- **`user`**: User accounts, credentials (`password_hash`), monthly savings targets
- **`transaction`**: Financial transaction records (income/expense, timestamps, categories)
- **`goal`**: Personal and collaborative goal targets, deadlines, and statuses
- **`goal_participant`**: Multi-user goal collaboration roles and savings allocations
- **`friend`**: Friend relationships and pending friend requests
- **`recurring_transaction`**: Automated recurring income and expense templates

## 📁 Project Structure

```
FireFlow/
├── frontend/                 # Next.js frontend application
│   ├── app/                  # App router pages and layouts
│   │   ├── _components/      # Reusable React components
│   │   │   ├── forms/        # Form components (login, transaction, goals)
│   │   │   ├── ui/           # UI primitives (buttons, cards, dialogs)
│   │   │   ├── charts/       # Data visualization charts
│   │   │   └── layout/       # Navigation and layout components
│   │   ├── cashflows/        # Transaction management pages
│   │   ├── goals/            # Goal tracking pages
│   │   ├── friends/          # Social features pages
│   │   ├── recurring/        # Recurring transaction pages
│   │   ├── profile/          # User profile pages
│   │   └── allocate/         # Savings allocation pages
│   ├── Dockerfile            # Multi-stage production container build
│   └── middleware.ts         # JWT session verification middleware
├── backend/                  # Express.js backend API
│   ├── controllers/          # API route handlers (PostgreSQL queries)
│   ├── db/                   # Database pool and schema initialization
│   │   ├── pool.ts           # pg.Pool configuration
│   │   └── schema.ts         # SQL DDL auto-migration script
│   ├── routes/               # Express route definitions
│   ├── models/               # TypeScript data models and interfaces
│   ├── jwt.ts                # JWT verification middleware
│   ├── server.ts             # Server entrypoint
│   └── Dockerfile            # Multi-stage production container build
├── k8s/                      # Kubernetes deployment manifests
│   ├── namespace.yaml        # 'fireflow' namespace
│   ├── cnpg-cluster.yaml     # CloudNativePG PostgreSQL Cluster CRD
│   ├── backend.yaml          # Backend Deployment & Service
│   └── frontend.yaml         # Frontend Deployment & Service
├── docker-compose.yml        # Local development multi-container stack
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- Node.js 18+ (optional, only for running locally outside Docker)
- PostgreSQL 17 (optional, only for running locally outside Docker)

---

### Option 1: Quickstart with Docker Compose (Recommended)

The easiest way to run the entire stack (PostgreSQL 17, Express backend, Next.js frontend) locally:

1. **Clone the repository and start containers**:
   ```bash
   docker compose up --build -d
   ```

2. **Access the services**:
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:5100](http://localhost:5100)
   - **PostgreSQL**: `localhost:5432` (`user: fireflow`, `db: fireflow`)

3. **Log in or register**:
   - Create a new account at [http://localhost:3000/sign-up](http://localhost:3000/sign-up)
   - Or log in with your credentials at [http://localhost:3000/login](http://localhost:3000/login)

4. **Stop the containers**:
   ```bash
   docker compose down
   ```

---

### Option 2: Manual Local Development

If you prefer running services directly on your host machine:

1. **Start a PostgreSQL 17 instance**:
   Ensure PostgreSQL is running and create a database named `fireflow`.

2. **Configure backend environment variables**:
   Create `backend/.env`:
   ```env
   DATABASE_URL=postgresql://fireflow:fireflow_password@localhost:5432/fireflow
   JWT_SECRET=your_jwt_secret_key_here
   PORT=5100
   CORS_ORIGIN=http://localhost:3000
   ```

3. **Start the backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *The database schema tables will be automatically created on startup via `initSchema()`.*

4. **Configure frontend environment variables**:
   Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5100
   ```

5. **Start the frontend**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☸️ Kubernetes & CloudNativePG (CNPG) Deployment

FireFlow is designed to run in air-gapped Kubernetes environments using the CloudNativePG operator:

1. **Ensure CloudNativePG operator is installed** in your Kubernetes cluster.

2. **Apply the manifests**:
   ```bash
   # Create namespace
   kubectl apply -f k8s/namespace.yaml

   # Deploy the CloudNativePG PostgreSQL 17 cluster
   kubectl apply -f k8s/cnpg-cluster.yaml

   # Deploy the backend API (binds to the CNPG-generated secret fireflow-db-app)
   kubectl apply -f k8s/backend.yaml

   # Deploy the Next.js frontend
   kubectl apply -f k8s/frontend.yaml
   ```

3. **Verify cluster and pod status**:
   ```bash
   kubectl get cluster -n fireflow
   kubectl get pods -n fireflow
   ```

### 🔒 Air-Gapped Compatibility Notes
- **Zero Binary Downloads**: The backend uses the pure JavaScript `pg` (node-postgres) driver. It has no build-time or runtime binary fetch steps (unlike ORMs that require external binary downloads).
- **Self-Bootstrapping Schema**: Schema definitions and constraints are executed through plain SQL `CREATE TABLE IF NOT EXISTS` upon server launch.
- **Native CNPG Secrets**: The Kubernetes deployment directly consumes the standard connection URI secret generated by the CloudNativePG operator (`<cluster-name>-app`).

## 🔧 API Endpoints

### Authentication
- `POST /login` - User authentication (returns JWT token)
- `POST /login/register` - Create a new user account
- `POST /login/logout` - User logout

### Users
- `GET /api/users` - Get current authenticated user profile
- `POST /api/users/filter` - Search users by username
- `PUT /api/users/update` - Update user profile information
- `DELETE /api/users/delete` - Delete user account
- `GET /api/users/savings` - Calculate user's available savings

### Transactions
- `GET /api/transactions` - Get user transactions
- `POST /api/transactions/create` - Create new transaction
- `POST /api/transactions/delete` - Delete transaction
- `GET /api/transactions/todays-expenses` - Get daily expense total
- `GET /api/transactions/category-expenses-monthly` - Get monthly category breakdown
- `GET /api/transactions/monthly-transactions` - Get monthly transactions
- `GET /api/transactions/yearly-transactions` - Get yearly transactions

### Dashboard
- `GET /api/dashboard/day-expense` - Get daily expense aggregation
- `GET /api/dashboard/month-expense` - Get monthly expense aggregation
- `GET /api/dashboard/month-income` - Get monthly income aggregation
- `POST /api/dashboard/filter-month-expense` - Get filtered monthly expense

### Goals
- `GET /api/goals` - Get user goals
- `POST /api/goals/create` - Create a new goal
- `GET /api/goals/with-participants` - Get goals with associated participant data
- `POST /api/goals/:id/invite` - Invite a friend to collaborate on a goal
- `POST /api/goals/:id/accept-invitation` - Accept a goal collaboration invite
- `POST /api/goals/:id/reject-invitation` - Reject a goal collaboration invite
- `GET /api/goals/pending-invitations` - View pending goal invites

### Friends
- `GET /api/friends` - List confirmed friends
- `GET /api/friends/requests` - List incoming/outgoing friend requests
- `POST /api/friends/send` - Send friend request
- `POST /api/friends/accept` - Accept friend request
- `POST /api/friends/reject` - Reject friend request
- `POST /api/friends/cancel` - Cancel sent friend request
- `POST /api/friends/delete` - Remove a friend

### Recurring Transactions
- `GET /api/recurring-transactions` - Get recurring transactions
- `POST /api/recurring-transactions/create` - Create recurring transaction template
- `POST /api/recurring-transactions/update` - Update recurring transaction
- `POST /api/recurring-transactions/delete` - Remove recurring transaction

---

## 🛡️ Security Features
- **JWT Authentication**: Signed tokens verified via Express middleware on all `/api/*` endpoints.
- **Password Hashing**: Strong password hashing using `bcrypt`.
- **Parameterized SQL Queries**: All database interactions use parameter placeholders (`$1, $2, ...`) via `pg.Pool` to prevent SQL injection.
- **Configurable CORS**: Protected Cross-Origin Resource Sharing settings for API routes.
- **Internal Service Isolation**: Frontend and backend container communication separated cleanly from public ingress.

---

**Built with ❤️ for resilient and self-hosted personal finance tracking.**

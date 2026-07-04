# BErozgar — Campus Resource Exchange Platform

BErozgar is a professional campus-centric, governance-first resource exchange platform designed for students and administrators at Rajiv Gandhi Institute of Technology (RGIT). It simplifies student life by offering secure, structured directories and marketplaces.

Production URL: [https://rgitrozgar.in/](https://rgitrozgar.in/)

---

## 🚀 Key Modules

1. **Accommodation Directory**: View and list student hostels, flat-shares, and PG options near the campus.
2. **Resale Marketplace**: Buy and sell student essentials (books, laboratory coats, calculators, electronics) securely.
3. **Academic Resources**: Find or request course notes, study groups, syllabus guides, and reference books.
4. **Mess & Hospital Directory**: Admin-curated, interactive directory of nearby canteens/tiffin providers and campus-affiliated clinics/hospitals.

---

## 🔒 Permission & Roles Architecture

BErozgar uses a strict role-based access control (RBAC) model to maintain a trusted campus ecosystem:

* **Public User (Outsider)**: Authenticated but unverified accounts. Enforces a **read-only browse state** across all modules. Blocked from listing creation, making requests, or managing disputes. Sees a MCTRGIT college email verification banner.
* **Verified Student**: Verified via a valid `@mctrgit.ac.in` college email. Full write access to list items, submit transactions/requests, and communicate with other buyers/sellers.
* **Administrator**: Enforces platform governance: approves or rejects pending listings, monitors dispute lifecycles, and curates the Mess & Hospital directories.

---

## 🛠️ Technology Stack

* **Frontend**: React, Vite, TailwindCSS, shadcn/ui, react-router-dom, react-helmet-async (SEO).
* **Backend**: Fastify (Node.js REST API), Prisma Client.
* **Database**: PostgreSQL.
* **Infrastructure**: Docker, Nginx (hardened with HSTS, CSP, clickjacking prevention), GitHub Actions (CI/CD).

---

## 💻 Local Setup Instructions

### Prerequisites
* Node.js >= 20.x
* PostgreSQL (running locally or remotely)
* npm

### Step 1: Clone the Repository
```bash
git clone https://github.com/Kartik24Hulmukh/unified-experience.git
cd unified-experience
```

### Step 2: Install Dependencies
Install dependencies at the root (frontend) and backend:
```bash
# Install frontend packages
npm install

# Install backend packages
cd server
npm install
cd ..
```

### Step 3: Configure Environment Variables
Create a `.env` file in the `server` directory (use `server/.env.example` as a template):
```env
PORT=3001
HOST=localhost
DATABASE_URL="postgresql://user:password@localhost:5432/berozgar?schema=public"
JWT_SECRET="YOUR_MINIMUM_32_CHAR_JWT_SECRET_KEY"
COOKIE_DOMAIN="localhost"
CORS_ORIGIN="http://localhost:5173"
ADMIN_EMAILS="admin@rgitrozgar.in"
```

### Step 4: Run Database Migrations & Seeds
Initialize your database schema and populate active lookup directories:
```bash
cd server
npx prisma generate
npx prisma migrate dev
npm run db:seed
cd ..
```

### Step 5: Start Development Servers
Run both frontend and backend in development mode:
```bash
# Terminal 1: Run Frontend
npm run dev

# Terminal 2: Run Backend
cd server
npm run dev
```
Open `http://localhost:8080` to view the application.

---

## 🧪 Testing

The codebase includes an extensive suite of 148 automated unit and contract tests:

```bash
# Run Frontend tests
npm test

# Run Server tests
cd server
npm test
```

---

## ⚖️ Legal and Policy Documents

Platform governance policies are located under `docs/legal/`:
* Terms of Use: [TERMS_OF_USE.md](file:///c:/Users/praja/OneDrive/Desktop/Berozgar/unified-experience/docs/legal/TERMS_OF_USE.md)
* Privacy Policy: [PRIVACY_POLICY.md](file:///c:/Users/praja/OneDrive/Desktop/Berozgar/unified-experience/docs/legal/PRIVACY_POLICY.md)
* Disclaimer: [DISCLAIMER.md](file:///c:/Users/praja/OneDrive/Desktop/Berozgar/unified-experience/docs/legal/DISCLAIMER.md)
* Data Retention Policy: [DATA_RETENTION_POLICY.md](file:///c:/Users/praja/OneDrive/Desktop/Berozgar/unified-experience/docs/legal/DATA_RETENTION_POLICY.md)

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](file:///c:/Users/praja/OneDrive/Desktop/Berozgar/unified-experience/LICENSE) file for details.

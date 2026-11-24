# Zuri Healthcare

A hospital appointment management app with Patient, Doctor, and Admin accounts.

## Features

- Patients can register, browse doctors, request appointments, and track appointment status.
- Doctors can view their appointments and approve or decline requests.
- Admins can manage patients, doctors, and appointments.
- Passwords are hashed, and protected routes require authentication.
- A doctor cannot have two active appointments at the same time slot.

## Technology

- Frontend: React, Vite, React Router, and CSS
- Backend: Node.js and Express
- Database: MySQL or MariaDB through XAMPP
- Authentication: JSON Web Tokens and bcrypt

## Project structure

```text
zuri-healthcare/
├── client/
│   └── src/
│       ├── AdminDashboard.jsx
│       ├── App.jsx
│       ├── AuthContext.jsx
│       ├── AuthPages.jsx
│       ├── DoctorDashboard.jsx
│       ├── PatientDashboard.jsx
│       ├── ProtectedRoute.jsx
│       ├── api.js
│       ├── index.css
│       └── main.jsx
├── server/
│   ├── admin-appointments.js
│   ├── admin-doctors.js
│   ├── admin-patients.js
│   ├── admin.js
│   ├── app.js
│   ├── appointments.js
│   ├── auth.js
│   ├── db.js
│   ├── doctor-appointments.js
│   ├── doctors.js
│   ├── schema.sql
│   ├── seed-admin.js
│   └── server.js
├── .gitignore
└── README.md

Requirements
- Windows
- Node.js and npm
- XAMPP with MySQL or MariaDB
- Visual Studio Code

First-time setup
1. Start MySQL
Open the XAMPP Control Panel and start MySQL.
2. Create the database tables
Open the XAMPP Shell and run:
mysql -u root -p
Enter your MySQL root password. If your root account has no password, press Enter.

At the MariaDB prompt, run:
source C:/Users/Admin/zuri-healthcare/server/schema.sql
This creates the database and tables. Run it once for a fresh setup.
3. Create the server environment file
In VS Code, create server/.env and add:
PORT=5000
CLIENT_URL=http://localhost:5173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=zuri_healthcare
JWT_SECRET=PASTE_YOUR_GENERATED_SECRET_HERE
If your MySQL root account has a password, put it after DB_PASSWORD=.

Generate a JWT secret in PowerShell:
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
Copy the generated value into JWT_SECRET= in server/.env. Keep .env private and do not paste its real values into this README.
4. Install the server packages
Open a PowerShell terminal and run:
cd C:\Users\Admin\zuri-healthcare\server
npm.cmd install
5. Install the client packages
In PowerShell, run:
cd C:\Users\Admin\zuri-healthcare\client
npm.cmd install
6. Create the Admin account
In PowerShell, run:
cd C:\Users\Admin\zuri-healthcare\server
$secureAdminPassword = Read-Host "Choose an Admin password (at least 12 characters)" -AsSecureString
$env:ZURI_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $secureAdminPassword).Password
node seed-admin.js
Remove-Item Env:ZURI_ADMIN_PASSWORD
Remove-Variable secureAdminPassword
Follow the prompts to enter the Admin name and email. Choose a password of at least 12 characters and keep it private.
Start the app
Start the backend
Open a PowerShell terminal:
cd C:\Users\Admin\zuri-healthcare\server
npm.cmd run dev
Leave this terminal running.
Start the frontend
Open a second PowerShell terminal:
cd C:\Users\Admin\zuri-healthcare\client
npm.cmd run dev
Leave this terminal running too.

Open the website at:
http://localhost:5173
The backend health page is:
http://localhost:5000/api/health
Main API routes
Route	Access
GET /api/health	Public
POST /api/auth/register	Public patient registration
POST /api/auth/login	Public
GET /api/doctors	Public
POST /api/appointments	Patient
GET /api/appointments/my	Patient
GET /api/doctor/appointments	Doctor
PATCH /api/doctor/appointments/:id/status	Assigned doctor
GET /api/admin/patients	Admin
POST /api/admin/patients	Admin
PUT /api/admin/patients/:id	Admin
DELETE /api/admin/patients/:id	Admin
GET /api/admin/doctors	Admin
POST /api/admin/doctors	Admin
PUT /api/admin/doctors/:id	Admin
DELETE /api/admin/doctors/:id	Admin
GET /api/admin/appointments	Admin
PATCH /api/admin/appointments/:id/status	Admin


Protected routes require a signed-in user. The login token expires after one hour.
Typical workflow
1. Register a patient account.
2. Sign in as Admin and create a doctor account.
3. Sign in as Patient and request an appointment.
4. Sign in as that Doctor and approve or decline the request.
5. Sign in as Patient again to view the updated appointment status.


      
19:56
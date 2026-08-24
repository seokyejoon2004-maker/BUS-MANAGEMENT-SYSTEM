const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "serikali_bus_system_secret_key_2026";

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 1. ANZA DATABASE YA SQLITE
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error("Database connection error:", err.message);
    else console.log("Database ya SQLite imeunganishwa kikamilifu.");
});

// 2. TENGENEZA TABLES ZA DATABASE NA AKAUNTI ZA AWALI
db.serialize(() => {
    // Table ya Watumiaji (Users)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        region TEXT
    )`);

    // Table ya Mabasi (Buses)
    db.run(`CREATE TABLE IF NOT EXISTS buses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT UNIQUE NOT NULL,
        company_name TEXT NOT NULL,
        route TEXT NOT NULL,
        seats INTEGER NOT NULL,
        driver_id INTEGER,
        status TEXT DEFAULT 'Pending Clearance'
    )`);

    // Weka Msimamizi Mkuu (Super Admin) wa awali kama hayupo
    const adminEmail = "admin@usafiri.go.tz";
    db.get(`SELECT * FROM users WHERE email = ?`, [adminEmail], (err, row) => {
        if (!row) {
            const hashedPassword = bcrypt.hashSync("AdminPass2026!", 10);
            db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`, 
                ["Msimamizi Mkuu Kitaifa", adminEmail, hashedPassword, "SUPER_ADMIN"]);
            console.log("Akaunti ya Mkuu wa Mfumo imetengenezwa: admin@usafiri.go.tz / AdminPass2026!");
        }
    });
});

// 3. API YA LOGIN (JWT AUTHENTICATION)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: "Barua pepe au Nenosiri si sahihi!" });
        
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) return res.status(400).json({ error: "Barua pepe au Nenosiri si sahihi!" });

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name, region: user.region }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ message: "Login Successful", token, user: { id: user.id, name: user.name, email: user.email, role: user.role, region: user.region } });
    });
});

// 4. API YA KUSAJILI WATUMIAJI WAPYA (Super Admin & Owners)
app.post('/api/users', (req, res) => {
    const { name, email, password, role, region } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(`INSERT INTO users (name, email, password, role, region) VALUES (?, ?, ?, ?, ?)`,
        [name, email, hashedPassword, role, region || null],
        function(err) {
            if (err) return res.status(400).json({ error: "Email tayari imeshasajiliwa!" });
            res.json({ message: "Mtumiaji amesajiliwa kikamilifu", userId: this.lastID });
        }
    );
});

// 5. API YA KULETA MABASI YOTE (READ)
app.get('/api/buses', (req, res) => {
    db.all(`SELECT * FROM buses`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 6. API YA KUSAJILI BASI JIPYA (CREATE)
app.post('/api/buses', (req, res) => {
    const { plate_number, company_name, route, seats } = req.body;
    db.run(`INSERT INTO buses (plate_number, company_name, route, seats) VALUES (?, ?, ?, ?)`,
        [plate_number, company_name, route, seats],
        function(err) {
            if (err) return res.status(400).json({ error: "Basi lenye namba hii tayari lipo!" });
            res.json({ message: "Basi limesajiliwa kikamilifu kwenye Database", busId: this.lastID });
        }
    );
});

// 7. API YA KUREKEBISHA HALI YA SAFARI / KIBALI (UPDATE)
app.put('/api/buses/:id/status', (req, res) => {
    const { status } = req.body;
    const busId = req.params.id;

    db.run(`UPDATE buses SET status = ? WHERE id = ?`, [status, busId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Taarifa zimesasishwa (Updated) kwenye Database!" });
    });
});

app.listen(PORT,'0.0.0.0', () => {
    console.log(`Server inaendeshwa kwenye bandari (Port): ${PORT}`);
});

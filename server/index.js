const express = require("express");
const path = require("path");
const { WebSocketServer } = require("ws");
const db = require("./db");
const cors = require("cors");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const multer = require("multer");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'public', 'photos')); 
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + Date.now() + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 } 
});

app.use(express.static(path.join(__dirname, "..", "public")));

function getVotingData(callback) {
    const q1 = "SELECT id, no_urut, name, npm, visi, misi, photo, votes FROM options ORDER BY no_urut ASC";
    
    db.query(q1, (err, options) => {
        if (err) return callback(err);

        const result = options.map(opt => ({
            id: opt.id,
            no_urut: opt.no_urut,
            name: opt.name,
            npm: opt.npm,
            visi: opt.visi,
            misi: opt.misi,
            photo: opt.photo,
            votes: opt.votes,
        }));

        callback(null, result);
    });
}

app.post("/register", async (req, res) => {
    const { username, password, npm } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: true, message: "Username dan Password wajib diisi!" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const q = "INSERT INTO voters (username, password, npm) VALUES (?, ?, ?)";
        db.query(q, [username, hashedPassword, npm], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: true, message: "Username atau NPM sudah terdaftar." });
                }
                throw err;
            }
            res.json({ success: true, message: "Pendaftaran berhasil." });
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: true, message: "Gagal memproses pendaftaran." });
    }
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: true, message: "Username dan Password wajib!" });
    }

    const q = "SELECT id, username, password, is_voted FROM voters WHERE username = ?";
    db.query(q, [username], async (err, rows) => {
        if (err) return res.status(500).json({ error: true, message: "Kesalahan server." });

        if (rows.length === 0) {
            return res.status(401).json({ error: true, message: "Username atau Password salah." });
        }

        const voter = rows[0];
        const match = await bcrypt.compare(password, voter.password);

        if (!match) {
            return res.status(401).json({ error: true, message: "Username atau Password salah." });
        }

        if (voter.is_voted) {
            return res.json({ success: true, message: "Login berhasil, namun Anda sudah memilih.", voter_id: voter.id, is_voted: true });
        }

        res.json({ success: true, message: "Login berhasil, siap memilih!", voter_id: voter.id, is_voted: false });
    });
});

app.get("/options", (req, res) => {
    getVotingData((err, result) => {
        if (err) return res.status(500).json({ error: true, message: "Gagal mengambil data options." });
        res.json(result);
    });
});

app.post("/vote/:optionId", (req, res) => {
    const optionId = req.params.optionId;
    const { voter_id } = req.body;

    if (!voter_id || !optionId) {
        return res.status(400).json({ error: true, message: "Data pemilih (voter_id) atau calon (optionId) tidak lengkap!" });
    }

    db.query("SELECT is_voted FROM voters WHERE id = ?", [voter_id], (err, rows) => {
        if (err) return res.status(500).json({ error: true, message: "Kesalahan server saat cek vote." });

        if (rows.length === 0) {
            return res.status(404).json({ error: true, message: "Voter tidak ditemukan." });
        }
        
        if (rows[0].is_voted) {
            return res.json({ error: true, message: "Anda sudah memilih!" });
        }

        db.beginTransaction(err => {
            if (err) throw err;

            const qInsertVote = "INSERT INTO votes (voter_id, option_id, voted_at) VALUES (?, ?, NOW())";
            db.query(qInsertVote, [voter_id, optionId], (err, result) => {
                if (err) {
                    db.rollback(() => { throw err; });
                }

                const qUpdateOption = "UPDATE options SET votes = votes + 1 WHERE id = ?";
                db.query(qUpdateOption, [optionId], (err) => {
                    if (err) {
                        db.rollback(() => { throw err; });
                    }

                    const qUpdateVoter = "UPDATE voters SET is_voted = TRUE WHERE id = ?";
                    db.query(qUpdateVoter, [voter_id], (err) => {
                        if (err) {
                            db.rollback(() => { throw err; });
                        }

                        db.commit(err => {
                            if (err) {
                                db.rollback(() => { throw err; });
                            }
                            
                            broadcastUpdate();
                            res.json({ success: true, message: "Voting berhasil!" });
                        });
                    });
                });
            });
        });
    });
});

app.post("/admin/options", upload.single('photo'), (req, res) => {
    const { no_urut, name, npm, visi, misi } = req.body;
    const photoFileName = req.file ? `photos/${req.file.filename}` : null;

    if (!no_urut || !name || !visi || !misi) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: true, message: "Nomor Urut, Nama, Visi, dan Misi wajib diisi!" });
    }

    const q = `
        INSERT INTO options (no_urut, name, npm, visi, misi, photo)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.query(q, [no_urut, name, npm, visi, misi, photoFileName], (err, result) => {
        if (err) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: true, message: "Nomor Urut atau NPM sudah ada." });
            }
            console.error(err);
            return res.status(500).json({ error: true, message: "Gagal menyimpan data calon." });
        }

        broadcastUpdate();
        res.json({ success: true, message: "Data calon berhasil ditambahkan.", id: result.insertId });
    });
});

const wss = new WebSocketServer({ port: 8081 });

function broadcastUpdate() {
    getVotingData((err, formattedOptions) => {
        if (err) {
            console.error("Error saat fetching data untuk broadcast:", err);
            return;
        }

        const data = JSON.stringify({
            type: "update",
            options: formattedOptions
        });

        wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(data);
            }
        });
    });
}

console.log("WebSocket ready ws://0.0.0.0:8081");
app.listen(8080, () => {
    console.log("Server running on port 8080");
});
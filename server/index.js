const express = require("express");
const path = require("path");
const { WebSocketServer } = require("ws");
const db = require("./db");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// tampilkan file dalam folder public
app.use(express.static(path.join(__dirname, "..", "public")));

// ================================
// GET OPTIONS + VOTER LIST
// ================================
app.get("/options", (req, res) => {
    const q1 = "SELECT * FROM options";
    const q2 = "SELECT username, option_id FROM voters";

    db.query(q1, (err, options) => {
        if (err) throw err;

        db.query(q2, (err, voters) => {
            if (err) throw err;

            const result = options.map(opt => ({
                id: opt.id,
                name: opt.name,
                votes: opt.votes,
                voters: voters
                    .filter(v => v.option_id === opt.id)
                    .map(v => v.username)
            }));

            res.json(result);
        });
    });
});

// ================================
// VOTE
// ================================
app.post("/vote/:id", (req, res) => {
    const id = req.params.id;
    const username = req.body.username;

    if (!username) {
        return res.json({ error: true, message: "Username wajib!" });
    }

    // cek apakah sudah vote
    db.query("SELECT * FROM voters WHERE username = ?", [username], (err, rows) => {
        if (err) throw err;

        if (rows.length > 0) {
            return res.json({ error: true, message: "User sudah voting!" });
        }

        // simpan voting
        db.query("INSERT INTO voters (username, option_id) VALUES (?, ?)",
            [username, id],
            (err) => {
                if (err) throw err;

                db.query("UPDATE options SET votes = votes + 1 WHERE id = ?",
                    [id],
                    (err) => {
                        if (err) throw err;

                        broadcastUpdate(); // push ke semua client
                        res.json({ success: true });
                    }
                );
            }
        );
    });
});

// ================================
// WEBSOCKET SERVER
// ================================
const wss = new WebSocketServer({ port: 8081 });

function broadcastUpdate() {
    const q1 = "SELECT * FROM options";
    const q2 = "SELECT username, option_id FROM voters";

    db.query(q1, (err, options) => {
        if (err) return;

        db.query(q2, (err, voters) => {
            if (err) return;

            const formatted = options.map(opt => ({
                id: opt.id,
                name: opt.name,
                votes: opt.votes,
                voters: voters
                    .filter(v => v.option_id === opt.id)
                    .map(v => v.username)
            }));

            const data = JSON.stringify({
                type: "update",
                options: formatted
            });

            wss.clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(data);
                }
            });
        });
    });
}

console.log("WebSocket ready ws://0.0.0.0:8081");
// app.listen(8080, "localhost", () => {
//     console.log("Server running at http://localhost:8080");
// });

app.listen(8080, () => {
    console.log("Server running on port 8080");
});

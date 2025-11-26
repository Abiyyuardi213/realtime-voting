const optionContainer = document.getElementById("options");
const resultList = document.getElementById("results");

// ambil IP otomatis
const SERVER_IP = window.location.hostname;

// WebSocket auto-detect IP server
const ws = new WebSocket(`ws://${SERVER_IP}:8081`);

// Ambil data awal
fetch(`http://${SERVER_IP}:8080/options`)
    .then(res => res.json())
    .then(data => {
        renderOptions(data);
        renderResults(data);
    })
    .catch(() => alert("Gagal konek ke server API!"));

// Real-time update
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "update") {
        renderOptions(data.options);
        renderResults(data.options);
    }
};

// Tampilkan tombol voting
function renderOptions(options) {
    optionContainer.innerHTML = "";

    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.innerHTML = opt.name;
        btn.style.margin = "5px";
        btn.style.padding = "10px";
        btn.onclick = () => vote(opt.id);

        optionContainer.appendChild(btn);
    });
}

// Kirim vote
function vote(id) {
    const username = localStorage.getItem("username");

    fetch(`http://${SERVER_IP}:8080/vote/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
    })
    .then(res => res.json())
    .then(result => {
        if (result.error) alert(result.message);
    });
}

// Tampilkan hasil
function renderResults(options) {
    resultList.innerHTML = "";

    options.forEach(opt => {
        const li = document.createElement("li");
        li.innerHTML = `
            <b>${opt.name}</b>: ${opt.votes} suara <br>
            <small>Voters: ${opt.voters.length ? opt.voters.join(", ") : "Belum ada"}</small>
            <hr>
        `;
        resultList.appendChild(li);
    });
}

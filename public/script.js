const optionContainer = document.getElementById("options");
const resultList = document.getElementById("results");
const votedMessage = document.getElementById("voted-message");

const SERVER_IP = window.location.hostname;
const VOTER_ID = localStorage.getItem("voter_id");
let IS_VOTED = localStorage.getItem("is_voted") === 'true';

if (IS_VOTED) {
    votedMessage.classList.remove('hidden');
}

const ws = new WebSocket(`ws://${SERVER_IP}:8081`);

fetch(`${SERVER_URL}/options`)
    .then(res => res.json())
    .then(data => {
        renderOptions(data);
        renderResults(data);
    })
    .catch((e) => {
        console.error("Gagal konek ke server API:", e);
        alert("Gagal konek ke server API! Pastikan server (Node.js) berjalan.");
    });

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "update") {
        renderOptions(data.options);
        renderResults(data.options);
    }
};

function renderOptions(options) {
    optionContainer.innerHTML = "";

    options.forEach(opt => {
        const card = document.createElement("div");
        card.className = "bg-white rounded-lg shadow-xl p-6 flex flex-col items-center";
        
        const photoUrl = opt.photo ? `${SERVER_URL}/${opt.photo}` : 'https://via.placeholder.com/150?text=No+Photo';
        card.innerHTML += `<img src="${photoUrl}" alt="Foto ${opt.name}" class="w-32 h-32 object-cover rounded-full mb-4 border-4 border-indigo-400">`;

        card.innerHTML += `<p class="text-4xl font-black text-indigo-700 mb-2">${opt.no_urut}</p>`;
        card.innerHTML += `<h3 class="text-xl font-bold text-gray-900 text-center mb-2">${opt.name}</h3>`;
        card.innerHTML += `<p class="text-sm text-gray-500 mb-4">NPM: ${opt.npm || '-'}</p>`;
        
        card.innerHTML += `<div class="w-full text-left space-y-2 mb-4">
            <h4 class="font-semibold text-indigo-500">Visi:</h4>
            <p class="text-sm text-gray-600 italic">${opt.visi}</p>
            <h4 class="font-semibold text-indigo-500">Misi:</h4>
            <p class="text-sm text-gray-600">${opt.misi.replace(/\n/g, '<br>')}</p>
        </div>`;

        const btn = document.createElement("button");
        btn.innerHTML = IS_VOTED ? "SUDAH MEMILIH" : "PILIH INI";
        btn.className = IS_VOTED 
            ? "mt-auto w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed transition"
            : "mt-auto w-full bg-green-500 text-white font-bold py-2 rounded-lg hover:bg-green-700 transition";
            
        btn.disabled = IS_VOTED;
        btn.onclick = () => {
            if (confirm(`Apakah Anda yakin memilih ${opt.name} (No. Urut ${opt.no_urut})? Pilihan tidak bisa diubah.`)) {
                vote(opt.id);
            }
        };

        card.appendChild(btn);
        optionContainer.appendChild(card);
    });
}

function renderResults(options) {
    resultList.innerHTML = "";
    
    options.sort((a, b) => b.votes - a.votes);

    options.forEach((opt, index) => {
        const li = document.createElement("li");
        
        let rankColor = 'text-gray-700';
        if (index === 0) rankColor = 'text-yellow-600 font-extrabold';
        else if (index === 1) rankColor = 'text-gray-500 font-bold';
        else if (index === 2) rankColor = 'text-yellow-800';

        li.className = "bg-white p-4 rounded-lg shadow flex justify-between items-center";
        li.innerHTML = `
            <div class="flex items-center space-x-4">
                <span class="text-xl ${rankColor} w-10 text-center">#${index + 1}</span>
                <div>
                    <p class="text-lg font-semibold text-indigo-700">${opt.no_urut}. ${opt.name}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-3xl font-black ${rankColor}">${opt.votes}</p>
                <p class="text-sm text-gray-500">Total Suara</p>
            </div>
        `;
        resultList.appendChild(li);
    });
}

async function vote(optionId) {
    if (IS_VOTED) {
        alert("Anda sudah memilih dan tidak bisa memilih lagi!");
        return;
    }
    
    try {
        const response = await fetch(`${SERVER_URL}/vote/${optionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voter_id: VOTER_ID })
        });
        
        const result = await response.json();

        if (result.error) {
            alert(result.message);
            
            if (result.message.includes("sudah memilih")) {
                 localStorage.setItem("is_voted", "true");
                 IS_VOTED = true;
                 renderOptions(options);
            }

        } else if (result.success) {
            alert("Suara Anda berhasil dicatat!");
            
            localStorage.setItem("is_voted", "true");
            IS_VOTED = true;
            
            votedMessage.classList.remove('hidden');
        }
        
    } catch (e) {
        alert("Terjadi kesalahan saat mengirim suara ke server.");
        console.error(e);
    }
}
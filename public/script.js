const optionContainer = document.getElementById("options");
const resultList = document.getElementById("results");
const votedMessage = document.getElementById("voted-message");
const ctx = document.getElementById('voteChart').getContext('2d');

const SERVER_IP = window.location.hostname;
const VOTER_ID = localStorage.getItem("voter_id");
let IS_VOTED = localStorage.getItem("is_voted") === 'true';

if (IS_VOTED) {
    votedMessage.classList.remove('hidden');
}

const ws = new WebSocket(`ws://${SERVER_IP}:8081`);

let voteChart; 

fetch(`${SERVER_URL}/options`)
    .then(res => res.json())
    .then(data => {
        renderOptions(data);
        renderResults(data);
    })
    .catch((e) => {
        console.error("Gagal konek ke server API:", e);
        Swal.fire({
            icon: "error",
            title: "Gagal Terhubung",
            text: "Pastikan server API berjalan.",
            confirmButtonColor: "#e91e63"
        });
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
        card.className = "card p-6 flex flex-col items-center";

        const photoUrl = opt.photo ? `${SERVER_URL}/${opt.photo}` : 'https://via.placeholder.com/150?text=No+Photo';
        card.innerHTML += `<img src="${photoUrl}" alt="Foto ${opt.name}" class="w-32 h-32 object-cover rounded-full mb-4 border-4 border-pink-400">`;

        card.innerHTML += `<p class="text-4xl font-black text-pink-700 mb-2">${opt.no_urut}</p>`;
        card.innerHTML += `<h3 class="text-xl font-bold text-gray-900 text-center mb-2">${opt.name}</h3>`;
        card.innerHTML += `<p class="text-sm text-gray-500 mb-4">NPM: ${opt.npm || '-'}</p>`;
        
        const btn = document.createElement("button");
        btn.innerHTML = IS_VOTED ? "SUDAH MEMILIH" : "PILIH INI";
        btn.className = IS_VOTED 
            ? "mt-auto w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed transition"
            : "mt-auto w-full vote-btn text-white font-bold py-2 rounded-lg transition";
            
        btn.disabled = IS_VOTED;

        btn.onclick = () => {
            Swal.fire({
                title: 'Konfirmasi Pilihan',
                html: `
                    <p class="text-lg font-semibold text-pink-600">
                        ${opt.name} (No. Urut ${opt.no_urut})
                    </p>
                    <p class="text-gray-700 mt-2">Anda yakin ingin memilih kandidat ini?</p>
                    <p class="text-red-500 text-sm mt-1 italic">*Pilihan tidak dapat diubah setelah ini.</p>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Pilih!',
                cancelButtonText: 'Batal',
                focusConfirm: false,
                confirmButtonColor: '#e91e63',
                cancelButtonColor: '#6b7280',
                customClass: {
                    popup: 'rounded-xl',
                    confirmButton: 'rounded-lg px-4 py-2 font-bold',
                    cancelButton: 'rounded-lg px-4 py-2'
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    vote(opt.id);

                    Swal.fire({
                        title: 'Berhasil!',
                        text: 'Suara Anda sedang diproses...',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
            });
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
        if (index === 0) rankColor = 'text-pink-700 font-extrabold'; 
        else if (index === 1) rankColor = 'text-gray-500 font-bold';
        else if (index === 2) rankColor = 'text-pink-800';

        li.className = "result-card p-4 rounded-lg flex justify-between items-center";
        li.innerHTML = `
            <div class="flex items-center space-x-4">
                <span class="text-xl ${rankColor} w-10 text-center">#${index + 1}</span>
                <div>
                    <p class="text-lg font-semibold text-pink-700">${opt.no_urut}. ${opt.name}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-3xl font-black ${rankColor}">${opt.votes}</p>
                <p class="text-sm text-gray-500">Total Suara</p>
            </div>
        `;
        resultList.appendChild(li);
    });
    
    updateChart(options);
}

function updateChart(options) {
    const labels = options.map(opt => `${opt.no_urut}. ${opt.name}`);
    const data = options.map(opt => opt.votes);
    
    const backgroundColors = options.map((_, index) => {
        const baseColor = 'rgba(233, 30, 99, 0.7)';
        const lighterColor = 'rgba(233, 30, 99, 0.5)';
        const darkestColor = 'rgba(194, 24, 91, 0.8)';

        if (index === 0) return darkestColor;
        if (index % 2 === 0) return baseColor;
        return lighterColor;
    });

    if (voteChart) {
        voteChart.data.labels = labels;
        voteChart.data.datasets[0].data = data;
        voteChart.data.datasets[0].backgroundColor = backgroundColors;
        voteChart.update();
    } else {
        voteChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Perolehan Suara',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: 'rgb(233, 30, 99)',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: 'Grafik Perolehan Suara Kandidat',
                        font: {
                            size: 16
                        },
                        color: '#c2185b'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Jumlah Suara',
                            color: '#e91e63'
                        },
                        ticks: {
                            precision: 0
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        
        document.getElementById('voteChart').style.height = `${options.length * 60}px`;
    }
}


async function vote(optionId) {
    if (IS_VOTED) {
        Swal.fire({
            icon: "warning",
            title: "Sudah Memilih",
            text: "Anda tidak dapat memilih lagi.",
            confirmButtonColor: "#e91e63"
        });
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
            Swal.fire({
                icon: "error",
                title: "Gagal",
                text: result.message,
                confirmButtonColor: "#e91e63"
            });
            
            if (result.message.includes("sudah memilih")) {
                 localStorage.setItem("is_voted", "true");
                 IS_VOTED = true;
            }

        } else if (result.success) {
            Swal.fire({
                icon: "success",
                title: "Berhasil!",
                text: "Suara Anda berhasil dicatat!",
                confirmButtonColor: "#e91e63"
            });
            
            localStorage.setItem("is_voted", "true");
            IS_VOTED = true;
            
            votedMessage.classList.remove('hidden');
        }
        
    } catch (e) {
        Swal.fire({
            icon: "error",
            title: "Kesalahan",
            text: "Terjadi kesalahan saat mengirim suara ke server.",
            confirmButtonColor: "#e91e63"
        });

        console.error(e);
    }
}
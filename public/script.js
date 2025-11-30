const optionContainer = document.getElementById("options");
const resultList = document.getElementById("results");
const votedMessage = document.getElementById("voted-message");
const ctx = document.getElementById('voteChart').getContext('2d'); // Ambil konteks kanvas

const SERVER_IP = window.location.hostname;
const VOTER_ID = localStorage.getItem("voter_id");
let IS_VOTED = localStorage.getItem("is_voted") === 'true';

if (IS_VOTED) {
    votedMessage.classList.remove('hidden');
}

const ws = new WebSocket(`ws://${SERVER_IP}:8081`);

let voteChart; // Variabel untuk menyimpan objek chart

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
        // ... (Tidak ada perubahan pada struktur kartu kandidat) ...
        card.className = "card p-6 flex flex-col items-center"; // Menggunakan class card yang sudah ada

        const photoUrl = opt.photo ? `${SERVER_URL}/${opt.photo}` : 'https://via.placeholder.com/150?text=No+Photo';
        card.innerHTML += `<img src="${photoUrl}" alt="Foto ${opt.name}" class="w-32 h-32 object-cover rounded-full mb-4 border-4 border-pink-400">`; // Mengganti indigo-400 menjadi pink-400 agar sesuai tema warna

        card.innerHTML += `<p class="text-4xl font-black text-pink-700 mb-2">${opt.no_urut}</p>`; // Mengganti indigo-700 menjadi pink-700
        card.innerHTML += `<h3 class="text-xl font-bold text-gray-900 text-center mb-2">${opt.name}</h3>`;
        card.innerHTML += `<p class="text-sm text-gray-500 mb-4">NPM: ${opt.npm || '-'}</p>`;
        
        card.innerHTML += `<div class="w-full text-left space-y-2 mb-4">
            <h4 class="font-semibold text-pink-500">Visi:</h4>
            <p class="text-sm text-gray-600 italic">${opt.visi}</p>
            <h4 class="font-semibold text-pink-500">Misi:</h4>
            <p class="text-sm text-gray-600">${opt.misi.replace(/\n/g, '<br>')}</p>
        </div>`;

        const btn = document.createElement("button");
        btn.innerHTML = IS_VOTED ? "SUDAH MEMILIH" : "PILIH INI";
        btn.className = IS_VOTED 
            ? "mt-auto w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed transition"
            : "mt-auto w-full vote-btn text-white font-bold py-2 rounded-lg transition"; // Mengganti green-500 dengan class vote-btn
            
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
    
    // Urutkan untuk daftar hasil (tetap dipertahankan)
    options.sort((a, b) => b.votes - a.votes);

    options.forEach((opt, index) => {
        const li = document.createElement("li");
        
        let rankColor = 'text-gray-700';
        // Mengubah warna untuk konsistensi: pink-700 untuk juara 1
        if (index === 0) rankColor = 'text-pink-700 font-extrabold'; 
        else if (index === 1) rankColor = 'text-gray-500 font-bold';
        else if (index === 2) rankColor = 'text-pink-800'; // Mengubah yellow-800 menjadi pink-800

        li.className = "result-card p-4 rounded-lg flex justify-between items-center"; // Menggunakan class result-card
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
    
    // --- Logika untuk Chart ---
    updateChart(options);
}

function updateChart(options) {
    const labels = options.map(opt => `${opt.no_urut}. ${opt.name}`);
    const data = options.map(opt => opt.votes);
    
    // Menggunakan warna tema pink (merah muda)
    const backgroundColors = options.map((_, index) => {
        // Skema warna pink/merah muda untuk batang/bar
        const baseColor = 'rgba(233, 30, 99, 0.7)'; // Warna pink dari tema
        const lighterColor = 'rgba(233, 30, 99, 0.5)';
        const darkestColor = 'rgba(194, 24, 91, 0.8)'; // Warna gelap dari tema

        if (index === 0) return darkestColor;
        if (index % 2 === 0) return baseColor;
        return lighterColor;
    });

    if (voteChart) {
        // Perbarui data jika chart sudah ada
        voteChart.data.labels = labels;
        voteChart.data.datasets[0].data = data;
        voteChart.data.datasets[0].backgroundColor = backgroundColors;
        voteChart.update();
    } else {
        // Inisialisasi chart baru jika belum ada
        voteChart = new Chart(ctx, {
            type: 'bar', // Menggunakan bar chart untuk hasil voting
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
                indexAxis: 'y', // Membuat Horizontal Bar Chart
                plugins: {
                    legend: {
                        display: false, // Sembunyikan legenda
                    },
                    title: {
                        display: true,
                        text: 'Grafik Perolehan Suara Kandidat',
                        font: {
                            size: 16
                        },
                        color: '#c2185b' // Warna teks sesuai tema
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
                            precision: 0 // Pastikan sumbu X hanya menampilkan bilangan bulat
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
        
        // Atur tinggi canvas agar chart terlihat baik
        document.getElementById('voteChart').style.height = `${options.length * 60}px`;
    }
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
                 // Perlu memanggil ulang renderOptions untuk memperbarui tampilan tombol
                 // Catatan: 'options' mungkin belum terdefinisi di sini. Asumsikan opsi akan dimuat lagi.
                 // Jika tidak ingin me-reload, panggil fetch ulang atau simpan data opsi secara global.
                 // Untuk solusi cepat, biarkan websocket melakukan update.
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
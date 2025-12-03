// const SERVER_URL = `http://${window.location.hostname}:8080`;
// const WS_URL = `ws://${window.location.hostname}:8081`;

// const voter_id = localStorage.getItem("voter_id");
// if (!voter_id) window.location.href = "login.html";

// ===================================
// 1. FUNGSI UTAMA UNTUK MENGAMBIL DATA
// ===================================
async function loadResults() {
    try {
        // Mengambil data kandidat (options) dari server API
        const res = await fetch(`${SERVER_URL}/options`);
        
        // Cek jika response tidak OK
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        
        console.log("DATA DARI SERVER:", data); 
        
        // Memanggil fungsi untuk merender data ke HTML
        renderResults(data);

    } catch (err) {
        console.error("❌ Gagal load hasil voting:", err);
        // Tambahkan fallback UI jika fetch gagal
        document.getElementById("candidate-list").innerHTML = 
            '<p class="text-red-500 font-medium">Gagal mengambil data dari server. Silakan coba refresh.</p>';
        document.getElementById("total-suara").innerText =
            `Gagal memuat total suara.`;
    }
}

// ===================================
// 2. FUNGSI UNTUK MERENDER HASIL KE HTML
// ===================================
function renderResults(data) {
    const container = document.getElementById("candidate-list");
    container.innerHTML = "";

    // Menghitung total suara
    let totalSuara = data.reduce((a, b) => a + b.votes, 0);

    // Update total suara
    document.getElementById("total-suara").innerText =
        `Total suara masuk: ${totalSuara} suara`;
        
    // Urutkan data berdasarkan jumlah suara dari terbesar ke terkecil
    data.sort((a, b) => b.votes - a.votes);

    // Iterasi dan render setiap kandidat
    data.forEach(k => {
        let persen = totalSuara === 0 ? 0 : ((k.votes / totalSuara) * 100).toFixed(1);

        container.innerHTML += `
            <div class="p-4 bg-white rounded-xl shadow border">
                <img 
                    src="${SERVER_URL}/${k.photo}"
                    class="w-full rounded-xl mb-3 h-52 object-cover"
                    onerror="this.src='https://placehold.co/400x300?text=NO+IMAGE'"
                >

                <h3 class="text-xl font-bold">${k.name}</h3>
                <p class="text-gray-600 text-sm mb-3">No. Urut: ${k.no_urut} | Calon Ketua Umum HMIF</p>

                <p class="font-semibold mb-1 text-pink-700">${k.votes} suara (${persen}%)</p>

                <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div class="bg-pink-600 h-3 rounded-full transition-all duration-500" style="width: ${persen}%"></div>
                </div>
            </div>
        `;
    });
}

// ===================================
// 3. FUNGSI UNTUK WEBSOCKET REAL-TIME
// ===================================
let ws;
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("✅ WebSocket Connected");
    };

    ws.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);

            // Jika ada pesan update, muat ulang hasil
            if (data.type === "update" && data.options) {
                console.log("WS: Data update diterima, merender ulang.");
                renderResults(data.options);
            }
            // Khusus jika menerima tipe 'vote', panggil loadResults (lebih aman)
            else if (data.type === "vote") {
                 console.log("WS: Pesan vote baru diterima, memuat hasil terbaru.");
                 loadResults();
            }

        } catch (e) {
            console.error("WS parse error:", e);
        }
    };

    ws.onclose = () => {
        console.log("⚠️ WS Disconnected, reconnecting in 2s...");
        // Mekanisme Reconnect otomatis
        setTimeout(connectWebSocket, 2000); 
    };
    
    ws.onerror = (err) => {
        console.error("WS Error:", err);
        ws.close();
    }
}

// ===================================
// 4. FUNGSI LOGOUT
// ===================================
function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}


// ===================================
// 5. INISIALISASI (MAIN LOGIC)
// ===================================

// Tampilkan nama user
document.getElementById("welcome-user").innerText = 
  localStorage.getItem("username");

// 1. Muat hasil voting saat halaman pertama kali dibuka
loadResults(); 

// 2. Mulai koneksi WebSocket untuk update real-time
connectWebSocket(); 

// 3. Sebagai mekanisme fallback, muat ulang hasil setiap 5 detik
// Ini akan memastikan update terjadi meskipun WS gagal/terputus.
setInterval(loadResults, 5000);
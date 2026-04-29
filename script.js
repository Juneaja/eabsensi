class AbsensiApp {
    constructor() {
        this.db = {
            users: [],
            absensi: [],
            admin: { username: 'admin', password: 'admin123' }
        };
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadData();
        this.bindEvents();
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 1000);
        
        // Cek login admin
        if (!localStorage.getItem('adminLoggedIn')) {
            document.getElementById('loginModal').classList.add('active');
        } else {
            document.getElementById('mainApp').style.display = 'block';
            this.loadUsers();
            this.loadLaporan();
        }
    }

    bindEvents() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('adminLoggedIn');
            location.reload();
        });

        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Signup
        document.getElementById('signupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        // Absen
        document.getElementById('absenBtn').addEventListener('click', () => {
            this.startAbsen();
        });

        // Export
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToExcel();
        });

        // Filter
        document.getElementById('filterDate').addEventListener('change', () => {
            this.loadLaporan();
        });

        document.getElementById('filterUser').addEventListener('change', () => {
            this.loadLaporan();
        });
    }

    handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        if (username === this.db.admin.username && password === this.db.admin.password) {
            localStorage.setItem('adminLoggedIn', 'true');
            document.getElementById('loginModal').classList.remove('active');
            document.getElementById('mainApp').style.display = 'block';
            this.loadUsers();
            this.loadLaporan();
        } else {
            alert('Username atau password salah!');
        }
    }

    handleSignup() {
        const user = {
            id: Date.now(),
            nama: document.getElementById('nama').value,
            nip: document.getElementById('nip').value,
            email: document.getElementById('email').value,
            departemen: document.getElementById('departemen').value,
            createdAt: new Date().toISOString()
        };

        this.db.users.push(user);
        this.saveData();
        this.loadUsers();
        this.loadLaporan();
        document.getElementById('signupForm').reset();

        // Update filter users
        this.updateFilterUsers();

        alert('Pengguna berhasil didaftarkan!');
    }

    async startAbsen() {
        try {
            // Ambil GPS
            const position = await this.getCurrentPosition();
            const { latitude, longitude } = position.coords;
            
            // Ambil selfie
            const photo = await this.takeSelfie();
            
            // Buat absensi
            const absenData = {
                id: Date.now(),
                userId: this.getRandomUserId(),
                nama: this.getRandomUser().nama,
                nip: this.getRandomUser().nip,
                type: 'masuk', // atau 'keluar' berdasarkan waktu
                timestamp: new Date().toISOString(),
                latitude,
                longitude,
                photo: photo,
                location: await this.reverseGeocode(latitude, longitude)
            };

            this.db.absensi.push(absenData);
            this.saveData();
            this.showAbsenResult(absenData);
            this.loadLaporan();

        } catch (error) {
            alert('Gagal absen: ' + error.message);
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
    }

    takeSelfie() {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const stream = navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: 640, height: 640 } 
            });

            document.body.appendChild(video);
            video.style.display = 'none';

            stream.then(() => {
                video.play();
                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    
                    setTimeout(() => {
                        ctx.drawImage(video, 0, 0);
                        stream.then(s => {
                            s.getTracks().forEach(track => track.stop());
                            video.remove();
                        });
                        
                        // Tambah watermark GPS
                        ctx.fillStyle = 'rgba(255,255,255,0.9)';
                        ctx.fillRect(10, canvas.height - 60, 300, 50);
                        ctx.fillStyle = '#333';
                        ctx.font = 'bold 16px Arial';
                        ctx.fillText(`GPS: ${canvas.width}px`, 20, canvas.height - 35);
                        
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        resolve(dataUrl);
                    }, 1000);
                };
            });
        });
    }

    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await response.json();
            return data.display_name || 'Lokasi tidak dikenali';
        } catch {
            return `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(tabName + 'Tab').classList.add('active');
    }

    loadUsers() {
        const userList = document.getElementById('userList');
        userList.innerHTML = this.db.users.map(user => `
            <div class="user-item">
                <div>
                    <strong>${user.nama}</strong><br>
                    <small>${user.nip} - ${user.email}</small>
                </div>
                <div class="user-actions">
                    <button class="btn btn-danger" onclick="app.deleteUser(${user.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    loadLaporan() {
        const filterDate = document.getElementById('filterDate').value;
        const filterUser = document.getElementById('filterUser').value;
        
        let filteredAbsensi = this.db.absensi;
        
        if (filterDate) {
            filteredAbsensi = filteredAbsensi.filter(a => 
                new Date(a.timestamp).toISOString().split('T')[0] === filterDate
            );
        }
        
        if (filterUser) {
            filteredAbsensi = filteredAbsensi.filter(a => a.userId == filterUser);
        }

        document.getElementById('laporanTable').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Nama</th>
                        <th>NIP</th>
                        <th>Tipe</th>
                        <th>Waktu</th>
                        <th>Lokasi</th>
                        <th>Foto</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredAbsensi.map(absen => `
                        <tr>
                            <td>${absen.nama}</td>
                            <td>${absen.nip}</td>
                            <td>
                                <span class="badge ${absen.type === 'masuk' ? 'badge-success' : 'badge-warning'}">
                                    ${absen.type.toUpperCase()}
                                </span>
                            </td>
                            <td>${new Date(absen.timestamp).toLocaleString('id-ID')}</td>
                            <td>${absen.location.substring(0, 50)}...</td>
                            <td>
                                <img src="${absen.photo}" width="50" height="50" 
                                     style="border-radius: 5px; object-fit: cover;" 
                                     onclick="window.open(this.src)">
                            </td>
                        </tr>
                    `).reverse().join('')}
                </tbody>
            </table>
        `;
    }

    updateFilterUsers() {
        const filterUser = document.getElementById('filterUser');
        filterUser.innerHTML = '<option value="">Semua Pengguna</option>' + 
            this.db.users.map(user => 
                `<option value="${user.id}">${user.nama}</option>`
            ).join('');
    }

    exportToExcel() {
        const data = this.db.absensi.map(absen => ({
            'Nama': absen.nama,
            'NIP': absen.nip,
            'Tipe Absen': absen.type,
            'Waktu': new Date(absen.timestamp).toLocaleString('id-ID'),
            'Latitude': absen.latitude,
            'Longitude': absen.longitude,
            'Lokasi': absen.location
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Absensi');
        XLSX.writeFile(wb, `Laporan_Absensi_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    updateDateTime() {
        const now = new Date();
        document.getElementById('currentDate').textContent = now.toLocaleString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        document.getElementById('absenTime').textContent = now.toLocaleTimeString('id-ID');
        document.getElementById('absenTitle').textContent = 
            now.getHours() < 12 ? 'Absen Masuk' : 'Absen Keluar';
    }

    getRandomUser() {
        return this.db.users[Math.floor(Math.random() * this.db.users.length)] || 
               { nama: 'Demo User', nip: '123456' };
    }

    getRandomUserId() {
        return this.db.users[Math.floor(Math.random() * this.db.users.length)]?.id || 1;
    }

    deleteUser(userId) {
        if (confirm('Hapus pengguna ini?')) {
            this.db.users = this.db.users.filter(u => u.id != userId);
            this.saveData();
            this.loadUsers();
            this.updateFilterUsers();
            this.loadLaporan();
        }
    }

    showAbsenResult(absenData) {
        document.getElementById('selfiePreview').innerHTML = `
            <img src="${absenData.photo}" alt="Selfie">
            <p style="color: green; font-weight: bold;">✅ Absen Berhasil!</p>
        `;
        document.getElementById('selfiePreview').classList.add('has-image');
        
        setTimeout(() => {
            document.getElementById('selfiePreview').innerHTML = `
                <i class="fas fa-camera fa-5x"></i>
                <p>Klik tombol untuk selfie</p>
            `;
            document.getElementById('selfiePreview').classList.remove('has-image');
        }, 5000);
    }

    saveData() {
        localStorage.setItem('absensiData', JSON.stringify(this.db));
    }

    loadData() {
        const data = localStorage.getItem('absensiData');
        if (data) {
            this.db = { ...this.db, ...JSON.parse(data) };
        }
        this.updateFilterUsers();
    }
}

// Inisialisasi aplikasi
const app = new AbsensiApp();

// Tambahkan library XLSX untuk export Excel
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
document.head.appendChild(script);
// Tambahkan CSS untuk badge yang hilang
const style = document.createElement('style');
style.textContent = `
    .badge {
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
    }
    .badge-success { background: #48bb78; color: white; }
    .badge-warning { background: #ed8936; color: white; }
`;
document.head.appendChild(style);

class AbsensiApp {
    constructor() {
        this.db = {
            users: [],
            absensi: [],
            admin: { username: 'admin', password: 'admin123' }
        };
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadData();
        this.bindEvents();
        this.updateDateTime();
        this.loadInitialData(); // Tambah data demo
        setInterval(() => this.updateDateTime(), 1000);
        
        // Cek login admin
        if (!localStorage.getItem('adminLoggedIn')) {
            this.showLoginModal();
        } else {
            this.showMainApp();
            this.loadUsers();
            this.loadLaporan();
            this.updateFilterUsers();
        }
    }

    bindEvents() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Enter key untuk login
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('Yakin ingin logout?')) {
                localStorage.removeItem('adminLoggedIn');
                location.reload();
            }
        });

        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Signup form
        document.getElementById('signupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        // Absen button
        document.getElementById('absenBtn').addEventListener('click', () => {
            this.startAbsen();
        });

        // Filter events
        document.getElementById('filterDate').addEventListener('change', () => {
            this.loadLaporan();
        });

        document.getElementById('filterUser').addEventListener('change', () => {
            this.loadLaporan();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToExcel();
        });

        // Reset filter
        document.getElementById('filterDate').valueAsDate = new Date();
    }

    showLoginModal() {
        document.getElementById('loginModal').classList.add('active');
        document.getElementById('mainApp').style.display = 'none';
    }

    showMainApp() {
        document.getElementById('loginModal').classList.remove('active');
        document.getElementById('mainApp').style.display = 'block';
    }

    handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (username === this.db.admin.username && password === this.db.admin.password) {
            localStorage.setItem('adminLoggedIn', 'true');
            this.showMainApp();
            this.loadUsers();
            this.loadLaporan();
            this.updateFilterUsers();
            document.getElementById('loginForm').reset();
        } else {
            this.showError('Username atau password salah!');
        }
    }

    handleSignup() {
        const nama = document.getElementById('nama').value.trim();
        const nip = document.getElementById('nip').value.trim();
        const email = document.getElementById('email').value.trim();
        const departemen = document.getElementById('departemen').value;

        // Validasi
        if (!nama || !nip || !email || !departemen) {
            this.showError('Semua field harus diisi!');
            return;
        }

        if (this.db.users.find(u => u.nip === nip)) {
            this.showError('NIP sudah terdaftar!');
            return;
        }

        const user = {
            id: Date.now(),
            nama,
            nip,
            email,
            departemen,
            createdAt: new Date().toISOString()
        };

        this.db.users.push(user);
        this.saveData();
        this.loadUsers();
        this.updateFilterUsers();
        this.loadLaporan();
        document.getElementById('signupForm').reset();

        this.showSuccess('Pengguna berhasil didaftarkan!');
    }

    async startAbsen() {
        const absenBtn = document.getElementById('absenBtn');
        absenBtn.disabled = true;
        absenBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

        try {
            // Cek GPS support
            if (!navigator.geolocation) {
                throw new Error('Geolocation tidak didukung browser ini');
            }

            // Ambil GPS
            const position = await this.getCurrentPosition();
            const { latitude, longitude } = position.coords;
            
            // Update lokasi real-time
            document.getElementById('absenLocation').textContent = 
                `Mengambil lokasi... (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

            // Ambil selfie
            const photo = await this.takeSelfieWithWatermark(latitude, longitude);
            
            // Reverse geocode
            const location = await this.reverseGeocode(latitude, longitude);
            
            // Tentukan tipe absen
            const now = new Date();
            const hour = now.getHours();
            const type = (hour >= 7 && hour <= 17) ? 'masuk' : 'keluar';

            // Pilih user random untuk demo
            const user = this.getRandomUser();
            if (!user) {
                throw new Error('Belum ada pengguna terdaftar!');
            }

            // Buat data absensi
            const absenData = {
                id: Date.now(),
                userId: user.id,
                nama: user.nama,
                nip: user.nip,
                email: user.email,
                departemen: user.departemen,
                type,
                timestamp: now.toISOString(),
                latitude: latitude.toFixed(6),
                longitude: longitude.toFixed(6),
                location,
                photo
            };

            this.db.absensi.push(absenData);
            this.saveData();
            
            // Tampilkan hasil
            this.showAbsenResult(absenData);
            this.loadLaporan();

            this.showSuccess(`Absen ${type.toUpperCase()} berhasil!`);

        } catch (error) {
            console.error('Absen error:', error);
            this.showError('Gagal absen: ' + error.message + '\n\nIzinkan akses kamera & lokasi!');
            
            // Reset preview
            this.resetSelfiePreview();
        } finally {
            absenBtn.disabled = false;
            absenBtn.innerHTML = '<i class="fas fa-camera"></i> Ambil Selfie & Absen';
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve, 
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 30000
                }
            );
        });
    }

    takeSelfieWithWatermark(lat, lng) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Setup preview
            const preview = document.getElementById('selfiePreview');
            preview.innerHTML = '<i class="fas fa-video fa-3x"></i><p>Mengakses kamera...</p>';

            navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user', 
                    width: { ideal: 640 }, 
                    height: { ideal: 640 } 
                } 
            }).then(stream => {
                video.srcObject = stream;
                video.play();
                
                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    
                    // Tunggu 1.5 detik untuk stabil
                    setTimeout(() => {
                        // Capture
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        
                        // Tambah watermark GPS
                        this.addWatermark(ctx, canvas, lat, lng);
                        
                        // Stop stream
                        stream.getTracks().forEach(track => track.stop());
                        
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                        resolve(dataUrl);
                        
                        // Update preview
                        preview.innerHTML = `<img src="${dataUrl}" alt="Selfie">`;
                        preview.classList.add('has-image');
                    }, 1500);
                };
                
                video.onerror = reject;
            }).catch(reject);
        });
    }

    addWatermark(ctx, canvas, lat, lng) {
        const now = new Date();
        
        // Background watermark
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, canvas.height - 120, canvas.width - 20, 110);
        
        // GPS info
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('📍 GPS Verified', 25, canvas.height - 85);
        
        ctx.font = '16px Arial';
        ctx.fillText(`Lat: ${lat}`, 25, canvas.height - 60);
        ctx.fillText(`Lng: ${lng}`, 25, canvas.height - 40);
        
        // Timestamp
        ctx.fillText(`⏰ ${now.toLocaleString('id-ID')}`, 25, canvas.height - 15);
        
        // Border
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 4;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    }

    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`,
                { signal: AbortSignal.timeout(5000) }
            );
            const data = await response.json();
            return data.display_name?.substring(0, 80) || 'Lokasi tidak dikenali';
        } catch {
            return `GPS: ${lat}, ${lng}`;
        }
    }

    switchTab(tabName) {
        // Remove active class
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Add active class
        event.currentTarget.classList.add('active');
        document.getElementById(tabName + 'Tab').classList.add('active');
    }

    loadUsers() {
        const userList = document.getElementById('userList');
        if (this.db.users.length === 0) {
            userList.innerHTML = '<p style="text-align:center;color:#999;">Belum ada pengguna terdaftar</p>';
            return;
        }

        userList.innerHTML = this.db.users.map(user => `
            <div class="user-item">
                <div>
                    <strong style="color: #667eea;">${user.nama}</strong><br>
                    <small style="color: #666;">
                        <i class="fas fa-id-card"></i> ${user.nip} | 
                        <i class="fas fa-envelope"></i> ${user.email} | 
                        <i class="fas fa-building"></i> ${user.departemen}
                    </small>
                </div>
                <div class="user-actions">
                    <button class="btn btn-danger btn-sm" onclick="app.deleteUser(${user.id})" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    loadLaporan() {
        const filterDate = document.getElementById('filterDate').value;
        const filterUserId = document.getElementById('filterUser').value;
        
        let filteredAbsensi = [...this.db.absensi];
        
        // Filter by date
        if (filterDate) {
            filteredAbsensi = filteredAbsensi.filter(a => {
                const absenDate = new Date(a.timestamp).toISOString().split('T')[0];
                return absenDate === filterDate;
            });
        }
        
        // Filter by user
        if (filterUserId) {
            filteredAbsensi = filteredAbsensi.filter(a => a.userId == filterUserId);
        }

        const tableContainer = document.getElementById('laporanTable');
        
        if (filteredAbsensi.length === 0) {
            tableContainer.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">Belum ada data absensi</p>';
            return;
        }

        tableContainer.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <strong>Total: ${filteredAbsensi.length} absensi</strong>
                <button id="exportBtn" class="btn btn-success">
                    <i class="fas fa-file-excel"></i> Export Excel
                </button>
            </div>
            <div style="overflow:auto;">
                <table>
                    <thead>
                        <tr>
                            <th style="width:150px;">Nama</th>
                            <th style="width:100px;">NIP</th>
                            <th style="width:80px;">Tipe</th>
                            <th style="width:180px;">Waktu</th>
                            <th style="width:200px;">Lokasi</th>
                            <th style="width:80px;">Foto</th>
                            <th style="width:120px;">GPS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredAbsensi.map(absen => `
                            <tr>
                                <td><strong>${absen.nama}</strong><br><small>${absen.departemen}</small></td>
                                <td>${absen.nip}</td>
                                <td>
                                    <span class="badge ${absen.type === 'masuk' ? 'badge-success' : 'badge-warning'}">
                                        ${absen.type.toUpperCase()}
                                    </span>
                                </td>
                                <td>${new Date(absen.timestamp).toLocaleString('id-ID')}</td>
                                <td title="${absen.location}">${absen.location.substring(0, 35)}...</td>
                                <td>
                                    <img src="${absen.photo}" 
                                         width="50" height="50" 
                                         style="border-radius:8px;object-fit:cover;cursor:pointer;border:2px solid #eee;"
                                         onclick="window.open(this.src, '_blank')">
                                </td>
                                <td>
                                    <small style="font-family:monospace;">
                                        ${absen.latitude}<br>${absen.longitude}
                                    </small>
                                </td>
                            </tr>
                        `).reverse().join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    updateFilterUsers() {
        const filterUser = document.getElementById('filterUser');
        filterUser.innerHTML = '<option value="">Semua Pengguna</option>' + 
            this.db.users.map(user => 
                `<option value="${user.id}">${user.nama} (${user.nip})</option>`
            ).join('');
    }

    loadInitialData() {
        // Tambah data demo jika kosong
        if (this.db.users.length === 0) {
            const demoUsers = [
                { id: 1, nama: 'Budi Santoso', nip: 'NIP001', email: 'budi@perusahaan.com', departemen: 'IT', createdAt: new Date().toISOString() },
                { id: 2, nama: 'Sari Dewi', nip: 'NIP002', email: 'sari@perusahaan.com', departemen: 'HR', createdAt: new Date().toISOString() },
                { id: 3, nama: 'Ahmad Fauzi', nip: 'NIP003', email: 'ahmad@perusahaan.com', departemen: 'Finance', createdAt: new Date().toISOString() }
            ];
            this.db.users = demoUsers;
            this.saveData();
            this.loadUsers();
            this.updateFilterUsers();
        }
    }

    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            this.showError('Library Excel belum load. Refresh halaman!');
            return;
        }

        const filterDate = document.getElementById('filterDate').value;
        const filterUserId = document.getElementById('filterUser').value;
        
        let data = [...this.db.absensi];
        
        if (filterDate) {
            data = data.filter(a => new Date(a.timestamp).toISOString().split('T')[0] === filterDate);
        }
        if (filterUserId) {
            data = data.filter(a => a.userId == filterUserId);
        }

        const exportData = data.map(absen => ({
            'Nama': absen.nama,
            'NIP': absen.nip,
            'Departemen': absen.departemen,
            'Tipe Absen': absen.type.toUpperCase(),
            'Tanggal': new Date(absen.timestamp).toLocaleDateString('id-ID'),
            'Waktu': new Date(absen.timestamp).toLocaleTimeString('id-ID'),
            'Latitude': absen.latitude,
            'Longitude': absen.longitude,
            'Lokasi': absen.location.substring(0, 100)
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Laporan Absensi');
        
        const filename = `Laporan_Absensi_${new Date().toISOString().split('T')[0]}_${data.length}_data.xlsx`;
        XLSX.writeFile(wb, filename);
        
        this.showSuccess(`Excel berhasil diexport: ${data.length} data`);
    }

    updateDateTime() {
        const now = new Date();
        
        // Header date
        document.getElementById('currentDate').textContent = now.toLocaleString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Absen time
        document.getElementById('absenTime').textContent = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Absen title
        const hour = now.getHours();
        const title = (hour >= 7 && hour < 17) ? 'Absen Masuk' : 'Absen Keluar';
        document.getElementById('absenTitle').textContent = title;
    }

    getRandomUser() {
        if (this.db.users.length === 0) return null;
        return this.db.users[Math.floor(Math.random() * this.db.users.length)];
    }

    deleteUser(userId) {
        if (confirm('Hapus pengguna ini? Data absensi terkait tetap tersimpan.')) {
            this.db.users = this.db.users.filter(u => u.id != userId);
            this.saveData();
            this.loadUsers();
            this.updateFilterUsers();
            this.loadLaporan();
            this.showSuccess('Pengguna dihapus!');
        }
    }

    showAbsenResult(absenData) {
        const preview = document.getElementById('selfiePreview');
        preview.innerHTML = `
            <img src="${absenData.photo}" alt="Selfie Absen">
            <div style="margin-top:10px;">
                <strong style="color:#28a745;">✅ ${absenData.type.toUpperCase()} BERHASIL</strong><br>
                <small>${absenData.nama} - ${absenData.nip}</small>
            </div>
        `;
        preview.classList.add('has-image');

        // Reset after 6 seconds
        setTimeout(() => {
            this.resetSelfiePreview();
        }, 6000);
    }

    resetSelfiePreview() {
        const preview = document.getElementById('selfiePreview');
        preview.innerHTML = `
            <i class="fas fa-camera fa-5x" style="color:#667eea;"></i>
            <p style="color:#666;margin-top:10px;">Klik tombol untuk selfie</p>
        `;
        preview.classList.remove('has-image');
    }

    showError(message) {
        alert('❌ ' + message);
    }

    showSuccess(message) {
        // Modern toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position:fixed;top:20px;right:20px;background:#28a745;color:white;
            padding:15px 20px;border-radius:10px;box-shadow:0 5px 20px rgba(0,0,0,0.3);
            z-index:10000;font-weight:600;transform:translateX(400px);transition:all 0.3s;
        `;
        toast.innerHTML = `✅ ${message}`;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.transform = 'translateX(0)', 100);
        setTimeout(() => {
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    saveData() {
        localStorage.setItem('absensiData', JSON.stringify(this.db));
    }

    loadData() {
        try {
            const data = localStorage.getItem('absensiData');
            if (data) {
                const parsed = JSON.parse(data);
                this.db.users = parsed.users || [];
                this.db.absensi = parsed.absensi || [];
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }
}

// Load XLSX library dan inisialisasi
function loadXLSX() {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => {
        console.log('XLSX loaded');
    };
    document.head.appendChild(script);
}

// Inisialisasi aplikasi
const app = new AbsensiApp();
loadXLSX();

// Global functions untuk onclick
window.app = app;
// Tambahkan CSS tambahan yang diperlukan
const additionalStyle = document.createElement('style');
additionalStyle.textContent = `
    .badge {
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        text-transform: uppercase;
    }
    .badge-success { 
        background: linear-gradient(45deg, #28a745, #20c997);
        color: white; 
    }
    .badge-warning { 
        background: linear-gradient(45deg, #ffc107, #fd7e14);
        color: white; 
    }
    .btn-sm {
        padding: 6px 12px !important;
        font-size: 14px !important;
    }
    .user-item:hover {
        background: #e3f2fd !important;
        transform: translateX(5px);
        transition: all 0.3s;
    }
    #selfiePreview.has-image img {
        border: 4px solid #28a745 !important;
        box-shadow: 0 10px 30px rgba(40, 167, 69, 0.3);
    }
    table img:hover {
        transform: scale(1.5);
        z-index: 10;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
    }
`;
document.head.appendChild(additionalStyle);

class AbsensiApp {
    constructor() {
        this.db = {
            users: [],
            absensi: [],
            admin: { 
                username: 'admin', 
                password: 'admin123' 
            },
            settings: {
                version: '1.0.0',
                lastBackup: null
            }
        };
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadData();
        this.bindEvents();
        this.loadXLSXLibrary();
        this.updateDateTime();
        this.loadInitialData();
        setInterval(() => this.updateDateTime(), 1000);
        
        // Cek login admin
        if (!localStorage.getItem('adminLoggedIn')) {
            this.showLoginModal();
        } else {
            this.showMainApp();
            this.loadUsers();
            this.loadLaporan();
            this.updateFilterUsers();
        }
    }

    loadXLSXLibrary() {
        if (typeof XLSX !== 'undefined') return;
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => {
            console.log('✅ XLSX library loaded successfully');
        };
        script.onerror = () => {
            console.warn('⚠️ XLSX library gagal load (export tetap bisa dicoba)');
        };
        document.head.appendChild(script);
    }

    bindEvents() {
        // Login Form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('Yakin ingin logout? Data akan tetap tersimpan.')) {
                localStorage.removeItem('adminLoggedIn');
                location.reload();
            }
        });

        // Navigation Tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        // Signup Form
        document.getElementById('signupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        // Absen Button
        document.getElementById('absenBtn').addEventListener('click', () => {
            this.startAbsen();
        });

        // Filter Events
        document.getElementById('filterDate').addEventListener('change', () => {
            this.loadLaporan();
        });
        document.getElementById('filterUser').addEventListener('change', () => {
            this.loadLaporan();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                this.exportToExcel();
            }
            if (e.key === 'Escape') {
                this.resetSelfiePreview();
            }
        });
    }

    showLoginModal() {
        document.getElementById('loginModal').classList.add('active');
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginUsername').focus();
    }

    showMainApp() {
        document.getElementById('loginModal').classList.remove('active');
        document.getElementById('mainApp').style.display = 'block';
    }

    handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (username === this.db.admin.username && password === this.db.admin.password) {
            localStorage.setItem('adminLoggedIn', 'true');
            this.showMainApp();
            this.loadUsers();
            this.loadLaporan();
            this.updateFilterUsers();
            document.getElementById('loginForm').reset();
            this.showSuccess('Login berhasil! Selamat datang Admin');
        } else {
            this.shakeAnimation('loginForm');
            this.showError('❌ Username atau password salah!');
            document.getElementById('loginPassword').value = '';
            document.getElementById('loginPassword').focus();
        }
    }

    handleSignup() {
        const nama = document.getElementById('nama').value.trim();
        const nip = document.getElementById('nip').value.trim().toUpperCase();
        const email = document.getElementById('email').value.trim();
        const departemen = document.getElementById('departemen').value;

        // Validasi lengkap
        if (!nama || !nip || !email || !departemen) {
            this.showError('Semua field wajib diisi!');
            return;
        }

        if (nip.length < 5) {
            this.showError('NIP minimal 5 karakter!');
            return;
        }

        if (this.db.users.find(u => u.nip === nip)) {
            this.showError('NIP sudah terdaftar!');
            document.getElementById('nip').focus();
            return;
        }

        if (!email.includes('@')) {
            this.showError('Format email tidak valid!');
            return;
        }

        const user = {
            id: Date.now(),
            nama,
            nip,
            email: email.toLowerCase(),
            departemen,
            createdAt: new Date().toISOString()
        };

        this.db.users.push(user);
        this.saveData();
        this.loadUsers();
        this.updateFilterUsers();
        this.loadLaporan();
        document.getElementById('signupForm').reset();

        this.showSuccess(`✅ Pengguna "${nama}" berhasil didaftarkan!`);
        this.shakeAnimation('signupForm', 'success');
    }

    async startAbsen() {
        const absenBtn = document.getElementById('absenBtn');
        const preview = document.getElementById('selfiePreview');
        
        // Loading state
        absenBtn.disabled = true;
        absenBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengakses GPS...';
        preview.innerHTML = '<i class="fas fa-map-marker-alt fa-3x" style="color:#ff6b35;"></i><p>Mengambil lokasi...</p>';

        try {
            // 1. Cek GPS support
            if (!navigator.geolocation) {
                throw new Error('Geolocation tidak didukung browser ini');
            }

            // 2. Ambil GPS location
            const position = await this.getCurrentPosition();
            const { latitude, longitude, accuracy } = position.coords;
            
            document.getElementById('absenLocation').textContent = 
                `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (akurasi: ${accuracy.toFixed(0)}m)`;

            preview.innerHTML = '<i class="fas fa-camera fa-3x" style="color:#667eea;"></i><p>Mengakses kamera...</p>';

            // 3. Ambil selfie dengan watermark
            const photo = await this.takeSelfieWithWatermark(latitude, longitude);
            
            preview.innerHTML = '<i class="fas fa-map-pin fa-3x" style="color:#28a745;"></i><p>Mengidentifikasi lokasi...</p>';

            // 4. Reverse geocode
            const location = await this.reverseGeocode(latitude, longitude);
            
            // 5. Tentukan tipe absen berdasarkan jam
            const now = new Date();
            const hour = now.getHours();
            const type = (hour >= 7 && hour <= 9) ? 'masuk' : 
                        (hour >= 16 && hour <= 18) ? 'keluar' : 'hadir';

            // 6. Pilih user (random untuk demo)
            const user = this.getRandomUser();
            if (!user) {
                throw new Error('Belum ada pengguna terdaftar! Daftarkan dulu di tab Admin.');
            }

            // 7. Simpan absensi
            const absenData = {
                id: Date.now(),
                userId: user.id,
                nama: user.nama,
                nip: user.nip,
                email: user.email,
                departemen: user.departemen,
                type,
                timestamp: now.toISOString(),
                latitude: latitude.toFixed(6),
                longitude: longitude.toFixed(6),
                accuracy: accuracy.toFixed(0),
                location: location.substring(0, 120),
                photo,
                battery: navigator.getBattery ? 'N/A' : 'N/A'
            };

            this.db.absensi.push(absenData);
            this.saveData();
            
            // 8. Update UI
            this.showAbsenResult(absenData);
            this.loadLaporan();
            this.showSuccess(`✅ Absen ${type.toUpperCase()} berhasil!\n${user.nama}`);

        } catch (error) {
            console.error('Absen Error:', error);
            this.showError(`Gagal absen:\n${error.message}\n\n💡 Pastikan:\n• Izinkan akses lokasi\n• Izinkan akses kamera\n• Koneksi internet stabil`);
            this.resetSelfiePreview();
        } finally {
            absenBtn.disabled = false;
            absenBtn.innerHTML = '<i class="fas fa-camera"></i> Ambil Selfie & Absen';
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation tidak tersedia'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                resolve,
                (error) => {
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            reject(new Error('Lokasi ditolak. Izinkan akses lokasi!'));
                            break;
                        case error.POSITION_UNAVAILABLE:
                            reject(new Error('Lokasi tidak tersedia'));
                            break;
                        case error.TIMEOUT:
                            reject(new Error('Timeout mengambil lokasi'));
                            break;
                        default:
                            reject(new Error('Error mengambil lokasi'));
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 30000
                }
            );
        });
    }

    takeSelfieWithWatermark(lat, lng) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const preview = document.getElementById('selfiePreview');
            
            navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user', 
                    width: { ideal: 640 }, 
                    height: { ideal: 640 },
                    frameRate: { ideal: 30 }
                } 
            }).then(stream => {
                video.srcObject = stream;
                video.muted = true;
                video.playsInline = true;
                video.play();
                
                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 640;
                    
                    // Countdown effect
                    let countdown = 3;
                    preview.innerHTML = `<div style="font-size:24px;font-weight:bold;color:#ff6b35;">${countdown}</div>`;
                    
                    const countdownInterval = setInterval(() => {
                        countdown--;
                        if (countdown > 0) {
                            preview.innerHTML = `<div style="font-size:24px;font-weight:bold;color:#ff6b35;">${countdown}</div>`;
                        } else {
                            clearInterval(countdownInterval);
                            
                            // Capture photo
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            
                            // Tambahkan watermark lengkap
                            this.addCompleteWatermark(ctx, canvas, lat, lng);
                            
                            // Stop camera
                            stream.getTracks().forEach(track => track.stop());
                            
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                            resolve(dataUrl);
                        }
                    }, 1000);
                };
                
            }).catch(reject);
        });
    }

    addCompleteWatermark(ctx, canvas, lat, lng) {
        const now = new Date();
        
        // 1. Background semi-transparent
        const gradient = ctx.createLinearGradient(0, canvas.height - 140, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height - 150, canvas.width, 150);
        
        // 2. Header watermark
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✅ ABSENSI DIGITAL', canvas.width / 2, canvas.height - 115);
        
        // 3. GPS Coordinates
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('📍 GPS LOCATION', 20, canvas.height - 85);
        
        ctx.font = '18px monospace';
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText(`Lat: ${parseFloat(lat).toFixed(6)}`, 25, canvas.height - 60);
        ctx.fillText(`Lng: ${parseFloat(lng).toFixed(6)}`, 25, canvas.height - 38);
        
        // 4. Timestamp
        ctx.fillStyle = '#b0b0b0';
        ctx.font = '16px monospace';
        ctx.fillText(`Timestamp: ${now.toLocaleString('id-ID')}`, 25, canvas.height - 15);
        
        // 5. Border verified
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 180);
        
        // 6. Verified badge
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(canvas.width - 60, 40, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', canvas.width - 60, 42);
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                { 
                    signal: AbortSignal.timeout(8000),
                    cache: 'no-cache'
                }
            );
            if (!response.ok) throw new Error('Geocode failed');
            
            const data = await response.json();
            const address = [
                data.display_name || '',
                data.address?.road || '',
                data.address?.city || '',
                data.address?.state || ''
            ].filter(Boolean).join(', ').substring(0, 120);
            
            return address || `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (error) {
            console.warn('Geocode failed:', error);
            return `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        event.currentTarget.classList.add('active');
        document.getElementById(tabName + 'Tab').classList.add('active');
    }

    loadUsers() {
        const userList = document.getElementById('userList');
        if (this.db.users.length === 0) {
            userList.innerHTML = `
                <div style="text-align:center;padding:40px;color:#999;">
                    <i class="fas fa-users fa-3x" style="margin-bottom:15px;opacity:0.5;"></i>
                    <p>Belum ada pengguna terdaftar</p>
                    <small>Gunakan form di atas untuk menambah pengguna</small>
                </div>
            `;
            return;
        }

        userList.innerHTML = this.db.users.map(user => `
            <div class="user-item">
                <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">
                        <div style="width:45px;height:45px;background:linear-gradient(45deg,${this.getDeptColor(user.departemen)},#667eea);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">
                            ${user.nama.charAt(0)}
                        </div>
                        <div>
                            <strong style="color:#333;font-size:16px;">${user.nama}</strong>
                            <div style="color:#666;font-size:13px;">
                                <i class="fas fa-id-card"></i> ${user.nip}
                            </div>
                        </div>
                    </div>
                    <div style="font-size:12px;color:#888;">
                        <i class="fas fa-envelope"></i> ${user.email} | 
                        <i class="fas fa-building"></i> ${user.departemen}
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn btn-danger btn-sm" onclick="app.deleteUser(${user.id})" title="Hapus pengguna">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getDeptColor(dept) {
        const colors = {
            'IT': '#667eea',
            'HR': '#f093fb',
            'Finance': '#4facfe',
            'Marketing': '#43e97b',
            'default': '#fa709a'
        };
        return colors[dept] || colors.default;
    }

    loadLaporan() {
        const filterDate = document.getElementById('filterDate').value;
        const filterUserId = document.getElementById('filterUser').value;
        
        let filteredAbsensi = [...this.db.absensi].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (filterDate) {
            filteredAbsensi = filteredAbsensi.filter(a => {
                return new Date(a.timestamp).toISOString().split('T')[0] === filterDate;
            });
        }
        
        if (filterUserId) {
            filteredAbsensi = filteredAbsensi.filter(a => parseInt(a.userId) === parseInt(filterUserId));
        }

        const container = document.getElementById('laporanTable');
        
        if (filteredAbsensi.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:60px;color:#999;background:white;border-radius:15px;">
                    <i class="fas fa-file-excel fa-4x" style="margin-bottom:20px;opacity:0.3;"></i>
                    <h3>Belum ada data absensi</h3>
                    <p>Lakukan absen atau ubah filter untuk melihat data</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:20px;background:white;border-radius:15px;box-shadow:0 5px 20px rgba(0,0,0,0.1);">
                <div>
                    <strong style="font-size:20px;color:#333;">📊 Total: <span style="color:#667eea;">${filteredAbsensi.length}</span> absensi</strong>
                    <div style="font-size:12px;color:#666;">
                        ${new Date().toLocaleDateString('id-ID')}
                    </div>
                </div>
                <button id="exportBtnNow" class="btn btn-success" style="font-size:14px;">
                    <i class="fas fa-file-excel"></i> Export Excel
                </button>
            </div>
            <div style="background:white;border-radius:15px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
                <table style="min-width:1000px;">
                    <thead style="background:linear-gradient(135deg,#667eea,#764ba2);">
                        <tr>
                            <th style="width:160px;color:white;padding:20px;">👤 Nama Karyawan</th>
                            <th style="width:110px;color:white;padding:20px;">🆔 NIP</th>
                            <th style="width:90px;color:white;padding:20px;">📋 Tipe</th>
                            <th style="width:200px;color:white;padding:20px;">🕒 Waktu Absen</th>
                            <th style="width:220px;color:white;padding:20px;">📍 Lokasi</th>
                            <th style="width:90px;color:white;padding:20px;">📸 Foto</th>
                            <th style="width:140px;color:white;padding:20px;">🛰️ Koordinat GPS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredAbsensi.map((absen, index) => `
                            <tr style="border-bottom:1px solid #f0f0f0;">
                                <td style="padding:15px;">
                                    <strong style="color:#333;">${absen.nama}</strong><br>
                                    <small style="color:#666;">${absen.departemen}</small>
                                </td>
                                <td style="padding:15px;font-family:monospace;font-weight:bold;color:#667eea;">
                                    ${absen.nip}
                                </td>
                                <td style="padding:15px;">
                                    <span class="badge ${absen.type === 'masuk' ? 'badge-success' : absen.type === 'keluar' ? 'badge-warning' : 'badge-success'}">
                                        ${absen.type.toUpperCase()}
                                    </span>
                                </td>
                                <td style="padding:15px;">
                                    ${new Date(absen.timestamp).toLocaleString('id-ID')}
                                </td>
                                <td style="padding:15px;color:#555;" title="${absen.location}">
                                    ${absen.location.length > 40 ? absen.location.substring(0, 40) + '...' : absen.location}
                                </td>
                                <td style="padding:15px;text-align:center;">
                                    <img src="${absen.photo}" 
                                         width="60" height="60" 
                                         style="border-radius:10px;object-fit:cover;cursor:pointer;border:3px solid #e9ecef;transition:all 0.3s;"
                                         onmouseover="this.style.transform='scale(1.3)';this.style.borderColor='#667eea';"
                                         onmouseout="this.style.transform='scale(1)';this.style.borderColor='#e9ecef';"
                                         onclick="window.open(this.src,'_blank')">
                                </td>
                                <td style="padding:15px;font-family:monospace;font-size:12px;">
                                    <div style="background:#f8f9fa;padding:8px;border-radius:6px;">
                                        <strong>Lat:</strong> ${absen.latitude}<br>
                                        <strong>Lng:</strong> ${absen.longitude}<br>
                                        <small style="color:#999;">${absen.accuracy}m</small>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Re-bind export button
        const exportBtn = document.getElementById('exportBtnNow');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToExcel());
        }
    }

    updateFilterUsers() {
        const filterUser = document.getElementById('filterUser');
        filterUser.innerHTML = '<option value="">👥 Semua Pengguna</option>' + 
            this.db.users.map(user => 
                `<option value="${user.id}">👤 ${user.nama} (${user.nip})</option>`
            ).join('');
    }

    loadInitialData() {
        if (this.db.users.length === 0) {
            const demoUsers = [
                { 
                    id: 1, 
                    nama: 'Budi Santoso', 
                    nip: 'NIP001', 
                    email: 'budi@perusahaan.com', 
                    departemen: 'IT', 
                    createdAt: new Date(Date.now() - 86400000).toISOString() 
                },
                { 
                    id: 2, 
                    nama: 'Sari Dewi', 
                    nip: 'NIP002', 
                    email: 'sari@perusahaan.com', 
                    departemen: 'HR', 
                    createdAt: new Date().toISOString() 
                },
                { 
                    id: 3, 
                    nama: 'Ahmad Fauzi', 
                    nip: 'NIP003', 
                    email: 'ahmad@perusahaan.com', 
                    departemen: 'Finance', 
                    createdAt: new Date().toISOString() 
                },
                { 
                    id: 4, 
                    nama: 'Rina Kartika', 
                    nip: 'NIP004', 
                    email: 'rina@perusahaan.com', 
                    departemen: 'Marketing', 
                    createdAt: new Date().toISOString() 
                }
            ];
            this.db.users = demoUsers;
            this.saveData();
            this.loadUsers();
            this.updateFilterUsers();
            console.log('✅ Data demo dimuat');
        }
    }

    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            this.showError('Library Excel belum siap. Tunggu beberapa detik atau refresh halaman.');
            return;
        }

        const filterDate = document.getElementById('filterDate').value;
        const filterUserId = document.getElementById('filterUser').value;
        
        let data = [...this.db.absensi];
        
        if (filterDate) {
            data = data.filter(a => new Date(a.timestamp).toISOString().split('T')[0] === filterDate);
        }
        if (filterUserId) {
            data = data.filter(a => parseInt(a.userId) === parseInt(filterUserId));
        }

        if (data.length === 0) {
            this.showError('Tidak ada data untuk diexport!');
            return;
        }

        const exportData = data.map(absen => ({
            'No': '',
            'Nama Karyawan': absen.nama,
            'NIP': absen.nip,
            'Departemen': absen.departemen,
            'Tipe Absen': absen.type.toUpperCase(),
            'Tanggal': new Date(absen.timestamp).toLocaleDateString('id-ID'),
            'Waktu': new Date(absen.timestamp).toLocaleTimeString('id-ID'),
            'Latitude': absen.latitude,
            'Longitude': absen.longitude,
            'Akurasi GPS': absen.accuracy + ' meter',
            'Lokasi Lengkap': absen.location
        }));

        // Tambah nomor urut
        exportData.forEach((row, index) => {
            row['No'] = index + 1;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Auto resize columns
        const colWidths = [
            {wch: 5}, {wch: 20}, {wch: 12}, {wch: 15}, 
            {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, 
            {wch: 12}, {wch: 12}, {wch: 40}
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Laporan Absensi');
        
        const filename = `Laporan_Absensi_${new Date().toISOString().split('T')[0]}_${data.length}_data.xlsx`;
        XLSX.writeFile(wb, filename);
        
        this.showSuccess(`✅ Excel berhasil diexport!\n📁 ${filename}\n📊 ${data.length} data`);
    }

    updateDateTime() {
        const now = new Date();
        
        document.getElementById('currentDate').textContent = now.toLocaleString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        document.getElementById('absenTime').textContent = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const hour = now.getHours();
        let title = '';
        let icon = '';
        
        if (hour >= 7 && hour <= 9) {
            title = 'Absen Masuk';
            icon = '⏰';
        } else if (hour >= 16 && hour <= 18) {
            title = 'Absen Keluar';
            icon = '🏠';
        } else {
            title = 'Absen Hadir';
            icon = '📋';
        }
        
        document.getElementById('absenTitle').innerHTML = `${icon} ${title}`;
    }

    getRandomUser() {
        if (this.db.users.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * this.db.users.length);
        return this.db.users[randomIndex];
    }

    deleteUser(userId) {
        const user = this.db.users.find(u => u.id == userId);
        if (!user) return;

        if (confirm(`Hapus pengguna "${user.nama}"?\n\n⚠️ Data absensi terkait TIDAK ikut terhapus`)) {
            this.db.users = this.db.users.filter(u => u.id != userId);
            this.saveData();
            this.loadUsers();
            this.updateFilterUsers();
            this.loadLaporan();
            this.showSuccess(`✅ Pengguna "${user.nama}" dihapus`);
        }
    }

    showAbsenResult(absenData) {
        const preview = document.getElementById('selfiePreview');
        preview.innerHTML = `
            <img src="${absenData.photo}" alt="Selfie Absen" style="width:100%;height:100%;object-fit:cover;">
            <div style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.8);color:white;padding:10px;border-radius:10px;">
                <strong>✅ ${absenData.type.toUpperCase()}</strong><br>
                <small>${absenData.nama}</small>
            </div>
            <div style="position:absolute;bottom:10px;right:10px;background:rgba(40,167,69,0.9);color:white;padding:8px;border-radius:8px;font-weight:bold;">
                GPS Verified
            </div>
        `;
        preview.classList.add('has-image');
        document.getElementById('absenLocation').textContent = absenData.location;
    }

    resetSelfiePreview() {
        const preview = document.getElementById('selfiePreview');
        preview.innerHTML = `
            <i class="fas fa-camera fa-5x" style="color:#667eea;"></i>
            <p style="color:#666;margin-top:15px;font-size:16px;">Klik tombol untuk selfie</p>
        `;
        preview.classList.remove('has-image');
        document.getElementById('absenLocation').textContent = 'Lokasi akan muncul disini';
    }

    shakeAnimation(elementId, type = 'error') {
        const element = document.getElementById(elementId);
        element.style.animation = 'none';
        setTimeout(() => {
            element.style.animation = type === 'success' ? 
                'shake-success 0.5s' : 'shake 0.5s';
        });
    }

    showError(message) {
        // Error toast
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        // Success toast
        this.showToast(message, 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            success: { bg: '#28a745', icon: '✅' },
            error: { bg: '#dc3545', icon: '❌' },
            info: { bg: '#17a2b8', icon: 'ℹ️' }
        };
        const config = colors[type] || colors.info;

        toast.style.cssText = `
            position:fixed;top:20px;right:20px;
            background:${config.bg};
            color:white;padding:20px 25px;border-radius:15px;
            box-shadow:0 10px 40px rgba(0,0,0,0.3);
            z-index:10001;
            max-width:350px;
            font-weight:600;
            transform:translateX(400px);
            transition:all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            backdrop-filter:blur(10px);
        `;
        
        toast.innerHTML = `
            <div style="display:flex;gap:12px;align-items:center;">
                <span style="font-size:20px;">${config.icon}</span>
                <div style="line-height:1.4;">${message}</div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });
        
        // Auto remove
        setTimeout(() => {
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 400);
        }, 5000);
    }

    saveData() {
        try {
            localStorage.setItem('absensiData', JSON.stringify({
                ...this.db,
                settings: {
                    ...this.db.settings,
                    lastBackup: new Date().toISOString()
                }
            }));
        } catch (e) {
            console.error('Save data error:', e);
            this.showError('Gagal menyimpan data! Storage penuh?');
        }
    }

    loadData() {
        try {
            const dataStr = localStorage.getItem('absensiData');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                this.db.users = data.users || [];
                this.db.absensi = data.absensi || [];
                this.db.settings = data.settings || this.db.settings;
                console.log(`✅ Data loaded: ${this.db.users.length} users, ${this.db.absensi.length} absensi`);
            }
        } catch (e) {
            console.error('Load data error:', e);
            this.db.users = [];
            this.db.absensi = [];
        }
    }
}

// Inisialisasi aplikasi
const app = new AbsensiApp();

// Export global untuk onclick events
window.app = app;

// Tambah CSS animation shake
const shakeCSS = document.createElement('style');
shakeCSS.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
    @keyframes shake-success {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(shakeCSS);

console.log('🚀 Sistem Absensi Digital v1.0.0 siap digunakan!');
console.log('Login: admin / admin123');
console.log('Ctrl+E untuk export Excel');
console.log('Escape untuk reset kamera');

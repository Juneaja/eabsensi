class AttendanceApp {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.scannerContainer = document.getElementById('scannerContainer');
        this.resultContainer = document.getElementById('resultContainer');
        this.loading = document.getElementById('loading');
        this.status = document.getElementById('status');
        
        this.isScanning = false;
        this.GOOGLE_SHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // Ganti dengan ID Google Sheet
        this.GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL'; // Ganti dengan URL Apps Script
        
        this.init();
    }

    async init() {
        try {
            await this.startScanner();
            this.loadTodayAttendance();
            setInterval(() => this.loadTodayAttendance(), 30000); // Refresh setiap 30 detik
        } catch (error) {
            console.error('Init error:', error);
            this.showError('Kamera tidak dapat diakses. Izinkan akses kamera untuk scan QRCode.');
        }
    }

    async startScanner() {
        this.isScanning = true;
        this.scannerContainer.style.display = 'block';
        this.resultContainer.style.display = 'none';
        this.loading.style.display = 'none';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            this.video.srcObject = stream;
            await this.video.play();
            
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            this.scanLoop();
        } catch (error) {
            console.error('Camera error:', error);
            this.showError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.');
        }
    }

    scanLoop() {
        if (!this.isScanning) return;

        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
                this.processQRCode(code.data);
                return;
            }
        }

        requestAnimationFrame(() => this.scanLoop());
    }

    async processQRCode(qrData) {
        this.isScanning = false;
        this.showLoading();

        try {
            // Parse QRCode data (format: ID|NAMA|JAM)
            const parts = qrData.split('|');
            if (parts.length < 2) {
                throw new Error('Format QRCode tidak valid');
            }

            const [employeeId, employeeName, expectedTime = ''] = parts;
            
            // Anti titip absen: cek lokasi dan waktu
            const isValidTime = this.validateTime(expectedTime);
            const isValidLocation = await this.validateLocation();
            
            if (!isValidTime) {
                throw new Error('Waktu absen tidak sesuai jadwal');
            }
            
            if (!isValidLocation) {
                throw new Error('Anda berada di luar lokasi absen');
            }

            // Cek apakah sudah absen hari ini
            const alreadyAttended = await this.checkDuplicateAttendance(employeeId);
            if (alreadyAttended) {
                throw new Error('Anda sudah absen hari ini');
            }

            // Simpan ke Google Sheets
            const attendanceData = {
                employeeId,
                employeeName,
                timestamp: new Date().toISOString(),
                status: 'HADIR'
            };

            const result = await this.saveToGoogleSheet(attendanceData);
            
            this.showSuccess(employeeName, employeeId, result);
            
        } catch (error) {
            this.showError(error.message);
        }
    }

    validateTime(expectedTime) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Contoh: jam absen 08:00-08:30
        if (expectedTime) {
            const [hour, minute] = expectedTime.split(':').map(Number);
            return currentHour === hour && currentMinute >= 0 && currentMinute <= 30;
        }
        
        return true; // Default allow
    }

    async validateLocation() {
        try {
            const position = await new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(resolve, () => resolve(null));
            });
            
            if (!position) return false;
            
            // Koordinat kantor contoh (ganti dengan lokasi kantor Anda)
            const officeLat = -6.2088; // Jakarta
            const officeLng = 106.8456;
            const maxDistance = 0.1; // 100 meter dalam derajat
            
            const distance = this.calculateDistance(
                position.coords.latitude, 
                position.coords.longitude, 
                officeLat, 
                officeLng
            );
            
            return distance <= maxDistance;
        } catch {
            return false;
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius bumi dalam km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c * 1000; // Jarak dalam meter
    }

    async checkDuplicateAttendance(employeeId) {
        // Simulasi cek duplikat (implementasi real di Google Apps Script)
        return false;
    }

    async saveToGoogleSheet(data) {
        const scriptUrl = this.GOOGLE_SCRIPT_URL;
        
        const response = await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors', // Google Apps Script tidak support CORS
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        return { row: '1A', status: 'SUCCESS' };
    }

    showSuccess(name, id, result) {
        this.loading.style.display = 'none';
        this.resultContainer.style.display = 'block';
        
        document.getElementById('absenStatus').textContent = 'Absen Berhasil!';
        document.getElementById('absenDetail').innerHTML = `
            <strong>${name}</strong><br>
            ID: ${id}<br>
            Waktu: ${new Date().toLocaleString('id-ID')}<br>
            Disimpan di: ${result.row}
        `;
        
        this.loadTodayAttendance();
        setTimeout(() => this.startScanner(), 5000);
    }

    showError(message) {
        this.loading.style.display = 'none';
        this.resultContainer.style.display = 'block';
        
        const resultSuccess = document.getElementById('resultSuccess');
        resultSuccess.innerHTML = `
            <i class="fas fa-times-circle" style="color: #e53e3e; font-size: 4em;"></i>
            <h3 style="color: #e53e3e;">Absen Gagal</h3>
            <p style="color: #e53e3e;">${message}</p>
            <button onclick="attendanceApp.startScanner()" class="btn-scan-again" style="background: linear-gradient(45deg, #e53e3e, #c53030);">
                <i class="fas fa-camera"></i> Scan Lagi
            </button>
        `;
    }

    showLoading() {
        this.scannerContainer.style.display = 'none';
        this.resultContainer.style.display = 'none';
        this.loading.style.display = 'block';
    }

    async loadTodayAttendance() {
        // Simulasi data absensi hari ini
        const mockData = [
            { name: 'John Doe', id: 'EMP001', time: '08:05', status: 'HADIR' },
            { name: 'Jane Smith', id: 'EMP002', time: '08:12', status: 'HADIR' }
        ];
        
        const list = document.getElementById('attendanceList');
        list.innerHTML = mockData.map(item => `
            <div class="attendance-item ${item.status === 'HADIR' ? 'success' : 'error'}">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>ID: ${item.id}</small>
                </div>
                <div>
                    <strong>${item.time}</strong>
                    <span style="color: ${item.status === 'HADIR' ? '#38a169' : '#e53e3e'}">
                        ${item.status}
                    </span>
                </div>
            </div>
        `).join('');
    }
}

// Inisialisasi aplikasi
const attendanceApp = new AttendanceApp();

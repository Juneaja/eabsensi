function doPost(e) {
  try {
    const sheetId = 'YOUR_GOOGLE_SHEET_ID'; // Ganti dengan ID Google Sheet
    const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    
    const data = JSON.parse(e.postData.contents);
    
    // Header jika belum ada
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 6).setValues([['ID Karyawan', 'Nama', 'Waktu Absen', 'Status', 'Lokasi', 'Timestamp']]);
    }
    
    // Validasi duplikat hari ini
    const today = new Date().toDateString();
    const existingData = sheet.getDataRange().getValues();
    const todayAttendance = existingData.filter(row => 
      new Date(row[5]).toDateString() === today && row[0] === data.employeeId
    );
    
    if (todayAttendance.length > 0) {
      return ContentService.createTextOutput('DUPLICATE');
    }
    
    // Simpan data
    const rowData = [
      data.employeeId,
      data.employeeName,
      new Date(data.timestamp).toLocaleString('id-ID'),
      data.status,
      'Verified', // Bisa ditambahkan data lokasi
      data.timestamp
    ];
    
    sheet.appendRow(rowData);
    
    return ContentService.createTextOutput('SUCCESS');
  } catch (error) {
    return ContentService.createTextOutput('ERROR: ' + error.toString());
  }
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openById('1CHyt34PlELUdx2rV_XwkCrc7ut1JVWCNRMPe9dgQeK0').getSheetByName('Sheet1');
    const data = JSON.parse(e.postData.contents);
    
    // แยกชื่อภาษาไทย
    const nameParts = (data.fullName || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // แยกชื่อภาษาอังกฤษ
    let englishFirstName = '';
    let englishLastName = '';
    if (data.fullNameEn && data.fullNameEn !== '-') {
      const enParts = data.fullNameEn.split(' ');
      englishFirstName = enParts[0] || '';
      englishLastName = enParts.slice(1).join(' ') || '';
    }
    
    // คำนวณอายุ
    let age = '';
    if (data.dateOfBirth && data.dateOfBirth !== '-') {
      const parts = data.dateOfBirth.split('/');
      if (parts.length === 3) {
        const birthYear = parseInt(parts[2]);
        const currentYear = new Date().getFullYear();
        age = currentYear - birthYear;
      }
    }
    
    // กำหนดข้อมูลตามประเภทเอกสาร
    let idCardName = '';
    let idNumber = '';
    let passportNumber = '';
    
    if (data.type && (data.type.includes('บัตรประชาชน') || data.type.includes('ID'))) {
      idCardName = data.fullName || '';
      idNumber = data.documentNumber || '';
    } else if (data.type && data.type.includes('Passport')) {
      passportNumber = data.documentNumber || '';
    }
    
    // วันที่และเวลาปัจจุบัน (ไทย)
    const now = new Date();
    const thaiDate = now.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const thaiTime = now.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // เพิ่มข้อมูลลงใน sheet - เริ่มจาก Column A
    // A ปล่อยว่าง, B เป็นต้นไป
    sheet.appendRow([
      '',                                  // A: รหัสใบกำกับ - ปล่อยว่าง
      thaiDate,                           // B: วันที่บันทึก
      thaiTime,                           // C: เวลา
      data.fullName || '',                // D: ชื่อ-สกุล
      firstName,                          // E: ชื่อ
      lastName,                           // F: สกุล
      age,                                // G: อายุ
      data.dateOfBirth || '',             // H: วันเดือนปีเกิด
      data.expiryDate || '',              // I: วันหมดอายุบัตร
      idCardName,                         // J: ชื่อบัตรประชาชน
      idNumber,                           // K: เลขบัตรประชาชน
      passportNumber,                     // L: เลขพาสปอร์ต
      thaiDate,                           // M: วันลงทะเบียน
      data.nationality || data.address || '', // N: สัญชาติ/ประเทศ
      englishFirstName,                   // O: Name (English)
      englishLastName                     // P: Lastname (English)
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'บันทึกข้อมูลเรียบร้อย'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

import React, { useState, useRef } from 'react';
import { Camera, Upload, Check, X, Settings, Key, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export default function GeminiDocScanner() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [step, setStep] = useState('setup'); // setup, capture, processing, review, saved
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [guestData, setGuestData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Load API key from localStorage
  React.useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setStep('capture');
    }
  }, []);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setStep('capture');
      setError(null);
    } else {
      setError('กรุณาใส่ API Key');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 4MB for Gemini)
      if (file.size > 4 * 1024 * 1024) {
        setError('ไฟล์ใหญ่เกิน 4MB กรุณาเลือกไฟล์ใหม่');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        // Extract base64 data without the data:image/... prefix
        const base64Data = reader.result.split(',')[1];
        setImageBase64(base64Data);
        processDocument(base64Data, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const processDocument = async (base64Image, mimeType) => {
    setIsProcessing(true);
    setStep('processing');
    setError(null);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { 
                  text: `อ่านข้อมูลจากเอกสารในรูปภาพนี้ และส่งคืนเป็น JSON format ดังนี้:

{
  "type": "ประเภทเอกสาร (เช่น Passport, บัตรประชาชนไทย, ใบขับขี่ไทย, ใบขับขี่ต่างประเทศ)",
  "fullName": "ชื่อ-นามสกุลเต็ม",
  "documentNumber": "เลขที่เอกสาร",
  "nationality": "สัญชาติ",
  "dateOfBirth": "วันเกิด (DD/MM/YYYY)",
  "expiryDate": "วันหมดอายุ (DD/MM/YYYY) หรือ - ถ้าไม่มี",
  "address": "ที่อยู่ หรือ - ถ้าไม่มี"
}

หมายเหตุ:
- ถ้าเป็น Passport ให้อ่านจาก MRZ (Machine Readable Zone) ด้วย
- ถ้าข้อมูลใดไม่มีให้ใส่ "-"
- ตอบกลับเฉพาะ JSON เท่านั้น ไม่ต้องมีคำอธิบายเพิ่มเติม
- ถ้าอ่านไม่ออกให้ระบุว่า "ไม่สามารถอ่านได้"`
                },
                { 
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              topK: 32,
              topP: 1,
              maxOutputTokens: 2048,
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API Error');
      }

      const data = await response.json();
      
      // Extract the response text
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Try to parse JSON from the response
      let jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('ไม่สามารถอ่านข้อมูลจากเอกสารได้ กรุณาลองใหม่');
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      
      // Validate data
      if (parsedData.fullName === 'ไม่สามารถอ่านได้' || !parsedData.fullName) {
        throw new Error('ไม่สามารถอ่านข้อมูลจากเอกสารได้ กรุณาถ่ายรูปใหม่ให้ชัดเจนขึ้น');
      }

      setGuestData(parsedData);
      setIsProcessing(false);
      setStep('review');

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setIsProcessing(false);
      setStep('capture');
      setImagePreview(null);
      setImageBase64(null);
    }
  };

  const handleDataChange = (field, value) => {
    setGuestData({ ...guestData, [field]: value });
  };

  const handleSave = () => {
    setStep('saved');
    // Here you would send data to Google Sheets
    console.log('Saving to Google Sheets:', guestData);
    setTimeout(() => {
      resetForm();
    }, 3000);
  };

  const resetForm = () => {
    setStep('capture');
    setImagePreview(null);
    setImageBase64(null);
    setGuestData(null);
    setIsProcessing(false);
    setError(null);
  };

  const clearApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setStep('setup');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '"Kanit", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      padding: '20px',
      paddingBottom: '40px'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em'
          }}>
            N11 Hotel
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#64748b',
            margin: 0,
            fontWeight: '500'
          }}>
            ระบบบันทึกข้อมูลแขก — Gemini AI
          </p>
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#065f46',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            marginTop: '12px',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
          }}>
            ✨ ฟรี 100% — Powered by Google Gemini
          </div>
        </div>

        {step !== 'setup' && (
          <button
            onClick={clearApiKey}
            style={{
              marginTop: '12px',
              background: '#f1f5f9',
              color: '#64748b',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              margin: '12px auto 0',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
            }}
          >
            <Settings size={16} />
            เปลี่ยน API Key
          </button>
        )}
      </div>

      {/* Main Content */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '28px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        {/* Step 0: API Key Setup */}
        {step === 'setup' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
              }}>
                <Key size={40} color="#fff" />
              </div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                margin: '0 0 8px 0',
                color: '#1e293b'
              }}>
                ตั้งค่า API Key
              </h2>
              <p style={{
                fontSize: '15px',
                color: '#64748b',
                margin: 0,
                lineHeight: '1.6'
              }}>
                ใช้งานฟรี 100% ด้วย Google Gemini API
              </p>
            </div>

            {/* API Key Input */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Gemini API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  style={{
                    width: '100%',
                    padding: '14px 50px 14px 16px',
                    fontSize: '16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontFamily: 'monospace',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px'
                  }}
                >
                  {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '12px 16px',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '12px',
                color: '#991b1b',
                fontSize: '14px',
                marginBottom: '16px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button
              onClick={saveApiKey}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                padding: '18px 32px',
                fontSize: '18px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.3s ease',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
              }}
            >
              บันทึกและเริ่มใช้งาน
            </button>

            {/* Instructions */}
            <div style={{
              marginTop: '24px',
              padding: '20px',
              background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
              borderRadius: '12px',
              border: '2px solid #bfdbfe'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '700',
                margin: '0 0 12px 0',
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Key size={18} />
                วิธีรับ API Key ฟรี:
              </h3>
              <ol style={{
                fontSize: '14px',
                color: '#1e3a8a',
                margin: 0,
                paddingLeft: '20px',
                lineHeight: '1.8'
              }}>
                <li>เปิด <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: '600' }}>Google AI Studio</a></li>
                <li>Login ด้วย Google Account</li>
                <li>กด "Create API Key"</li>
                <li>Copy API Key มาวางด้านบน</li>
              </ol>
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.7)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#1e40af',
                fontWeight: '600'
              }}>
                💰 ฟรี: 1,500 requests/วัน (เพียงพอมาก!)
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Capture */}
        {step === 'capture' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
              }}>
                <Camera size={40} color="#fff" />
              </div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                margin: '0 0 8px 0',
                color: '#1e293b'
              }}>
                ถ่ายรูปเอกสาร
              </h2>
              <p style={{
                fontSize: '15px',
                color: '#64748b',
                margin: 0,
                lineHeight: '1.6'
              }}>
                รองรับ: Passport, บัตรประชาชน, ใบขับขี่<br />
                ThaID, เอกสารต่างประเทศ
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '18px 32px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)';
                }}
              >
                <Camera size={24} />
                เปิดกล้องถ่ายรูป
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: '#fff',
                  color: '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '16px',
                  padding: '18px 32px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5fe';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Upload size={24} />
                อัปโหลดรูปจากเครื่อง
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '12px',
                color: '#991b1b',
                fontSize: '14px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
              borderRadius: '12px',
              border: '2px solid #c7d2fe'
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <AlertCircle size={20} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{
                    fontSize: '14px',
                    color: '#4338ca',
                    margin: '0 0 8px 0',
                    fontWeight: '600'
                  }}>
                    💡 Tips สำหรับถ่ายรูปที่ดี:
                  </p>
                  <ul style={{
                    fontSize: '13px',
                    color: '#5b21b6',
                    margin: 0,
                    paddingLeft: '20px',
                    lineHeight: '1.6'
                  }}>
                    <li>ให้แสงสว่างเพียงพอ ไม่มีเงา</li>
                    <li>ถ่ายตรง ไม่เอียง</li>
                    <li>หลีกเลี่ยงแสงสะท้อน</li>
                    <li>ตัวอักษรชัดเจน อ่านง่าย</li>
                    <li>ไฟล์ไม่เกิน 4MB</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            {imagePreview && (
              <div style={{
                marginBottom: '32px',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
              }}>
                <img
                  src={imagePreview}
                  alt="Document preview"
                  style={{
                    width: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                    background: '#f8fafc'
                  }}
                />
              </div>
            )}

            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              position: 'relative'
            }}>
              <Loader2 
                size={80} 
                color="#10b981" 
                style={{
                  animation: 'spin 1s linear infinite'
                }}
              />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>

            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              margin: '0 0 12px 0',
              color: '#1e293b'
            }}>
              Gemini กำลังอ่านข้อมูล...
            </h2>
            <p style={{
              fontSize: '15px',
              color: '#64748b',
              margin: 0,
              lineHeight: '1.6'
            }}>
              AI กำลังวิเคราะห์เอกสาร<br />
              กรุณารอสักครู่...
            </p>
          </div>
        )}

        {/* Step 3: Review & Edit */}
        {step === 'review' && guestData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                marginBottom: '16px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                <Check size={20} />
                อ่านข้อมูลสำเร็จ
              </div>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                margin: '0 0 8px 0',
                color: '#1e293b'
              }}>
                ตรวจสอบและแก้ไขข้อมูล
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                ประเภท: <strong>{guestData.type}</strong>
              </p>
            </div>

            {imagePreview && (
              <div style={{
                marginBottom: '24px',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                maxHeight: '200px'
              }}>
                <img
                  src={imagePreview}
                  alt="Document preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    background: '#f8fafc'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(guestData).map(([key, value]) => {
                if (key === 'type') return null;
                const labels = {
                  fullName: 'ชื่อ-นามสกุล',
                  documentNumber: 'เลขที่เอกสาร',
                  nationality: 'สัญชาติ',
                  dateOfBirth: 'วันเกิด',
                  expiryDate: 'วันหมดอายุ',
                  address: 'ที่อยู่'
                };
                return (
                  <div key={key}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#475569',
                      marginBottom: '8px'
                    }}>
                      {labels[key]}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleDataChange(key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: '16px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s ease',
                        background: '#fff',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              flexDirection: 'column'
            }}>
              <button
                onClick={handleSave}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '18px 32px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
                }}
              >
                <Check size={24} />
                บันทึกลง Google Sheets
              </button>

              <button
                onClick={resetForm}
                style={{
                  background: '#fff',
                  color: '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '18px 32px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <X size={24} />
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Saved */}
        {step === 'saved' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: '100px',
              height: '100px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
              animation: 'scaleIn 0.5s ease'
            }}>
              <Check size={50} color="#fff" strokeWidth={3} />
            </div>
            <style>{`
              @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
              }
            `}</style>
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
              margin: '0 0 12px 0',
              color: '#1e293b'
            }}>
              บันทึกสำเร็จ!
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#64748b',
              margin: 0,
              lineHeight: '1.6'
            }}>
              ข้อมูลถูกบันทึกลง Google Sheets เรียบร้อยแล้ว<br />
              <span style={{ fontSize: '14px', color: '#94a3b8' }}>
                กำลังกลับสู่หน้าหลัก...
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      {step !== 'setup' && (
        <div style={{
          marginTop: '24px',
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '16px',
          maxWidth: '600px',
          margin: '24px auto 0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '700',
            margin: '0 0 12px 0',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Check size={20} color="#10b981" />
            ใช้งานจริง — Powered by Gemini
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            margin: 0,
            lineHeight: '1.6'
          }}>
            ✅ ใช้ <strong>Google Gemini API จริง</strong> — อ่านข้อมูลได้จริง<br />
            ✅ <strong>ฟรี 100%</strong> — 1,500 requests/วัน<br />
            ✅ รองรับเอกสารทุกประเภท<br />
            ⚠️ ยังไม่ได้เชื่อมต่อ Google Sheets (ใช้ Console log)<br />
            <br />
            <span style={{ color: '#10b981', fontWeight: '600' }}>
              💰 ค่าใช้จ่าย: 0 บาท/เดือน (ฟรีตลอด!)
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

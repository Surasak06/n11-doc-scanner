import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Check, X, Settings, Key, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export default function N11DocumentScanner() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [sheetsWebhook, setSheetsWebhook] = useState('');
  const [step, setStep] = useState('setup');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [guestData, setGuestData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  // ⭐ แยก ref ออกเป็น 2 ตัว - แก้ปัญหามือถือ
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('groq_api_key');
    const savedWebhook = localStorage.getItem('sheets_webhook');
    if (savedKey) {
      setApiKey(savedKey);
      if (savedWebhook) {
        setSheetsWebhook(savedWebhook);
        setStep('capture');
      }
    }
  }, []);

  const saveApiKey = () => {
    if (apiKey.trim() && sheetsWebhook.trim()) {
      localStorage.setItem('groq_api_key', apiKey.trim());
      localStorage.setItem('sheets_webhook', sheetsWebhook.trim());
      setStep('capture');
      setError(null);
    } else {
      setError('กรุณาใส่ API Key และ Google Sheets Webhook URL');
    }
  };

  const handleFileSelect = (e, source) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setError('ไฟล์ใหญ่เกิน 4MB กรุณาเลือกไฟล์ใหม่');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
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
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `อ่านข้อมูลจากเอกสารในรูปภาพนี้ และส่งคืนเป็น JSON format ดังนี้:

{
  "type": "ประเภทเอกสาร (Passport, บัตรประชาชนไทย, ใบขับขี่ไทย, Driver License)",
  "fullName": "ชื่อ-นามสกุลเต็ม (ภาษาไทย)",
  "fullNameEn": "ชื่อ-นามสกุลภาษาอังกฤษ (ถ้ามี)",
  "documentNumber": "เลขที่เอกสาร",
  "nationality": "สัญชาติ",
  "dateOfBirth": "วันเกิด (DD/MM/YYYY)",
  "expiryDate": "วันหมดอายุ (DD/MM/YYYY) หรือ - ถ้าไม่มี",
  "address": "ที่อยู่ตามกฎด้านล่าง"
}

**กฎสำหรับ address:**
- ถ้าเป็น Passport → ใส่เฉพาะ **ชื่อประเทศ** (เช่น Thailand, Malaysia, China)
- ถ้าเป็นบัตรประชาชนไทย → ใส่ที่อยู่เต็ม
- ถ้าเป็นใบขับขี่ → ใส่ที่อยู่เต็ม
- ถ้าไม่มี → ใส่ "-"

**หมายเหตุ:**
- ถ้าเป็น Passport ให้อ่านจาก MRZ (Machine Readable Zone) ด้วย
- fullNameEn ให้อ่านจากชื่อภาษาอังกฤษในเอกสาร (Passport มีแน่นอน)
- ถ้าข้อมูลใดไม่มีให้ใส่ "-"
- ตอบกลับเฉพาะ JSON เท่านั้น ไม่ต้องมีคำอธิบายเพิ่มเติม
- ถ้าอ่านไม่ออกให้ระบุว่า "ไม่สามารถอ่านได้"`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${base64Image}`
                    }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 2048
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API Error');
      }

      const data = await response.json();
      const resultText = data.choices?.[0]?.message?.content || '';
      
      let jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('ไม่สามารถอ่านข้อมูลจากเอกสารได้ กรุณาลองใหม่');
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      
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

  const handleSave = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(sheetsWebhook, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(guestData)
      });

      // no-cors mode ไม่สามารถอ่าน response ได้ ถือว่าสำเร็จ
      setStep('saved');
      setTimeout(() => {
        resetForm();
      }, 3000);

    } catch (err) {
      console.error('Save error:', err);
      setError('ไม่สามารถบันทึกข้อมูลได้: ' + err.message);
      setIsProcessing(false);
    }
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
    localStorage.removeItem('groq_api_key');
    localStorage.removeItem('sheets_webhook');
    setApiKey('');
    setSheetsWebhook('');
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
        textAlign: 'center',
        color: '#fff',
        marginBottom: '24px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '800',
          margin: '0 0 8px 0',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          📸 ระบบสแกนเอกสาร N11 Hotel
        </h1>
        <p style={{
          fontSize: '14px',
          margin: 0,
          opacity: 0.9
        }}>
          ✨ ฟรี 100% — Powered by Groq (Llama Vision)
        </p>

        {step !== 'setup' && (
          <button
            onClick={clearApiKey}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              fontSize: '13px',
              color: '#64748b',
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
                ใช้งานฟรี 100% ด้วย Groq API
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
                Groq API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="gsk_..."
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
                    color: '#94a3b8',
                    padding: '4px'
                  }}
                >
                  {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Google Sheets Webhook URL */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Google Sheets Webhook URL
              </label>
              <input
                type="text"
                value={sheetsWebhook}
                onChange={(e) => setSheetsWebhook(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '13px',
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
            </div>

            {error && (
              <div style={{
                marginBottom: '20px',
                padding: '12px 16px',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '12px',
                color: '#991b1b',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
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
                <li>เปิด <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: '600' }}>console.groq.com</a></li>
                <li>กด Sign Up (ใช้ Google/GitHub)</li>
                <li>ไปที่ "API Keys" ในเมนูซ้าย</li>
                <li>กด "Create API Key"</li>
                <li>Copy API Key (gsk_...) มาวางด้านบน</li>
              </ol>
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
                รองรับ: Passport, บัตรประชาชน, ใบขับขี่
              </p>
            </div>

            {/* ⭐ Hidden File Inputs - แยกเป็น 2 ตัว */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileSelect(e, 'camera')}
              style={{ display: 'none' }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, 'upload')}
              style={{ display: 'none' }}
            />

            {error && (
              <div style={{
                marginBottom: '20px',
                padding: '12px 16px',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '12px',
                color: '#991b1b',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* ⭐ ปุ่มกล้อง - ใช้ cameraInputRef */}
              <button
                onClick={() => cameraInputRef.current?.click()}
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

              {/* ⭐ ปุ่มอัปโหลด - ใช้ fileInputRef */}
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

            {/* Tips */}
            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '2px solid #e2e8f0'
            }}>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#64748b',
                lineHeight: '1.6'
              }}>
                💡 <strong>Tips:</strong> ถ่ายให้ชัดเจน ไม่มืด ไม่เบลอ เอกสารอยู่ตรงกลาง
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Loader2 size={64} color="#667eea" style={{ 
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px'
            }} />
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              margin: '0 0 12px 0',
              color: '#1e293b'
            }}>
              กำลังอ่านเอกสาร...
            </h2>
            <p style={{
              fontSize: '15px',
              color: '#64748b',
              margin: 0
            }}>
              ใช้เวลาประมาณ 3-5 วินาที
            </p>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}} />
          </div>
        )}

        {/* Step 3: Review Data */}
        {step === 'review' && guestData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)'
              }}>
                <Check size={40} color="#fff" />
              </div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                margin: '0 0 8px 0',
                color: '#1e293b'
              }}>
                ตรวจสอบข้อมูล
              </h2>
              <p style={{
                fontSize: '15px',
                color: '#64748b',
                margin: 0
              }}>
                กรุณาตรวจสอบความถูกต้อง
              </p>
            </div>

            {/* Image Preview */}
            {imagePreview && (
              <div style={{
                marginBottom: '24px',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                <img 
                  src={imagePreview} 
                  alt="Document" 
                  style={{
                    width: '100%',
                    display: 'block'
                  }}
                />
              </div>
            )}

            {/* Data Fields */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <DataField
                label="ประเภทเอกสาร"
                value={guestData.type}
                onChange={(v) => handleDataChange('type', v)}
              />
              <DataField
                label="ชื่อ-นามสกุล (ไทย)"
                value={guestData.fullName}
                onChange={(v) => handleDataChange('fullName', v)}
              />
              {guestData.fullNameEn && guestData.fullNameEn !== '-' && (
                <DataField
                  label="ชื่อ-นามสกุล (อังกฤษ)"
                  value={guestData.fullNameEn}
                  onChange={(v) => handleDataChange('fullNameEn', v)}
                />
              )}
              <DataField
                label="เลขที่เอกสาร"
                value={guestData.documentNumber}
                onChange={(v) => handleDataChange('documentNumber', v)}
              />
              <DataField
                label="สัญชาติ"
                value={guestData.nationality}
                onChange={(v) => handleDataChange('nationality', v)}
              />
              <DataField
                label="วันเกิด"
                value={guestData.dateOfBirth}
                onChange={(v) => handleDataChange('dateOfBirth', v)}
              />
              <DataField
                label="วันหมดอายุ"
                value={guestData.expiryDate}
                onChange={(v) => handleDataChange('expiryDate', v)}
              />
              <DataField
                label={guestData.type?.includes('Passport') ? 'ประเทศ' : 'ที่อยู่'}
                value={guestData.address}
                onChange={(v) => handleDataChange('address', v)}
                multiline
              />
            </div>

            {error && (
              <div style={{
                marginBottom: '20px',
                padding: '12px 16px',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '12px',
                color: '#991b1b',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={resetForm}
                disabled={isProcessing}
                style={{
                  flex: '1',
                  background: '#fff',
                  color: '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '16px 24px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: isProcessing ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  if (!isProcessing) e.currentTarget.style.background = '#fff';
                }}
              >
                <X size={20} />
                ยกเลิก
              </button>

              <button
                onClick={handleSave}
                disabled={isProcessing}
                style={{
                  flex: '2',
                  background: isProcessing 
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '16px 24px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isProcessing ? 'none' : '0 4px 16px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
                  }
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    บันทึกข้อมูล
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'saved' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '100px',
              height: '100px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)'
            }}>
              <Check size={60} color="#fff" strokeWidth={3} />
            </div>
            <h2 style={{
              fontSize: '28px',
              fontWeight: '800',
              margin: '0 0 12px 0',
              color: '#10b981'
            }}>
              บันทึกสำเร็จ!
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#64748b',
              margin: 0
            }}>
              ข้อมูลถูกบันทึกใน Google Sheets แล้ว
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Data Field Component
function DataField({ label, value, onChange, multiline }) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: '600',
        color: '#475569',
        marginBottom: '6px'
      }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: '15px',
            border: '2px solid #e2e8f0',
            borderRadius: '10px',
            fontFamily: 'inherit',
            resize: 'vertical',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#667eea';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: '15px',
            border: '2px solid #e2e8f0',
            borderRadius: '10px',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#667eea';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      )}
    </div>
  );
}

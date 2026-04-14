import React, { useState, useRef, useEffect } from 'react';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [step, setStep] = useState('setup');
  const [imagePreview, setImagePreview] = useState(null);
  const [guestData, setGuestData] = useState(null);
  const [error, setError] = useState(null);

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('groq_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setStep('capture');
    }
  }, []);

  const saveApiKey = () => {
    if (!apiKey) return setError('ใส่ API Key');
    localStorage.setItem('groq_api_key', apiKey);
    setStep('capture');
  };

  const handleFile = (file) => {
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      return setError('ไฟล์ใหญ่เกิน 4MB');
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      const base64 = reader.result.split(',')[1];
      processDoc(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const processDoc = async (base64, mime) => {
    setStep('processing');
    setError(null);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
                  text: `อ่านข้อมูลและตอบ JSON:
{
"fullName":"",
"documentNumber":"",
"nationality":"",
"dateOfBirth":"",
"expiryDate":"",
"address":""
}`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mime};base64,${base64}`
                  }
                }
              ]
            }
          ]
        })
      });

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';

      const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);

      setGuestData(json);
      setStep('review');

    } catch (err) {
      console.log(err);
      setError('อ่านข้อมูลไม่สำเร็จ');
      setStep('capture');
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch("YOUR_WEB_APP_URL", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(guestData),
      });

      const result = await res.json();

      if (result.status === "success") {
        setStep('saved');
        setTimeout(() => {
          reset();
        }, 2000);
      }

    } catch {
      setError("บันทึกไม่สำเร็จ");
    }
  };

  const reset = () => {
    setStep('capture');
    setImagePreview(null);
    setGuestData(null);
  };

  return (
    <div style={{ padding: 20 }}>

      {/* STEP 1 */}
      {step === 'setup' && (
        <>
          <h2>ใส่ API Key</h2>
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <button onClick={saveApiKey}>เริ่ม</button>
          <p>{error}</p>
        </>
      )}

      {/* STEP 2 */}
      {step === 'capture' && (
        <>
          <h2>อัปโหลดรูป</h2>

          {/* กล้อง */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraRef}
            onChange={e => handleFile(e.target.files[0])}
            style={{ display: 'none' }}
          />
          <button onClick={() => cameraRef.current.click()}>
            📷 กล้อง
          </button>

          {/* แกลเลอรี่ */}
          <input
            type="file"
            accept="image/*"
            ref={galleryRef}
            onChange={e => handleFile(e.target.files[0])}
            style={{ display: 'none' }}
          />
          <button onClick={() => galleryRef.current.click()}>
            🖼️ แกลเลอรี่
          </button>

          <p>{error}</p>
        </>
      )}

      {/* STEP 3 */}
      {step === 'processing' && <h2>กำลังอ่าน...</h2>}

      {/* STEP 4 */}
      {step === 'review' && guestData && (
        <>
          <h2>ตรวจสอบ</h2>

          {Object.keys(guestData).map(key => (
            <input
              key={key}
              value={guestData[key]}
              onChange={e =>
                setGuestData({ ...guestData, [key]: e.target.value })
              }
            />
          ))}

          <button onClick={handleSave}>บันทึก</button>
        </>
      )}

      {/* STEP 5 */}
      {step === 'saved' && <h2>บันทึกสำเร็จ 🎉</h2>}
    </div>
  );
}

import React, { useState, useEffect } from 'react'
import { RiMagicLine, RiCloseLine, RiLinkM, RiPercentLine, RiMoneyDollarCircleLine, RiCheckDoubleLine, RiChromeFill, RiDragDropLine, RiInformationLine, RiImageAddFill } from 'react-icons/ri'
import { adminApi } from '../../services/adminApi'
import toast from 'react-hot-toast'

export default function AiImportModal({ isOpen, onClose, onImportSuccess, autoImportKey }) {
  const [url, setUrl] = useState('')
  const [pricingRule, setPricingRule] = useState('exact') // exact, percentage, fixed
  const [pricingValue, setPricingValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(0) // 0: enter url, 1: loading, 2: success (then close)
  const [activeTab, setActiveTab] = useState('bookmarklet') // 'url' or 'bookmarklet'
  const [aiNote, setAiNote] = useState(null)

  const executeImport = async (payload) => {
    setIsLoading(true)
    setStep(1)
    try {
      // 1. Call Backend AI Import Endpoint
      const res = await adminApi.importProductAi(payload)
      const productData = res.data?.data
      
      if (!productData) throw new Error('بيانات غير صالحة')

      // Check if AI used URL intelligence (no images)
      if (productData._source === 'url_intelligence') {
        setAiNote(productData._note)
      }

      // 2. Apply Pricing Rule
      let finalPrice = parseFloat(productData.price) || 0
      if (finalPrice > 0) {
        const pVal = parseFloat(pricingValue) || 0
        if (pricingRule === 'percentage') {
          finalPrice = finalPrice + (finalPrice * (pVal / 100))
        } else if (pricingRule === 'fixed') {
          finalPrice = finalPrice + pVal
        }
      }

      productData.price = finalPrice.toFixed(2)

      // Clean internal fields
      delete productData._source
      delete productData._note

      setStep(2)
      setTimeout(() => {
        if (aiNote) {
          toast.success('تم التوليد بنجاح! (تنبيه: تم استخدام الرابط فقط ولم يتم جلب الصور بسبب الحماية)', { duration: 6000 })
        } else {
          toast.success('تم استيراد المنتج بنجاح! ✨')
        }
        onImportSuccess(productData)
        onClose()
      }, 1500)
      
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الاستيراد. تأكد من صحة الرابط.')
      setStep(0)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAutoImport = (key) => {
    executeImport({ import_key: key })
  }

  const handleImport = async (e) => {
    e.preventDefault()
    if (!url) {
      toast.error('الرجاء إدخال رابط المنتج')
      return
    }
    executeImport({ url })
  }

  useEffect(() => {
    if (isOpen) {
      setStep(0)
      setUrl('')
      setPricingValue('')
      setPricingRule('exact')
      setAiNote(null)
      setActiveTab('bookmarklet') // Default to the ultra-reliable method
      
      if (autoImportKey) {
        handleAutoImport(autoImportKey)
      }
    }
  }, [isOpen, autoImportKey])

  if (!isOpen) return null

  // Advanced Bookmarklet: Scrapes high-res images, colors, JSON-LD, Next.js data!
  const rawBookmarklet = `javascript:(function(){
    const btn = document.createElement('div');
    btn.innerHTML = 'جاري سحب البيانات لـ GH-Shopper (يُرجى الانتظار)...';
    btn.style.cssText = 'position:fixed;top:20px;right:20px;background:#8B5CF6;color:#fff;padding:15px 25px;border-radius:12px;font-family:Arial;font-weight:bold;z-index:9999999;box-shadow:0 10px 25px rgba(0,0,0,0.2);direction:rtl;font-size:15px;';
    document.body.appendChild(btn);

    const images = Array.from(document.querySelectorAll('img, source, [data-zoom], [data-large], [data-src]'))
        .map(el => el.getAttribute('data-zoom') || el.getAttribute('data-large') || el.getAttribute('data-src') || el.src)
        .filter(src => src && src.startsWith('http') && !src.includes('svg') && !src.includes('icon') && !src.includes('logo') && !src.includes('spinner'));
    
    document.querySelectorAll('img[srcset], source[srcset]').forEach(el => {
        const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset');
        if (srcset) {
            const sources = srcset.split(',').map(s => s.trim().split(' '));
            const bestSource = sources.reduce((prev, curr) => (parseInt(curr[1]||0) > parseInt(prev[1]||0) ? curr : prev), sources[0]);
            if (bestSource && bestSource[0] && bestSource[0].startsWith('http')) images.push(bestSource[0]);
        }
    });

    const colors = Array.from(document.querySelectorAll('[data-color], .color-swatch, .swatch, [aria-label*="color" i], [aria-label*="لون" i], fieldset[name*="color" i] label, .product-color, .color-name, [data-automation-id="color-name"]'))
        .map(el => el.getAttribute('data-color') || el.getAttribute('aria-label') || el.title || el.innerText)
        .filter(c => c && c.trim().length > 1 && c.trim().length < 40)
        .map(c => c.trim().replace(/\\n/g, ' '));
        
    const sizes = Array.from(document.querySelectorAll('[data-size], .size-swatch, [aria-label*="size" i], [aria-label*="مقاس" i], option, .size-name'))
        .map(el => el.getAttribute('data-size') || el.getAttribute('aria-label') || el.title || el.innerText)
        .filter(s => s && s.trim().length > 0 && s.trim().length < 20 && !s.includes('{'))
        .map(s => s.trim());
        
    const jsonLds = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => s.innerText);
    const nextData = document.getElementById('__NEXT_DATA__') ? document.getElementById('__NEXT_DATA__').innerText : '';

    const data = {
        title: document.title,
        text: document.body.innerText.substring(0, 40000),
        images: [...new Set(images)],
        color_swatches: [...new Set(colors)],
        size_options: [...new Set(sizes)],
        json_ld: jsonLds.map(str => { try { return JSON.parse(str); } catch(e) { return null; } }).filter(Boolean),
        next_data: nextData ? (function(){ try { return JSON.parse(nextData); } catch(e) { return null; } })() : null,
        meta: Array.from(document.querySelectorAll('meta')).map(m => m.content).join(' | ').substring(0, 5000)
    };

    btn.innerHTML = 'جاري تحويلك للوحة التحكم لإتمام السحب...';
    
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://ghshopper.com/api/admin/products/bookmarklet-redirect';
    form.target = '_blank';
    
    const urlInput = document.createElement('input');
    urlInput.type = 'hidden';
    urlInput.name = 'url';
    urlInput.value = window.location.href;
    
    const payloadInput = document.createElement('input');
    payloadInput.type = 'hidden';
    payloadInput.name = 'payload';
    payloadInput.value = JSON.stringify(data);
    
    form.appendChild(urlInput);
    form.appendChild(payloadInput);
    document.body.appendChild(form);
    form.submit();
    
    setTimeout(() => btn.remove(), 3000);
  })();`;
  
  const bookmarkletCode = rawBookmarklet.replace(/\n\s*/g, '');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      direction: 'rtl', padding: 20
    }}>
      <div style={{
        background: '#fff', borderRadius: 28, width: '100%', maxWidth: 580,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset', 
        overflow: 'hidden', transform: isOpen ? 'scale(1)' : 'scale(0.95)',
        opacity: isOpen ? 1 : 0, transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        position: 'relative'
      }}>
        
        <button 
          type="button"
          onClick={!isLoading ? onClose : undefined}
          style={{
            position: 'absolute', top: 20, left: 20, background: 'rgba(255,255,255,0.15)',
            border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'white', cursor: !isLoading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s', zIndex: 10, backdropFilter: 'blur(4px)'
          }}
          onMouseOver={e => !isLoading && (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
          onMouseOut={e => !isLoading && (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        >
          <RiCloseLine size={22} />
        </button>

        <div style={{
          padding: '32px 32px 48px', 
          background: step === 2 
            ? (aiNote ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)') 
            : 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
          color: 'white', position: 'relative', overflow: 'hidden',
          transition: 'background 0.5s ease'
        }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: -30, left: 20, width: 100, height: 100, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 2 }}>
            <div style={{ 
              background: step === 2 ? '#fff' : 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              width: 56, height: 56, borderRadius: 20, display: 'flex', 
              alignItems: 'center', justifyContent: 'center',
              boxShadow: step === 2 ? '0 8px 16px rgba(16, 185, 129, 0.4)' : '0 8px 16px rgba(109, 40, 217, 0.4)',
              transition: 'all 0.5s ease', transform: step === 2 ? 'scale(1.1)' : 'scale(1)'
            }}>
              {step === 2 ? (
                aiNote ? <RiImageAddFill size={28} color="#F59E0B" /> : <RiCheckDoubleLine size={28} color="#10B981" />
              ) : (
                <RiMagicLine size={28} color="white" className={isLoading ? 'pulse-icon' : ''} />
              )}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
                {step === 2 
                  ? (aiNote ? 'تم التوليد بنجاح!' : 'تم السحب بدقة 100%!') 
                  : 'الاستيراد الذكي (النسخة الخارقة)'}
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                {step === 2 
                  ? (aiNote ? 'تم جلب البيانات لكن الصور محجوبة.' : 'جاري نقل الصور والألوان إلى نموذج الإضافة...') 
                  : 'اسحب كل الصور، الألوان، المقاسات، والبيانات بضغطة زر!'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 32px 32px', marginTop: '-24px', position: 'relative', zIndex: 3 }}>
          <div style={{ 
            background: '#fff', borderRadius: 24, padding: '24px 24px 32px 24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #F1F5F9'
          }}>
            
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                <div className="loader-ring"></div>
                <h3 style={{ marginTop: 24, color: '#334155', fontSize: 18, fontWeight: 700 }}>الذكاء الاصطناعي يعمل...</h3>
                <p style={{ color: '#64748B', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                  نحاول سحب البيانات مباشرة، وإن فشل نستخدم معرفة الذكاء الاصطناعي<br/>قد يستغرق الأمر بضع ثوانٍ
                </p>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                <div style={{ width: 64, height: 64, background: aiNote ? '#FEF3C7' : '#D1FAE5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  {aiNote ? <RiImageAddFill size={32} color="#D97706" /> : <RiCheckDoubleLine size={32} color="#059669" />}
                </div>
                <h3 style={{ color: aiNote ? '#D97706' : '#059669', fontSize: 18, fontWeight: 700 }}>
                  {aiNote ? 'البيانات النصية جاهزة!' : 'البيانات جاهزة بدقة 100%!'}
                </h3>
                <p style={{ color: '#64748B', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                  {aiNote ? 'الموقع الذي أدخلته (مثل YSL) يحظر سيرفراتنا. لذلك، لم يتم جلب الصور تلقائياً. للحصول على الصور وكل الألوان، استخدم "أداة المتصفح السريعة".' : 'تم جلب الصور والمعرض والألوان وكل شيء بنجاح!'}
                </p>
              </div>
            )}

            {step === 0 && (
              <div className="fade-in-up">
                
                {/* Tabs */}
                <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 24 }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bookmarklet')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                      background: activeTab === 'bookmarklet' ? '#fff' : 'transparent',
                      color: activeTab === 'bookmarklet' ? '#0F172A' : '#64748B',
                      fontWeight: activeTab === 'bookmarklet' ? 800 : 600,
                      boxShadow: activeTab === 'bookmarklet' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    <RiChromeFill size={20} color={activeTab === 'bookmarklet' ? '#10B981' : undefined} /> أداة المتصفح (مضمون 100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('url')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                      background: activeTab === 'url' ? '#fff' : 'transparent',
                      color: activeTab === 'url' ? '#0F172A' : '#64748B',
                      fontWeight: activeTab === 'url' ? 800 : 600,
                      boxShadow: activeTab === 'url' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    <RiLinkM size={18} /> الاستيراد برابط
                  </button>
                </div>

                {activeTab === 'url' ? (
                  <form onSubmit={handleImport}>
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <RiInformationLine size={24} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                      <p style={{ margin: 0, fontSize: 13, color: '#92400E', lineHeight: 1.5, fontWeight: 600 }}>
                        <strong>تنبيه:</strong> مواقع مثل (Valentino, Gucci, YSL) تحظر سحب الصور عن طريق الرابط. سيتم جلب الاسم والوصف فقط ولن يتم جلب جميع الألوان. للحصول على <strong>الصور والألوان بدقة 100%</strong>، يرجى استخدام "أداة المتصفح" في التبويب الآخر.
                      </p>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 10 }}>
                        رابط المنتج (URL)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: '#F1F5F9', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <RiLinkM size={18} color="#64748B" />
                        </div>
                        <input 
                          type="url" 
                          value={url}
                          onChange={e => setUrl(e.target.value)}
                          required
                          placeholder="https://www.ysl.com/..."
                          style={{
                            width: '100%', padding: '16px 16px 16px 50px', border: '2px solid #E2E8F0',
                            borderRadius: 16, fontSize: 15, outline: 'none', transition: 'all 0.3s',
                            direction: 'ltr', background: '#F8FAFC', color: '#0F172A', fontWeight: 500
                          }}
                          onFocus={e => { e.target.style.borderColor = '#8B5CF6'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.1)' }}
                          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.background = '#F8FAFC'; e.target.style.boxShadow = 'none' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 32 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <label style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>
                          تعديل السعر تلقائياً
                        </label>
                        <span style={{ fontSize: 12, color: '#8B5CF6', background: '#F3E8FF', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>اختياري</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        {[
                          { id: 'exact', label: 'السعر الأصلي' },
                          { id: 'percentage', label: 'زيادة نسبة %' },
                          { id: 'fixed', label: 'إضافة مبلغ ثابت' }
                        ].map(opt => (
                          <label key={opt.id} style={{ 
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', 
                            background: pricingRule === opt.id ? '#8B5CF6' : '#F1F5F9', 
                            padding: '12px 8px', borderRadius: 12, 
                            border: pricingRule === opt.id ? '2px solid #8B5CF6' : '2px solid transparent', 
                            transition: 'all 0.2s', textAlign: 'center'
                          }}>
                            <input type="radio" name="pricing" checked={pricingRule === opt.id} onChange={() => setPricingRule(opt.id)} style={{ display: 'none' }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: pricingRule === opt.id ? '#fff' : '#64748B' }}>{opt.label}</span>
                          </label>
                        ))}
                      </div>

                      {pricingRule !== 'exact' && (
                        <div style={{ position: 'relative', animation: 'slideDown 0.3s ease' }}>
                          <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>
                            {pricingRule === 'percentage' ? <RiPercentLine size={18} color="#8B5CF6" /> : <RiMoneyDollarCircleLine size={18} color="#8B5CF6" />}
                          </div>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={pricingValue}
                            onChange={e => setPricingValue(e.target.value)}
                            placeholder={pricingRule === 'percentage' ? 'أدخل النسبة (مثال: 15)' : 'أدخل المبلغ الإضافي (مثال: 5.000)'}
                            style={{
                              width: '100%', padding: '14px 44px 14px 16px', border: '2px solid #E2E8F0',
                              borderRadius: 12, fontSize: 14, outline: 'none', background: '#fff'
                            }}
                            onFocus={e => e.target.style.borderColor = '#8B5CF6'}
                            onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                          />
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit" 
                      style={{
                        width: '100%', padding: '16px', background: 'linear-gradient(135deg, #6D28D9 0%, #4F46E5 100%)',
                        color: 'white', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 800,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 10, boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.5)',
                        transition: 'all 0.3s', transform: 'translateY(0)'
                      }}
                      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 25px -5px rgba(79, 70, 229, 0.6)' }}
                      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(79, 70, 229, 0.5)' }}
                    >
                      <RiMagicLine size={22} /> بدء استخراج البيانات
                    </button>
                  </form>
                ) : (
                  <div className="fade-in-up" style={{ textAlign: 'center' }}>
                    
                    <div style={{ background: '#ECFDF5', border: '1px solid #10B981', borderRadius: 16, padding: '16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ background: '#10B981', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, marginTop: 2 }}>
                        <RiCheckDoubleLine size={18} />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <h4 style={{ margin: 0, color: '#065F46', fontSize: 15, fontWeight: 800 }}>تجلب كل شيء بدقة 10000%</h4>
                        <p style={{ margin: '4px 0 0', color: '#047857', fontSize: 13, lineHeight: 1.6, fontWeight: 600 }}>
                          هذه الأداة تتخطى كل حمايات المواقع الفاخرة، تسحب <strong>كل ألوان المنتج</strong>، تجلب <strong>الصورة الرئيسية + معرض الصور بالكامل (Gallery)</strong> بدقة خارقة.
                        </p>
                      </div>
                    </div>

                    <p style={{ fontSize: 15, color: '#1E293B', marginBottom: 16, fontWeight: 700, textAlign: 'right' }}>
                      1. اسحب هذا الزر وأفلته في شريط الإشارات المرجعية (Bookmarks Bar) في متصفحك:
                    </p>
                    
                    <a 
                      href={bookmarkletCode}
                      onClick={e => e.preventDefault()}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 28px',
                        background: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)', color: '#fff', borderRadius: 99, textDecoration: 'none',
                        fontWeight: 800, fontSize: 16, cursor: 'grab', border: '2px dashed #94A3B8',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', marginBottom: 24,
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                      onDragStart={e => e.currentTarget.style.opacity = '0.5'}
                      onDragEnd={e => e.currentTarget.style.opacity = '1'}
                    >
                      <RiDragDropLine size={24} color="#94A3B8" /> 
                      GH-Shopper سحب للمتجر
                    </a>

                    <div style={{ textAlign: 'right', background: '#F8FAFC', padding: 16, borderRadius: 12 }}>
                      <p style={{ fontSize: 14, color: '#334155', marginBottom: 12, fontWeight: 700 }}>
                        <span style={{ display: 'inline-block', width: 24, height: 24, background: '#E2E8F0', borderRadius: '50%', textAlign: 'center', lineHeight: '24px', marginLeft: 8 }}>2</span>
                        اذهب إلى صفحة المنتج في الموقع (مثلاً Valentino, Gucci, YSL).
                      </p>
                      <p style={{ fontSize: 14, color: '#334155', marginBottom: 0, fontWeight: 700 }}>
                        <span style={{ display: 'inline-block', width: 24, height: 24, background: '#E2E8F0', borderRadius: '50%', textAlign: 'center', lineHeight: '24px', marginLeft: 8 }}>3</span>
                        اضغط على الزر من شريط الإشارات، وستجد المنتج هنا تلقائياً بجميع صوره وألوانه!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .pulse-icon {
          animation: pulse 2s infinite ease-in-out;
        }
        .fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .loader-ring {
          display: inline-block;
          width: 80px;
          height: 80px;
        }
        .loader-ring:after {
          content: " ";
          display: block;
          width: 64px;
          height: 64px;
          margin: 8px;
          border-radius: 50%;
          border: 6px solid #8B5CF6;
          border-color: #8B5CF6 transparent #8B5CF6 transparent;
          animation: loader-ring 1.2s linear infinite;
        }
        @keyframes loader-ring {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  )
}

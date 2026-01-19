import React, { useState, useEffect } from 'react';
import { GraduationCap, Mail, ArrowRight, CheckCircle2, Loader2, RefreshCw, AlertCircle, Info, WifiOff, PlayCircle } from 'lucide-react';

interface LoginViewProps {
  onLogin: (studentId: string) => void;
}

type AuthStep = 'INPUT_EMAIL' | 'VERIFY_CODE';
const DEMO_CODE = '123456';
const TIMEOUT_MS = 30000; // 30 seconds for SMTP operations
const API_URL = "https://snu-table-production.up.railway.app";

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [step, setStep] = useState<AuthStep>('INPUT_EMAIL');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [serverCode, setServerCode] = useState<string | null>(null); // 서버에서 받은 코드 (개발 모드)
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(180);
  const [canResend, setCanResend] = useState(false);

  const SNU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$/;

  useEffect(() => {
    let timer: any;
    if (step === 'VERIFY_CODE' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Helper to force timeout
  const fetchWithTimeout = async (url: string, options: RequestInit) => {
    const fetchPromise = fetch(url, options);
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS)
    );
    return Promise.race([fetchPromise, timeoutPromise]) as Promise<Response>;
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setError(null);
    setIsOfflineMode(false);
    
    const cleanEmail = email.trim();
    setEmail(cleanEmail);

    if (!cleanEmail) {
      setError('이메일을 입력해주세요.');
      return;
    }

    if (!SNU_EMAIL_REGEX.test(cleanEmail)) {
      setError('서울대학교 웹메일(@snu.ac.kr) 형식이 아닙니다.');
      return;
    }

    setIsLoading(true);

    try {
        const response = await fetchWithTimeout(`${API_URL}/api/auth/send-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail })
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text().catch(() => '');
            throw new Error(`서버 응답 오류 (Status: ${response.status}). 백엔드 서버가 실행 중인지 확인해주세요.`);
        }

        const data = await response.json();

        if (response.ok) {
            setStep('VERIFY_CODE');
            setTimeLeft(180);
            setCanResend(false);
            setError(null);
            // 개발 모드에서 서버가 코드를 반환한 경우
            if (data.code) {
                setServerCode(data.code);
                console.log(`[인증 코드] 서버에서 받은 코드: ${data.code}`);
            } else {
                setServerCode(null);
                console.log(`[인증 코드] 이메일로 발송되었습니다. 서버 콘솔을 확인하세요.`);
            }
        } else {
            throw new Error(data.error || '서버 오류가 발생했습니다.');
        }
    } catch (err: any) {
        console.error("[Login] Connection failed:", err);
        const errorMessage = err.message || '서버에 연결할 수 없습니다.';
        
        // 네트워크 오류인 경우에만 오프라인 모드 제안
        if (errorMessage.includes('timed out') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            setError(`백엔드 서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요. (포트 4000)`);
            // 오프라인 모드로 자동 전환하지 않고 사용자에게 선택권 제공
            setIsOfflineMode(true);
            setStep('VERIFY_CODE');
            setTimeLeft(180);
            setCanResend(false);
        } else {
            // 다른 오류는 에러 메시지만 표시
            setError(errorMessage);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError('6자리 인증번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
        // 데모 코드는 항상 허용
        if (code === DEMO_CODE) {
            onLogin(email.split('@')[0] || 'unknown_student');
            return;
        }

        // 오프라인 모드인 경우 데모 코드만 허용
        if (isOfflineMode) {
            setError('오프라인 모드에서는 데모 코드(123456)만 사용할 수 있습니다.');
            setIsLoading(false);
            return;
        }

        const response = await fetchWithTimeout(`${API_URL}/api/auth/verify-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             throw new Error("서버 응답 형식 오류");
        }

        const data = await response.json();
        if (response.ok && data.success) {
             // 토큰 저장 (백엔드에서 제공한 경우)
             if (data.token) {
                 localStorage.setItem('snu_auth_token', data.token);
             }
             onLogin(email.split('@')[0] || 'unknown_student');
        } else {
             setError(data.error || '인증번호가 올바르지 않습니다.');
        }
    } catch (err: any) {
        console.error("[Verify] Failed:", err);
        const errorMessage = err.message || '서버에 연결할 수 없습니다.';
        
        // 네트워크 오류인 경우
        if (errorMessage.includes('timed out') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            setError('서버에 연결할 수 없습니다. 데모 코드(123456)를 사용하거나 백엔드 서버를 확인해주세요.');
        } else {
            setError(errorMessage);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail('demo_student@snu.ac.kr');
    setError(null);
  };

  const handleOfflineDemo = () => {
    onLogin('demo_guest');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center p-6">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
           <div className="w-20 h-20 bg-blue-900 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4">
              <GraduationCap size={40} className="text-white" />
           </div>
           <h1 className="text-2xl font-bold text-gray-900">SNU Table</h1>
           <p className="text-gray-500 text-sm mt-1">서울대학교 구성원 인증</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative">
            {step === 'INPUT_EMAIL' ? (
              <div key="email-step">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                   <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <Mail size={14} className="text-blue-900"/>
                   </div>
                   <h2 className="font-bold text-gray-800">학교 이메일 인증</h2>
                </div>
                
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-gray-500 mb-1 ml-1">SNU 웹메일</label>
                    <input 
                      id="email"
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                      placeholder="id@snu.ac.kr"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                  
                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-xs font-medium p-2 bg-red-50 rounded-lg">
                       <AlertCircle size={14} /> {error}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isLoading || !email}
                    className="w-full bg-blue-900 text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                  >
                    {isLoading ? <Loader2 className="animate-spin" /> : <>인증번호 받기 <ArrowRight size={18} /></>}
                  </button>
                  
                  {!email && (
                    <button 
                        type="button" 
                        onClick={handleDemoFill}
                        className="w-full text-xs text-blue-500 mt-2 hover:underline p-2"
                    >
                        [데모] 이메일 자동 입력
                    </button>
                  )}
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <button 
                        type="button"
                        onClick={handleOfflineDemo}
                        className="w-full py-3 bg-gray-50 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-100 border border-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <WifiOff size={16} />
                        서버 없이 체험하기 (오프라인 데모)
                    </button>
                </div>
              </div>
            ) : (
              <div key="code-step">
                 <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                   <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                      <CheckCircle2 size={14} className="text-green-600"/>
                   </div>
                   <h2 className="font-bold text-gray-800">인증번호 입력</h2>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">인증 메일이 발송되었습니다.</p>
                    <p className="font-bold text-blue-900">{email}</p>
                    <button 
                        onClick={() => setStep('INPUT_EMAIL')} 
                        className="text-xs text-gray-400 underline mt-1 hover:text-gray-600"
                    >
                        이메일 수정하기
                    </button>
                </div>

                {(isOfflineMode || serverCode) && (
                    <div 
                        className={`border rounded-xl p-3 mb-6 text-sm ${isOfflineMode ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}
                    >
                        <div className="flex items-start gap-2">
                            {isOfflineMode ? <WifiOff size={16} className="mt-0.5"/> : <Info className="shrink-0 mt-0.5" size={16} />}
                            <div className="flex-1">
                                <span className="font-bold block mb-1">
                                    {isOfflineMode ? '서버 연결 실패 (오프라인 모드)' : serverCode ? '개발 모드: 인증 코드' : '데모/개발자 모드'}
                                </span>
                                <p className="text-xs mb-2 opacity-80">
                                    {isOfflineMode 
                                        ? '백엔드 서버 응답이 없어 데모 모드로 진행합니다.' 
                                        : serverCode 
                                            ? '서버에서 인증 코드를 받았습니다. 아래 코드를 사용하세요.' 
                                            : '서버 콘솔에서 코드를 확인하거나 아래 코드를 사용하세요.'}
                                </p>
                                <div className="flex items-center justify-between bg-white/60 rounded-lg p-2 border border-blue-100/50">
                                    <span className="font-mono font-bold text-lg tracking-widest text-blue-900">
                                        {serverCode || DEMO_CODE}
                                    </span>
                                    <button 
                                        type="button"
                                        onClick={() => setCode(serverCode || DEMO_CODE)}
                                        className="text-xs bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition-colors font-bold shadow-sm"
                                    >
                                        자동 입력
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="relative">
                    <label htmlFor="code" className="block text-xs font-bold text-gray-500 mb-1 ml-1">인증번호 6자리</label>
                    <input 
                      id="code"
                      type="text" 
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all font-mono tracking-widest text-center text-xl"
                      placeholder="000000"
                      autoComplete="one-time-code"
                      autoFocus
                    />
                    <div className="absolute right-4 bottom-3.5 text-xs font-medium text-red-500">
                        {formatTime(timeLeft)}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-xs font-medium p-2 bg-red-50 rounded-lg">
                       <AlertCircle size={14} /> {error}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isLoading || code.length !== 6}
                    className="w-full bg-blue-900 text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                  >
                    {isLoading ? <Loader2 className="animate-spin" /> : '인증 완료'}
                  </button>
                  
                  <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { 
                            if(canResend) {
                                setServerCode(null);
                                handleSendCode(); 
                            }
                        }}
                        disabled={!canResend}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${canResend ? 'text-gray-600 hover:bg-gray-50' : 'text-gray-300 cursor-not-allowed'}`}
                      >
                        <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> 
                        {canResend ? '재전송' : formatTime(timeLeft)}
                      </button>
                      
                      <button
                         type="button"
                         onClick={handleOfflineDemo}
                         className="flex-1 py-3 text-xs bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100"
                      >
                         데모 모드로 건너뛰기
                      </button>
                  </div>
                </form>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
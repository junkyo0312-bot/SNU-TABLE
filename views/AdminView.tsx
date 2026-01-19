import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ADMIN_STATS_DATA } from '../constants';
import { QueueState } from '../types';
import { Scan, PauseCircle, PlayCircle, Settings, Users, DollarSign, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminViewProps {
  queueState: QueueState;
  isEmergencyStop: boolean;
  onToggleEmergency: () => void;
  onScanTicket: (qrData: string) => boolean;
}

export const AdminView: React.FC<AdminViewProps> = ({ queueState, isEmergencyStop, onToggleEmergency, onScanTicket }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState<'IDLE' | 'SUCCESS' | 'FAIL'>('IDLE');

  const handleScanSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!scanInput.trim()) return;
      
      const success = onScanTicket(scanInput);
      setScanResult(success ? 'SUCCESS' : 'FAIL');
      
      if (success) {
          setScanInput('');
          // Auto close or reset after delay
          setTimeout(() => setScanResult('IDLE'), 2000);
      }
  };

  return (
    <div className="min-h-full bg-gray-100 p-6 pb-24">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
          <p className="text-sm text-gray-500">서울대학교 학생회관 식당</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <Settings size={20} className="text-gray-600"/>
          </button>
        </div>
      </header>

      {/* Operation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* QR Scanner Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-900">
            <Scan size={32} />
          </div>
          <h3 className="font-bold text-lg">입장 QR 스캔</h3>
          <button 
            onClick={() => setShowScanner(true)}
            className={`w-full py-3 rounded-xl font-bold text-white transition-colors bg-blue-900`}
          >
            스캐너 실행
          </button>
        </div>

        {/* Emergency Stop Card */}
        <div className={`p-6 rounded-2xl shadow-sm border flex flex-col items-center justify-center space-y-4 transition-colors ${isEmergencyStop ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isEmergencyStop ? 'bg-red-100 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {isEmergencyStop ? <PauseCircle size={32} /> : <PlayCircle size={32} />}
          </div>
          <h3 className="font-bold text-lg">{isEmergencyStop ? '대기 접수 중단됨' : '정상 운영 중'}</h3>
          <button 
            onClick={onToggleEmergency}
            className={`w-full py-3 rounded-xl font-bold transition-colors border ${isEmergencyStop ? 'bg-white text-red-600 border-red-200' : 'bg-white text-green-600 border-green-200'}`}
          >
            {isEmergencyStop ? '운영 재개' : '긴급 중단 (Emergency)'}
          </button>
        </div>
      </div>

      {/* Scanner Overlay Mock */}
      <AnimatePresence>
      {showScanner && (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6"
        >
            <button onClick={() => setShowScanner(false)} className="absolute top-6 right-6 text-white p-2">
                <X size={32} />
            </button>

            <h2 className="text-white text-2xl font-bold mb-8">티켓 QR 코드 입력</h2>
            
            <div className="w-full max-w-sm bg-white rounded-2xl p-6">
                <form onSubmit={handleScanSubmit}>
                    <label className="block text-gray-700 text-sm font-bold mb-2">QR 데이터 (테스트용)</label>
                    <input 
                        type="text"
                        value={scanInput}
                        onChange={(e) => {
                            setScanInput(e.target.value);
                            setScanResult('IDLE');
                        }}
                        placeholder="My Page의 QR 코드를 복사해서 붙여넣으세요"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button 
                        type="submit"
                        className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl hover:bg-blue-800"
                    >
                        스캔 처리
                    </button>
                </form>

                {scanResult === 'SUCCESS' && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg text-center font-bold">
                        ✅ 식권 사용 처리 완료
                    </motion.div>
                )}
                {scanResult === 'FAIL' && (
                     <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="mt-4 p-3 bg-red-100 text-red-800 rounded-lg text-center font-bold">
                        ❌ 유효하지 않거나 이미 사용된 티켓
                    </motion.div>
                )}
            </div>
            
            <p className="text-gray-400 mt-8 text-center text-sm">
                실제 서비스에서는 카메라가 작동합니다.<br/>
                지금은 테스트를 위해 텍스트 입력을 사용합니다.
            </p>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Stats Dashboard */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Users size={20} className="text-gray-500"/> 시간대별 대기 인원
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ADMIN_STATS_DATA}>
              <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
              <Bar dataKey="people" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
         <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-gray-500"/> 오늘의 매출 요약
         </h3>
         <div className="flex justify-between items-end">
            <div>
                <p className="text-sm text-gray-500">총 판매 식권</p>
                <p className="text-2xl font-bold">1,245개</p>
            </div>
            <div>
                <p className="text-sm text-gray-500">매출액</p>
                <p className="text-2xl font-bold text-blue-900">7,850,000원</p>
            </div>
         </div>
      </div>
    </div>
  );
};
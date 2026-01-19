import React from 'react';
import { Ticket, TicketStatus } from '../types';
import { QrCode, Clock, CheckCircle2, Copy, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

interface MyPageViewProps {
  tickets: Ticket[];
  onLogout?: () => void;
}

export const MyPageView: React.FC<MyPageViewProps> = ({ tickets, onLogout }) => {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('QR 코드가 복사되었습니다. 관리자 페이지에서 테스트해보세요!');
  };

  return (
    <div className="bg-gray-50 min-h-full p-4 pb-24">
      <header className="mb-6 mt-2 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">내 식권 보관함</h1>
        {onLogout && (
            <button 
                onClick={onLogout}
                className="text-xs font-medium text-gray-500 hover:text-red-500 flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200 transition-colors"
            >
                <LogOut size={12} /> 로그아웃
            </button>
        )}
      </header>

      <div className="space-y-4">
        {tickets.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <QrCode size={48} className="mx-auto mb-4 opacity-50"/>
            <p>보유 중인 식권이 없습니다.</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <motion.div
              key={ticket.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`bg-white rounded-2xl p-0 overflow-hidden shadow-sm border ${ticket.status === TicketStatus.USED ? 'border-gray-200 opacity-60' : 'border-blue-100'}`}
            >
              <div className={`p-5 ${ticket.status === TicketStatus.UNUSED ? 'bg-white' : 'bg-gray-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      ticket.status === TicketStatus.UNUSED ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {ticket.status === TicketStatus.UNUSED ? '사용 가능' : '사용 완료'}
                    </span>
                    <h3 className="font-bold text-lg mt-2">{ticket.menuName}</h3>
                    <p className="text-sm text-gray-500">{ticket.purchaseDate}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg">{ticket.price.toLocaleString()}원</span>
                  </div>
                </div>

                {/* Simulated QR Code Area */}
                <div className="border-t border-dashed border-gray-200 pt-4 flex flex-col items-center justify-center">
                   {ticket.status === TicketStatus.UNUSED ? (
                     <>
                        <div className="w-40 h-40 bg-gray-900 rounded-lg flex items-center justify-center text-white mb-2 relative group cursor-pointer" onClick={() => handleCopy(ticket.qrCodeData)}>
                           <QrCode size={100} />
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                             <span className="text-white text-xs font-bold flex flex-col items-center gap-1">
                                <Copy size={20}/> 클릭하여 복사
                             </span>
                           </div>
                        </div>
                        <p className="text-xs text-gray-400">입장 시 리더기에 스캔해주세요</p>
                        <p className="text-[10px] text-gray-300 mt-1 font-mono">{ticket.qrCodeData}</p>
                     </>
                   ) : (
                     <div className="w-full py-8 flex flex-col items-center text-gray-400">
                        <CheckCircle2 size={40} className="mb-2 text-green-500" />
                        <span className="font-bold">식사 완료</span>
                     </div>
                   )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
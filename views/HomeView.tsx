import React from 'react';
import { motion } from 'framer-motion';
import { QueueStatus, Restaurant } from '../types';
import { CURRENT_STATUS_CONFIG } from '../constants';
import { ArrowRight, Clock, AlertTriangle, MapPin, ChevronDown } from 'lucide-react';

interface HomeViewProps {
  restaurant: Restaurant;
  status: QueueStatus;
  waitingCount: number;
  onNavigate: (tab: string) => void;
  onSwitchRestaurant: () => void;
  isEmergencyStop?: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({ 
  restaurant, 
  status, 
  waitingCount, 
  onNavigate, 
  onSwitchRestaurant,
  isEmergencyStop 
}) => {
  const statusInfo = CURRENT_STATUS_CONFIG[status];

  return (
    <div className="flex flex-col h-full bg-white p-6 space-y-6 overflow-y-auto pb-24">
      {/* Restaurant Selector Header */}
      <header className={`flex justify-between items-center ${isEmergencyStop ? 'mt-2' : 'mt-4'}`}>
        <div>
           <button 
             onClick={onSwitchRestaurant}
             className="flex items-center gap-1 text-gray-500 text-sm mb-1 hover:text-blue-600 transition-colors"
           >
             <MapPin size={14} />
             <span>{restaurant.location}</span>
             <ChevronDown size={14} />
           </button>
           <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2" onClick={onSwitchRestaurant}>
             {restaurant.name}
           </h1>
        </div>
      </header>

      {/* Emergency Banner */}
      {isEmergencyStop && (
        <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
        >
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <div>
                <h3 className="text-red-800 font-bold text-sm">대기 접수 일시 중단</h3>
                <p className="text-red-600 text-xs mt-1">식당 내부 사정으로 인해 원격 줄서기가 일시 중단되었습니다.</p>
            </div>
        </motion.div>
      )}

      {/* Traffic Light Card */}
      <motion.div
        key={restaurant.id} // Re-animate on restaurant switch
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100"
      >
        <div className={`absolute top-0 left-0 w-full h-2 ${statusInfo.color}`} />
        
        <div className="p-8 flex flex-col items-center text-center space-y-4">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center ${statusInfo.color} shadow-lg shadow-gray-200`}>
             <span className="text-4xl font-bold text-white shadow-sm">{statusInfo.text}</span>
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-gray-800 mt-2">현재 대기 {waitingCount}명</h2>
            <p className="text-gray-500 mt-1">{statusInfo.desc}</p>
          </div>

          <div className="w-full bg-gray-50 rounded-xl p-4 flex justify-between items-center text-sm text-gray-600 mt-4">
            <span className="flex items-center gap-1"><Clock size={16}/> 예상 대기</span>
            <span className="font-bold text-blue-900 text-lg">약 {Math.ceil(waitingCount * 1.5)}분</span>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => onNavigate('menu')}
          className="p-5 rounded-2xl bg-blue-50 hover:bg-blue-100 transition-colors text-left group"
        >
          <span className="block text-blue-900 font-bold text-lg mb-1">메뉴 보기</span>
          <span className="text-blue-600/70 text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
            주문하러 가기 <ArrowRight size={14}/>
          </span>
        </button>
        <button 
          onClick={() => onNavigate('queue')}
          className="p-5 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors text-left group"
        >
          <span className="block text-gray-900 font-bold text-lg mb-1">줄서기</span>
          <span className="text-gray-500 text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
            원격 웨이팅 <ArrowRight size={14}/>
          </span>
        </button>
      </div>

      {/* Operating Hours Notice */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 flex justify-between">
        <span className="font-bold">🕒 운영 시간</span>
        <span>{restaurant.operatingHours}</span>
      </div>
    </div>
  );
};
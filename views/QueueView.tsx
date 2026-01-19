import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QueueState, Ticket, TicketStatus, Restaurant } from '../types';
import { Clock, Users, Bell, RotateCcw, XCircle, AlertTriangle, PartyPopper, Receipt, MapPin } from 'lucide-react';
import { JoinQueueSchema } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface QueueViewProps {
  queueState: QueueState;
  tickets: Ticket[];
  restaurant: Restaurant;
  onJoinQueue: (partySize: number) => void;
  onLeaveQueue: () => void;
  onNavigate: (tab: string) => void;
  isEmergencyStop?: boolean;
}

const MAX_DISTANCE_METERS = 500; // 500m restriction

// Haversine formula
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; 
  return d * 1000; 
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export const QueueView: React.FC<QueueViewProps> = ({ 
  queueState, 
  tickets, 
  restaurant,
  onJoinQueue, 
  onLeaveQueue, 
  onNavigate,
  isEmergencyStop 
}) => {
  const [isJoining, setIsJoining] = useState(false);
  const [partySize, setPartySize] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Geolocation State
  const [distance, setDistance] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(true);

  const isInQueue = queueState.myQueueNumber !== null;
  const isTurnArrived = isInQueue && queueState.peopleAhead <= 0;

  const validTickets = tickets.filter(
    t => t.restaurantId === queueState.restaurantId && t.status === TicketStatus.UNUSED
  );
  const hasTicket = validTickets.length > 0;

  useEffect(() => {
    if (isInQueue) {
        setCheckingLocation(false);
        return;
    }

    if (!navigator.geolocation) {
      setLocationError("이 브라우저는 위치 서비스를 지원하지 않습니다.");
      setCheckingLocation(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const dist = getDistanceFromLatLonInM(
          position.coords.latitude,
          position.coords.longitude,
          restaurant.latitude,
          restaurant.longitude
        );
        setDistance(Math.round(dist));
        setCheckingLocation(false);
        setLocationError(null);
      },
      (err) => {
        console.error("Geo error:", err);
        setLocationError("위치 정보를 가져올 수 없습니다. GPS를 켜주세요.");
        setCheckingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [restaurant, isInQueue]);

  const handleJoin = () => {
    if (isEmergencyStop) return;

    // Strict Restriction: Block if distance > 500m (and location is known)
    if (distance !== null && distance > MAX_DISTANCE_METERS && !locationError) {
       alert(`현재 위치가 식당에서 ${distance}m 떨어져 있습니다.\n${MAX_DISTANCE_METERS}m 이내에서만 대기 등록이 가능합니다.`);
       return;
    }

    // Optional: Warn if location is unknown but allow (or strict block could be implemented here)
    if ((distance === null && !locationError) || checkingLocation) {
        alert("위치 정보를 확인 중입니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    if (partySize > validTickets.length) {
       if(!confirm(`보유하신 식권(${validTickets.length}매)보다 인원이 많습니다.\n그래도 줄을 서시겠습니까?`)) {
           return;
       }
    }

    const validation = JoinQueueSchema.safeParse({
      userId: uuidv4(),
      partySize: partySize,
      isGroup: partySize > 1
    });

    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }
    
    setError(null);
    onJoinQueue(partySize);
    setIsJoining(false);
  };

  // 1. Not in Queue
  if (!isInQueue) {
    return (
      <div className="h-full flex flex-col p-6 bg-white overflow-y-auto">
        <header className="mb-8 mt-4">
          <h1 className="text-2xl font-bold text-gray-900">스마트 웨이팅</h1>
          <p className="text-gray-500">식당 근처에서 원격으로 줄서기를 신청하세요.</p>
        </header>

        <div className="flex-1 flex flex-col items-center space-y-6">
          {/* Location Status Card */}
          <div className={`w-full p-4 rounded-xl border flex items-center justify-between ${
              checkingLocation ? 'bg-gray-50 border-gray-200' :
              locationError ? 'bg-red-50 border-red-200' :
              (distance && distance <= MAX_DISTANCE_METERS) ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
          }`}>
             <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-full ${
                     checkingLocation ? 'bg-gray-200' :
                     locationError ? 'bg-red-100 text-red-600' :
                     (distance && distance <= MAX_DISTANCE_METERS) ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                 }`}>
                     <MapPin size={20} className={checkingLocation ? "animate-bounce" : ""} />
                 </div>
                 <div>
                     <p className="text-xs text-gray-500 font-medium">현재 위치 확인</p>
                     <p className={`font-bold text-sm ${
                         locationError ? 'text-red-700' :
                         (distance && distance <= MAX_DISTANCE_METERS) ? 'text-green-800' : 'text-orange-800'
                     }`}>
                         {checkingLocation ? '위치 확인 중...' : 
                          locationError ? '위치 권한 필요' : 
                          `식당까지 ${distance}m`}
                     </p>
                 </div>
             </div>
             {!checkingLocation && !locationError && distance && (
                 <div className="text-right">
                     <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                         distance <= MAX_DISTANCE_METERS ? 'bg-green-200 text-green-800' : 'bg-orange-200 text-orange-800'
                     }`}>
                         {distance <= MAX_DISTANCE_METERS ? '신청 가능' : '거리 멀음'}
                     </span>
                 </div>
             )}
          </div>

          <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-2 relative">
             <Users size={64} className="text-gray-400" />
             {!hasTicket && (
                 <div className="absolute -bottom-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-lg">
                    <XCircle size={24} />
                 </div>
             )}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">현재 대기 {queueState.peopleAhead}팀</h2>
            <p className="text-gray-500 max-w-xs mx-auto text-sm">
              {isEmergencyStop 
                ? <span className="text-red-500 font-bold">현재 대기 접수가 중단되었습니다.</span>
                : <>지금 줄서기를 신청하면 약 <span className="text-blue-900 font-bold">{queueState.estimatedWaitTimeMinutes}분</span> 뒤에 입장할 수 있습니다.</>
              }
            </p>
          </div>
          
          {hasTicket ? (
             <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                <Receipt size={16} />
                사용 가능 식권: {validTickets.length}매
             </div>
          ) : (
             <div className="bg-orange-50 text-orange-800 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 animate-pulse">
                <AlertTriangle size={16} />
                식권 구매가 필요합니다
             </div>
          )}
        </div>

        {isEmergencyStop ? (
            <div className="bg-red-50 p-4 rounded-xl flex items-center gap-3 mb-4 mt-4">
                <AlertTriangle className="text-red-500" />
                <span className="text-red-700 font-medium text-sm">운영진에 의해 접수가 중단됨</span>
            </div>
        ) : isJoining ? (
           <motion.div 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
             className="bg-gray-50 p-6 rounded-2xl space-y-4 mt-6"
           >
             <h3 className="font-bold text-center">인원 수를 선택해주세요</h3>
             <div className="flex justify-center gap-4">
               {[1, 2, 3, 4].map(n => (
                 <button
                   key={n}
                   onClick={() => setPartySize(n)}
                   className={`w-12 h-12 rounded-full font-bold text-lg transition-colors ${
                     partySize === n ? 'bg-blue-900 text-white' : 'bg-white border border-gray-200 text-gray-600'
                   }`}
                 >
                   {n}
                 </button>
               ))}
             </div>
             {error && <p className="text-red-500 text-center text-sm">{error}</p>}
             <div className="flex gap-2 mt-4">
               <button onClick={() => setIsJoining(false)} className="flex-1 py-3 bg-gray-200 rounded-xl font-bold text-gray-600">취소</button>
               <button onClick={handleJoin} className="flex-1 py-3 bg-blue-900 rounded-xl font-bold text-white">확인</button>
             </div>
           </motion.div>
        ) : (
          hasTicket ? (
            <button 
                onClick={() => setIsJoining(true)}
                disabled={checkingLocation || (distance !== null && distance > MAX_DISTANCE_METERS && !locationError)}
                className={`w-full font-bold py-4 rounded-xl text-lg shadow-lg transition-all mt-6 ${
                    (distance !== null && distance > MAX_DISTANCE_METERS && !locationError)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-blue-900 text-white shadow-blue-900/20 hover:bg-blue-800'
                }`}
            >
                {(distance !== null && distance > MAX_DISTANCE_METERS && !locationError) 
                  ? '식당 근처로 이동해주세요' 
                  : '지금 줄서기'}
            </button>
          ) : (
            <button 
                onClick={() => onNavigate('menu')}
                className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-2 mt-6"
            >
                <Receipt size={20} />
                식권 구매하러 가기
            </button>
          )
        )}
      </div>
    );
  }

  // 2. Turn Arrived!
  if (isTurnArrived) {
      return (
        <div className="h-full bg-green-500 p-6 flex flex-col text-white pb-24 relative overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
           <header className="mt-4 mb-8 text-center relative z-10">
              <h1 className="text-3xl font-bold mb-2">입장해주세요!</h1>
              <p className="text-green-100">고객님의 순서가 되었습니다.</p>
           </header>

           <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                <div className="bg-white text-green-600 w-40 h-40 rounded-full flex items-center justify-center mb-6 shadow-2xl animate-bounce">
                    <PartyPopper size={64} />
                </div>
                <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl p-6 w-full">
                    <p className="text-green-100 text-sm mb-1">입장 번호</p>
                    <p className="text-5xl font-bold mb-4">#{queueState.myQueueNumber}</p>
                    <div className="h-px bg-white/20 my-4" />
                    <p className="text-sm font-medium">카운터로 오셔서 번호를 보여주세요.</p>
                    <p className="text-xs text-green-200 mt-2">5분 이내 미입장 시 취소될 수 있습니다.</p>
                </div>
           </div>

           <button 
             onClick={onLeaveQueue}
             className="w-full bg-white text-green-600 font-bold py-4 rounded-xl text-lg shadow-lg hover:bg-gray-100 transition-colors relative z-10"
           >
             입장 완료 (대기 종료)
           </button>
        </div>
      )
  }

  // 3. Waiting in Queue
  return (
    <div className="h-full bg-blue-900 p-6 flex flex-col text-white pb-24">
       <header className="mt-4 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">웨이팅 중</h1>
            <p className="text-blue-200">순서가 되면 알림을 보내드려요.</p>
          </div>
          <div className="bg-white/10 p-2 rounded-full animate-pulse">
            <Bell className="text-white" />
          </div>
       </header>

       <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-64 h-64">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-800" />
              <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={753} strokeDashoffset={753 * (1 - queueState.peopleAhead/30)} strokeLinecap="round" className="text-white transition-all duration-1000 ease-out"/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
               <span className="text-blue-200 text-sm mb-1">내 앞 웨이팅</span>
               <span className="text-6xl font-bold">{queueState.peopleAhead} <span className="text-2xl font-normal">팀</span></span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 w-full">
            <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur-sm">
               <Clock className="mx-auto mb-2 text-blue-200" />
               <p className="text-sm text-blue-200">예상 대기</p>
               <p className="text-xl font-bold">{queueState.estimatedWaitTimeMinutes}분</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur-sm">
               <Users className="mx-auto mb-2 text-blue-200" />
               <p className="text-sm text-blue-200">입장 번호</p>
               <p className="text-xl font-bold">#{queueState.myQueueNumber}</p>
            </div>
          </div>
       </div>

       <div className="mt-8 flex gap-3">
         <button className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors">
            <RotateCcw size={16}/> 순서 미루기
         </button>
         <button 
           onClick={onLeaveQueue}
           className="flex-1 bg-red-500/80 hover:bg-red-500 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <XCircle size={16}/> 웨이팅 취소
         </button>
       </div>
    </div>
  );
};
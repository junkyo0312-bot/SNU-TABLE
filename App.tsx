import React, { useState, useEffect, useRef } from 'react';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './views/HomeView';
import { MenuView } from './views/MenuView';
import { QueueView } from './views/QueueView';
import { MyPageView } from './views/MyPageView';
import { AdminView } from './views/AdminView';
import { LoginView } from './views/LoginView';
import { RestaurantSelectView } from './views/RestaurantSelectView';
import { QueueState, QueueStatus, Ticket, MenuItem, TicketStatus, Restaurant } from './types';
import { MOCK_TICKETS } from './constants';
import { RESTAURANTS, getQueueStatus, joinRemoteQueue, leaveRemoteQueue } from './database';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  // -- Authentication State --
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
      return !!localStorage.getItem('snu_auth_token');
  });

  // If no restaurant is selected, show selection screen
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  
  const [currentTab, setCurrentTab] = useState('home');
  const [isAdmin, setIsAdmin] = useState(false);
  const [myUserId] = useState(() => {
      const saved = localStorage.getItem('snu_user_id');
      if (saved) return saved;
      const newId = uuidv4();
      localStorage.setItem('snu_user_id', newId);
      return newId;
  });
  
  // -- State Persistence --
  const [isEmergencyStop, setIsEmergencyStop] = useState<boolean>(false);
  
  const [tickets, setTickets] = useState<Ticket[]>(() => {
    const saved = localStorage.getItem('snu_tickets');
    return saved ? JSON.parse(saved) : MOCK_TICKETS;
  });

  // Queue state needs to be mapped by restaurant ID to be independent
  const [queueStates, setQueueStates] = useState<Record<string, QueueState>>({});

  useEffect(() => {
    localStorage.setItem('snu_tickets', JSON.stringify(tickets));
  }, [tickets]);


  // Initialize Queue State for current restaurant if not exists
  useEffect(() => {
    if (selectedRestaurant && !queueStates[selectedRestaurant.id]) {
        // Seed initial mock data based on restaurant ID length (just for variety)
        const initialCount = 5 + (selectedRestaurant.id.length * 2); 
        setQueueStates(prev => ({
            ...prev,
            [selectedRestaurant.id]: {
                restaurantId: selectedRestaurant.id,
                myQueueNumber: null,
                peopleAhead: initialCount,
                estimatedWaitTimeMinutes: Math.ceil(initialCount * 1.5),
                totalQueueSize: initialCount,
                currentStatus: initialCount > 20 ? QueueStatus.RED : QueueStatus.YELLOW
            }
        }));
    }
  }, [selectedRestaurant]);

  // -- Hybrid Queue Logic: Polling + Simulation Fallback --
  // Use a ref to track if component is mounted to safely cancel timeouts
  useEffect(() => {
    if (!isAuthenticated || !selectedRestaurant) return;

    let isMounted = true;
    let timeoutId: any = null;

    const poll = async () => {
        if (!isMounted) return;
        const restId = selectedRestaurant.id;

        // 1. Try Remote Backend
        const remoteStatus = await getQueueStatus(restId, myUserId);
        
        if (!isMounted) return;

        if (remoteStatus) {
            // Backend is Online
            setQueueStates(prev => ({
                ...prev,
                [restId]: remoteStatus
            }));
        } else {
             // 2. Backend Offline -> Use Simulation (Fallback)
             setQueueStates(prevStates => {
                const prev = prevStates[restId];
                if (!prev) return prevStates;

                // Emergency Stop Check
                if (isEmergencyStop) {
                    const newTotal = Math.max(0, prev.totalQueueSize - (Math.random() > 0.7 ? 1 : 0));
                    return {
                        ...prevStates,
                        [restId]: {
                            ...prev,
                            totalQueueSize: newTotal,
                            estimatedWaitTimeMinutes: Math.ceil(newTotal * 1.5)
                        }
                    };
                }

                // Normal Simulation
                let newPeopleAhead = prev.peopleAhead;
                let newTotal = prev.totalQueueSize;

                if (prev.myQueueNumber !== null) {
                    // If I'm in queue, it decreases
                    if (newPeopleAhead > 0 && Math.random() > 0.6) {
                        newPeopleAhead -= 1;
                    }
                } else {
                    // General fluctuation
                    const change = Math.floor(Math.random() * 3) - 1; 
                    newTotal = Math.max(0, prev.totalQueueSize + change);
                }

                if (prev.myQueueNumber !== null) {
                    if (newTotal < newPeopleAhead) newTotal = newPeopleAhead + 5;
                }

                const status = newTotal > 20 ? QueueStatus.RED : newTotal > 5 ? QueueStatus.YELLOW : QueueStatus.GREEN;

                return {
                ...prevStates,
                [restId]: {
                    ...prev,
                    peopleAhead: newPeopleAhead,
                    totalQueueSize: newTotal,
                    currentStatus: status,
                    estimatedWaitTimeMinutes: Math.ceil((prev.myQueueNumber !== null ? newPeopleAhead : newTotal) * 1.5)
                }
                };
            });
        }
        
        // Schedule next poll only after current one finishes
        timeoutId = setTimeout(poll, 3000);
    };

    poll();

    return () => {
        isMounted = false;
        if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAuthenticated, isEmergencyStop, selectedRestaurant, myUserId]);

  // -- Handlers --
  
  const handleLogin = (studentId: string) => {
      localStorage.setItem('snu_auth_token', `token-${studentId}-${Date.now()}`);
      setIsAuthenticated(true);
  };

  const handleLogout = () => {
      localStorage.removeItem('snu_auth_token');
      setIsAuthenticated(false);
      setSelectedRestaurant(null); // Reset restaurant selection
  };

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setCurrentTab('home');
  };

  const handlePurchase = (item: MenuItem, quantity: number) => {
    if (!selectedRestaurant) return;

    const newTickets: Ticket[] = Array(quantity).fill(null).map(() => ({
      id: uuidv4(),
      restaurantId: selectedRestaurant.id, // Save ID for validation
      restaurantName: selectedRestaurant.name, 
      menuName: item.name,
      price: item.price,
      purchaseDate: new Date().toLocaleString(),
      status: TicketStatus.UNUSED,
      qrCodeData: `ticket-${selectedRestaurant.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    }));

    setTickets(prev => [...newTickets, ...prev]);
    
    if (confirm("결제가 완료되었습니다! \n지금 바로 웨이팅을 등록하시겠습니까?")) {
      setCurrentTab('queue');
    } else {
      setCurrentTab('mypage');
    }
  };

  const handleJoinQueue = async (partySize: number) => {
    if (!selectedRestaurant) return;
    const restId = selectedRestaurant.id;

    // 1. Try Remote Join
    const result = await joinRemoteQueue(restId, myUserId, partySize);
    
    if (result) {
        // Success (Backend handles state, polling will update UI)
        // Optimistic update for better UX
        setQueueStates(prev => {
            const current = prev[restId];
            return {
                ...prev,
                [restId]: {
                    ...current,
                    myQueueNumber: result.queueNumber,
                    // Assume we are last
                    peopleAhead: current.totalQueueSize, 
                    totalQueueSize: current.totalQueueSize + 1
                }
            };
        });
    } else {
        // Fallback: Local Join
        setQueueStates(prev => {
            const current = prev[restId];
            return {
                ...prev,
                [restId]: {
                    ...current,
                    myQueueNumber: Math.floor(Math.random() * 100) + 100,
                    peopleAhead: current.totalQueueSize + 1,
                    estimatedWaitTimeMinutes: Math.ceil((current.totalQueueSize + 1) * 1.5)
                }
            };
        });
    }
  };

  const handleLeaveQueue = async () => {
    if (!selectedRestaurant) return;
    const restId = selectedRestaurant.id;

    // 1. Try Remote Leave
    await leaveRemoteQueue(restId, myUserId);

    // 2. Always update local state immediately
    setQueueStates(prev => ({
        ...prev,
        [restId]: {
            ...prev[restId],
            myQueueNumber: null
        }
    }));
  };

  const handleScanTicket = (qrData: string): boolean => {
      const targetTicket = tickets.find(t => t.qrCodeData === qrData && t.status === TicketStatus.UNUSED);
      if (targetTicket) {
          setTickets(prev => prev.map(t => 
              t.id === targetTicket.id ? { ...t, status: TicketStatus.USED } : t
          ));
          return true;
      }
      return false;
  };

  const toggleAdmin = () => setIsAdmin(!isAdmin);

  // -- Render Logic --

  // 1. Login Screen
  if (!isAuthenticated) {
      return <LoginView onLogin={handleLogin} />;
  }

  // 2. Restaurant Selection Screen (Initial)
  if (!selectedRestaurant) {
      return <RestaurantSelectView onSelect={handleSelectRestaurant} />;
  }

  const currentQueueState = queueStates[selectedRestaurant.id] || {
      restaurantId: selectedRestaurant.id,
      myQueueNumber: null,
      peopleAhead: 0,
      estimatedWaitTimeMinutes: 0,
      totalQueueSize: 0,
      currentStatus: QueueStatus.GREEN
  };

  // 3. Main App Layout
  return (
    <div className="max-w-md mx-auto h-screen bg-white relative shadow-2xl overflow-hidden flex flex-col">
      <main className="flex-1 overflow-hidden relative">
        {currentTab === 'home' && (
          <HomeView 
            restaurant={selectedRestaurant}
            status={currentQueueState.currentStatus} 
            waitingCount={currentQueueState.totalQueueSize} 
            onNavigate={setCurrentTab}
            onSwitchRestaurant={() => setCurrentTab('restaurants')}
            isEmergencyStop={isEmergencyStop}
          />
        )}
        {currentTab === 'menu' && (
          <MenuView 
            restaurant={selectedRestaurant}
            onPurchase={handlePurchase} 
          />
        )}
        {currentTab === 'restaurants' && (
           <div className="h-full overflow-y-auto bg-gray-100">
             <RestaurantSelectView onSelect={handleSelectRestaurant} />
           </div>
        )}
        {currentTab === 'queue' && (
          <QueueView 
            queueState={currentQueueState}
            tickets={tickets}
            restaurant={selectedRestaurant}
            onJoinQueue={handleJoinQueue}
            onLeaveQueue={handleLeaveQueue}
            onNavigate={setCurrentTab}
            isEmergencyStop={isEmergencyStop}
          />
        )}
        {currentTab === 'mypage' && (
          <div className="h-full relative">
            <MyPageView tickets={tickets} onLogout={handleLogout} />
            <button 
              onClick={toggleAdmin} 
              className="absolute top-4 right-4 text-xs font-bold text-gray-200 hover:text-gray-400 z-50 p-2"
            >
              {isAdmin ? "ADMIN ON" : "ADMIN OFF"}
            </button>
          </div>
        )}
        {currentTab === 'admin' && isAdmin && (
          <AdminView 
            queueState={currentQueueState} 
            isEmergencyStop={isEmergencyStop}
            onToggleEmergency={() => setIsEmergencyStop(!isEmergencyStop)}
            onScanTicket={handleScanTicket}
          />
        )}
      </main>

      <BottomNav 
        currentTab={currentTab} 
        onTabChange={setCurrentTab} 
        isAdmin={isAdmin}
      />
    </div>
  );
}
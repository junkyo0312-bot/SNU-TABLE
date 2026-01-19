import React from 'react';
import { Home, Utensils, Users, User, ShieldAlert, Store } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange, isAdmin }) => {
  const navItems = [
    { id: 'home', label: '홈', icon: Home },
    { id: 'menu', label: '메뉴', icon: Utensils },
    { id: 'restaurants', label: '식당', icon: Store },
    { id: 'queue', label: '웨이팅', icon: Users },
    { id: 'mypage', label: '마이', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: '관리자', icon: ShieldAlert });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? 'text-blue-900' : 'text-gray-400'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
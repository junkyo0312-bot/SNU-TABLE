import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchDailyMenu } from '../database';
import { MenuItem, Restaurant } from '../types';
import { ShoppingBag, X, Plus, Minus, Info, Loader2, Utensils, AlertCircle, RefreshCw } from 'lucide-react';
import { z } from 'zod';

const QuantitySchema = z.number().min(1).max(10);

interface MenuViewProps {
  restaurant: Restaurant;
  onPurchase: (item: MenuItem, quantity: number) => void;
}

export const MenuView: React.FC<MenuViewProps> = ({ restaurant, onPurchase }) => {
  const [menuList, setMenuList] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // Load menu asynchronously with auto-refresh
  useEffect(() => {
    let isMounted = true;
    
    const loadMenu = async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      try {
        const menus = await fetchDailyMenu(restaurant.id);
        if (isMounted) {
          setMenuList(menus);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to fetch menu", err);
        if (isMounted) {
          setError("메뉴 정보를 불러오는데 실패했습니다.");
        }
      } finally {
        if (isMounted && showLoading) {
          setLoading(false);
        }
      }
    };

    // Initial load
    loadMenu(true);

    // Auto-refresh every 5 minutes (300,000 ms)
    const intervalId = setInterval(() => {
      loadMenu(false); // Silent refresh
    }, 5 * 60 * 1000);

    return () => { 
      isMounted = false; 
      clearInterval(intervalId);
    };
  }, [restaurant.id, reloadKey]);

  const handleRetry = () => {
    setReloadKey(prev => prev + 1);
  };

  const handleOpenModal = (item: MenuItem) => {
    if (item.isSoldOut) return;
    setSelectedItem(item);
    setQuantity(1);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  const increment = () => {
    const result = QuantitySchema.safeParse(quantity + 1);
    if (result.success) setQuantity(result.data);
  };

  const decrement = () => {
    const result = QuantitySchema.safeParse(quantity - 1);
    if (result.success) setQuantity(result.data);
  };

  return (
    <div className="bg-gray-50 min-h-full pb-24">
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">{restaurant.name} 메뉴</h1>
        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <Utensils size={12}/> {new Date().toLocaleDateString()} 실시간 차림표
        </p>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
           // Skeleton UI
           Array(4).fill(0).map((_, i) => (
             <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 animate-pulse">
                <div className="w-24 h-24 rounded-lg bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-3 py-1">
                   <div className="h-4 bg-gray-200 rounded w-1/4" />
                   <div className="h-6 bg-gray-200 rounded w-3/4" />
                   <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
             </div>
           ))
        ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="text-red-500" size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">메뉴를 불러올 수 없습니다</h3>
                <p className="text-gray-500 text-sm mb-6">네트워크 연결 상태를 확인하거나<br/>잠시 후 다시 시도해주세요.</p>
                <button
                    onClick={handleRetry}
                    className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                >
                    <RefreshCw size={16} /> 다시 시도
                </button>
            </div>
        ) : menuList.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
                <p>현재 운영 시간이 아니거나 준비된 메뉴가 없습니다.</p>
            </div>
        ) : (
            menuList.map((item) => (
            <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 cursor-pointer active:scale-98 transition-transform ${
                item.isSoldOut ? 'opacity-60 grayscale' : ''
                }`}
                onClick={() => handleOpenModal(item)}
            >
                <div className="w-24 h-24 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 relative">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                {item.isSoldOut && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-xs border border-white px-2 py-1 rounded">SOLD OUT</span>
                    </div>
                )}
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                    <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mb-1 inline-block">
                        {item.category}
                    </span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{item.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{item.kcal} kcal</p>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <span className="font-bold text-lg">{item.price.toLocaleString()}원</span>
                    {!item.isSoldOut && (
                    <button className="w-8 h-8 rounded-full bg-blue-50 text-blue-900 flex items-center justify-center hover:bg-blue-100 transition-colors">
                        <ShoppingBag size={16} />
                    </button>
                    )}
                </div>
                </div>
            </motion.div>
            ))
        )}
      </div>

      {/* Purchase Modal */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={handleCloseModal}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 500 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 pb-safe shadow-2xl max-w-md mx-auto max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">메뉴 상세</h3>
                <button onClick={handleCloseModal} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                    <X className="text-gray-600" size={20} />
                </button>
              </div>

              <div className="flex gap-4 mb-6">
                 <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm border border-gray-100">
                    <img src={selectedItem.imageUrl} alt={selectedItem.name} className="w-full h-full object-cover"/>
                 </div>
                 <div className="flex flex-col justify-center">
                   <h4 className="font-bold text-lg leading-tight text-gray-900">{selectedItem.name}</h4>
                   <p className="text-gray-500 text-sm mt-1">{restaurant.name}</p>
                   <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-bold text-xl text-blue-900">{selectedItem.price.toLocaleString()}</span>
                      <span className="text-sm text-gray-600 font-medium">원</span>
                   </div>
                 </div>
              </div>

              {/* Nutritional Info Section */}
              <div className="border border-gray-100 rounded-2xl p-5 mb-6 space-y-4 shadow-sm bg-white">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                     <Info size={16} className="text-blue-500"/> 
                     <span className="font-bold text-sm text-gray-900">상세 정보</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">열량 (1인분)</p>
                          <p className="font-bold text-gray-800 text-lg">{selectedItem.kcal} <span className="text-xs font-normal text-gray-500">kcal</span></p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">카테고리</p>
                          <p className="font-bold text-gray-800 text-lg">{selectedItem.category}</p>
                      </div>
                  </div>
                  
                  <div>
                      <p className="text-xs text-gray-500 mb-1.5 font-medium">메뉴 설명 & 알레르기 정보</p>
                      <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg">
                        매일 아침 공수되는 신선한 재료로 정성껏 조리했습니다. <br/>
                        계절과 수급 상황에 따라 일부 식재료가 변경될 수 있으며, 특정 재료에 알레르기가 있으신 고객님은 배식 전 영양사에게 문의 바랍니다.
                      </p>
                  </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 flex justify-between items-center mb-6">
                <span className="font-bold text-gray-700">수량 선택</span>
                <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-200 px-3 py-1.5">
                  <button onClick={decrement} className="p-1 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"><Minus size={18}/></button>
                  <span className="font-bold w-6 text-center text-lg">{quantity}</span>
                  <button onClick={increment} className="p-1 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"><Plus size={18}/></button>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mb-2">
                 <div className="flex justify-between items-center mb-4">
                   <span className="text-gray-500 font-medium">총 결제금액</span>
                   <span className="text-2xl font-bold text-blue-900">{(selectedItem.price * quantity).toLocaleString()}원</span>
                 </div>
              </div>

              <button 
                onClick={() => {
                  onPurchase(selectedItem, quantity);
                  handleCloseModal();
                }}
                className="w-full bg-blue-900 text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              >
                <ShoppingBag size={20} />
                {quantity}개 주문하기
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
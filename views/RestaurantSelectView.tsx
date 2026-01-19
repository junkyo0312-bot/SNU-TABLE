import React from 'react';
import { motion } from 'framer-motion';
import { RESTAURANTS } from '../database';
import { Restaurant } from '../types';
import { MapPin, Clock, ArrowRight } from 'lucide-react';

interface RestaurantSelectViewProps {
  onSelect: (restaurant: Restaurant) => void;
}

export const RestaurantSelectView: React.FC<RestaurantSelectViewProps> = ({ onSelect }) => {
  return (
    <div className="min-h-full bg-gray-100 p-6 pb-24">
      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold text-gray-900">
          서울대학교 학식
        </h1>
        <p className="text-gray-500 mt-1">실시간 정보를 확인할 식당을 선택하세요.</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {RESTAURANTS.map((restaurant, index) => (
          <motion.div
            key={restaurant.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }} // Faster stagger
            onClick={() => onSelect(restaurant)}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer active:scale-98 transition-transform group flex"
          >
            <div className="w-32 h-32 relative flex-shrink-0">
              <img 
                src={restaurant.image} 
                alt={restaurant.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
            </div>
            
            <div className="p-4 flex-1 flex flex-col justify-center">
               <h2 className="font-bold text-lg text-gray-900 mb-2">{restaurant.name}</h2>
               <div className="space-y-1">
                 <div className="flex items-center text-gray-500 text-xs gap-1">
                    <MapPin size={12} />
                    <span>{restaurant.location}</span>
                 </div>
                 <div className="flex items-center text-gray-500 text-xs gap-1">
                    <Clock size={12} />
                    <span>{restaurant.operatingHours}</span>
                 </div>
               </div>
            </div>
            
            <div className="w-12 flex items-center justify-center border-l border-gray-50">
                <ArrowRight size={20} className="text-gray-300 group-hover:text-blue-900 transition-colors"/>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
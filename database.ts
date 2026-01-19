import { MenuItem, Restaurant, QueueState, QueueStatus } from './types';

// --- Real SNU Restaurant Data with Coordinates ---
export const RESTAURANTS: Restaurant[] = [
  {
    id: 'student-center',
    name: '학생회관 식당',
    location: '63동 1층',
    operatingHours: '08:00 ~ 19:00',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4595,
    longitude: 126.9521,
  },
  {
    id: 'jahayeon',
    name: '자하연 식당',
    location: '109동 2층',
    operatingHours: '11:00 ~ 18:30',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4623,
    longitude: 126.9567,
  },
  {
    id: 'eng-301',
    name: '301동 식당',
    location: '301동 B1',
    operatingHours: '11:30 ~ 18:30',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4507,
    longitude: 126.9526,
  },
  {
    id: 'eng-302',
    name: '302동 식당',
    location: '302동',
    operatingHours: '11:30 ~ 18:30',
    image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4503,
    longitude: 126.9507,
  },
  {
    id: 'dongwon',
    name: '동원관 식당',
    location: '113동',
    operatingHours: '11:00 ~ 14:00',
    image: 'https://images.unsplash.com/photo-1574966739987-69e3d241d6dc?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4646,
    longitude: 126.9553,
  },
  {
    id: 'gamgol',
    name: '감골 식당',
    location: '101동',
    operatingHours: '11:00 ~ 18:30',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4637,
    longitude: 126.9575,
  },
  {
    id: 'so-dang-gol',
    name: '서당골(제4식당)',
    location: '76동 1층',
    operatingHours: '11:30 ~ 13:30',
    image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4641,
    longitude: 126.9532,
  },
  {
    id: 'third-cafeteria',
    name: '제3식당',
    location: '75-1동 3층',
    operatingHours: '11:00 ~ 19:00',
    image: 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4648,
    longitude: 126.9529,
  },
  {
    id: 'dure-midam',
    name: '두레미담',
    location: '75-1동 5층',
    operatingHours: '11:00 ~ 20:00',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4648,
    longitude: 126.9529,
  },
  {
    id: 'arts',
    name: '예술계 식당',
    location: '74동',
    operatingHours: '11:00 ~ 18:00',
    image: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4621,
    longitude: 126.9505,
  },
  {
    id: 'vet',
    name: '수의대 식당',
    location: '85동',
    operatingHours: '11:30 ~ 13:30',
    image: 'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4563,
    longitude: 126.9499,
  },
  {
    id: 'dorm-919',
    name: '관악사(919동)',
    location: '919동',
    operatingHours: '07:30 ~ 19:30',
    image: 'https://images.unsplash.com/photo-1596561214088-372070737c35?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4644,
    longitude: 126.9602,
  },
  {
    id: 'dorm-901',
    name: '관악사(901동)',
    location: '901동',
    operatingHours: '08:00 ~ 19:00',
    image: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&q=80&w=400',
    latitude: 37.4688,
    longitude: 126.9587,
  }
];

// --- Simulation Data: Restaurant Specific Menus ---
const COMMON_MENUS = [
  { name: '라면+공기밥', price: 4000, category: '분식', kcal: 500, img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624' },
  { name: '제육덮밥', price: 5500, category: '한식', kcal: 700, img: 'https://images.unsplash.com/photo-1563245372-f21724e3856d' },
];

const MENU_POOLS_BY_ID: Record<string, typeof COMMON_MENUS> = {
  'student-center': [
    { name: '천원의 아침밥(백반)', price: 1000, category: '한식', kcal: 600, img: 'https://images.unsplash.com/photo-1583067888849-478052f6793e' },
    { name: '돈까스 정식', price: 6500, category: '양식', kcal: 850, img: 'https://images.unsplash.com/photo-1606502973842-f64bc2f6d00a' },
    { name: '순두부찌개', price: 5000, category: '한식', kcal: 550, img: 'https://images.unsplash.com/photo-1629856557871-29ae70588661' },
    { name: '치즈부대찌개', price: 5500, category: '한식', kcal: 700, img: 'https://images.unsplash.com/photo-1583067888849-478052f6793e' },
  ],
  'jahayeon': [
    { name: '옛날 짜장면', price: 5000, category: '중식', kcal: 700, img: 'https://images.unsplash.com/photo-1585507024346-6085a6336332' },
    { name: '찹쌀 탕수육', price: 8000, category: '중식', kcal: 900, img: 'https://images.unsplash.com/photo-1590502593747-42a996133562' },
    { name: '짬뽕', price: 5500, category: '중식', kcal: 600, img: 'https://images.unsplash.com/photo-1568031813264-d394c5d474b9' },
    { name: '철판 함박스테이크', price: 7000, category: '양식', kcal: 850, img: 'https://images.unsplash.com/photo-1563897539633-2682c533ca9b' },
  ],
  'eng-301': [
    { name: '소고기 버섯 전골', price: 12000, category: '특식', kcal: 600, img: 'https://images.unsplash.com/photo-1543826173-70651703c5a4' },
    { name: '황태 해장국', price: 6000, category: '한식', kcal: 450, img: 'https://images.unsplash.com/photo-1563897539633-2682c533ca9b' },
    { name: '오늘의 파스타', price: 8000, category: '양식', kcal: 700, img: 'https://images.unsplash.com/photo-1622973536968-3ead9e780960' },
  ],
};

function seededRandom(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const x = Math.sin(hash) * 10000;
    return x - Math.floor(x);
}

// --- API Helpers ---
const API_BASE = 'https://snu-table-production.up.railway.app/api';

// Helper for fetch with short timeout to prevent UI freezing
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 2000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);
    return response;
}

export const fetchDailyMenu = async (restaurantId: string): Promise<MenuItem[]> => {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/menus/${restaurantId}`);
    if (response.ok) {
        return await response.json();
    }
  } catch (error) {
    // console.debug("[SNU Table] Backend offline, using simulation.");
  }

  // Simulation Fallback
  const delay = 400 + Math.random() * 600;
  await new Promise(resolve => setTimeout(resolve, delay));

  const today = new Date().toISOString().split('T')[0];
  const seedBase = `${today}-${restaurantId}`;
  
  const specificPool = MENU_POOLS_BY_ID[restaurantId] || [...COMMON_MENUS, ...MENU_POOLS_BY_ID['student-center']];
  const fullPool = [...specificPool, ...COMMON_MENUS];

  const menuCount = 3 + Math.floor(seededRandom(seedBase + 'count') * 3);
  
  const dailyMenus: MenuItem[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < menuCount; i++) {
    let poolIndex = Math.floor(seededRandom(`${seedBase}-menu-${i}`) * fullPool.length);
    let attempts = 0;
    while (usedIndices.has(poolIndex) && attempts < 10) {
      poolIndex = (poolIndex + 1) % fullPool.length;
      attempts++;
    }
    usedIndices.add(poolIndex);

    const baseItem = fullPool[poolIndex];
    const isSoldOut = seededRandom(`${seedBase}-soldout-${i}`) < 0.1; 

    dailyMenus.push({
      id: `${restaurantId}-${today}-${i}`,
      restaurantId: restaurantId,
      name: baseItem.name,
      price: baseItem.price,
      imageUrl: `${baseItem.img}?random=${poolIndex}`,
      category: baseItem.category,
      kcal: baseItem.kcal,
      isSoldOut: isSoldOut,
    });
  }
  return dailyMenus;
};

// Queue APIs with Timeouts
export const getQueueStatus = async (restaurantId: string, userId?: string): Promise<QueueState | null> => {
  try {
    const url = userId 
        ? `${API_BASE}/queue/${restaurantId}?userId=${userId}`
        : `${API_BASE}/queue/${restaurantId}`;
        
    const response = await fetchWithTimeout(url);
    if (response.ok) {
        return await response.json();
    }
  } catch (e) {
      return null;
  }
  return null;
};

export const joinRemoteQueue = async (restaurantId: string, userId: string, partySize: number): Promise<{queueNumber: number} | null> => {
    try {
        const response = await fetchWithTimeout(`${API_BASE}/queue/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurantId, userId, partySize })
        });
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        return null;
    }
    return null;
};

export const leaveRemoteQueue = async (restaurantId: string, userId: string): Promise<boolean> => {
    try {
        const response = await fetchWithTimeout(`${API_BASE}/queue/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurantId, userId })
        });
        return response.ok;
    } catch (e) {
        return false;
    }
};

export const getRestaurantById = (id: string): Restaurant | undefined => {
  return RESTAURANTS.find(r => r.id === id);
};
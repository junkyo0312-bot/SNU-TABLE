import { MenuItem, QueueStatus, Ticket, TicketStatus } from './types';

// Mock Menu Data
export const MOCK_MENU: MenuItem[] = [
  {
    id: 'm1',
    restaurantId: 'student-center',
    name: '등심 돈까스',
    price: 6500,
    imageUrl: 'https://picsum.photos/400/300?random=1',
    isSoldOut: false,
    category: '양식',
    kcal: 850,
  },
  {
    id: 'm2',
    restaurantId: 'student-center',
    name: '김치찌개 정식',
    price: 5500,
    imageUrl: 'https://picsum.photos/400/300?random=2',
    isSoldOut: false,
    category: '한식',
    kcal: 600,
  },
  {
    id: 'm3',
    restaurantId: 'student-center',
    name: '치즈 오븐 스파게티',
    price: 7000,
    imageUrl: 'https://picsum.photos/400/300?random=3',
    isSoldOut: true,
    category: '양식',
    kcal: 920,
  },
  {
    id: 'm4',
    restaurantId: 'student-center',
    name: '소불고기 덮밥',
    price: 6000,
    imageUrl: 'https://picsum.photos/400/300?random=4',
    isSoldOut: false,
    category: '한식',
    kcal: 750,
  },
];

// Mock Tickets for My Page
export const MOCK_TICKETS: Ticket[] = [
  {
    id: 't1',
    restaurantId: 'student-center',
    restaurantName: '학생회관 식당',
    menuName: '등심 돈까스',
    price: 6500,
    purchaseDate: '2026. 01. 17 11:30',
    status: TicketStatus.UNUSED,
    qrCodeData: 'snu-table-t1-secret',
  },
  {
    id: 't2',
    restaurantId: 'student-center',
    restaurantName: '학생회관 식당',
    menuName: '김치찌개 정식',
    price: 5500,
    purchaseDate: '2026. 01. 16 12:00',
    status: TicketStatus.USED,
    qrCodeData: 'snu-table-t2-secret',
  },
];

// Mock Admin Chart Data
export const ADMIN_STATS_DATA = [
  { time: '11:00', people: 10 },
  { time: '11:15', people: 25 },
  { time: '11:30', people: 55 },
  { time: '11:45', people: 80 },
  { time: '12:00', people: 120 },
  { time: '12:15', people: 90 },
  { time: '12:30', people: 60 },
];

export const CURRENT_STATUS_CONFIG = {
  [QueueStatus.GREEN]: {
    color: 'bg-green-500',
    text: '여유',
    desc: '대기 없이 바로 식사 가능해요!',
    countRange: '0~10명'
  },
  [QueueStatus.YELLOW]: {
    color: 'bg-yellow-400',
    text: '보통',
    desc: '약간의 대기가 발생하고 있어요.',
    countRange: '10~30명'
  },
  [QueueStatus.RED]: {
    color: 'bg-red-500',
    text: '혼잡',
    desc: '지금 오시면 많이 기다려야 해요.',
    countRange: '30명 이상'
  }
};
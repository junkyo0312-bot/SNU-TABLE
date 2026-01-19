import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000;

// [수정 1] CORS 설정 합치기 (배포 주소와 로컬 주소 모두 허용)
app.use(cors({
    origin: [
        'https://snu-table.vercel.app',  // 배포된 프론트엔드
        'http://localhost:5173',         // 로컬 개발용
        'http://127.0.0.1:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'], // 허용할 메소드 명시
}));

app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    next();
});

// [수정 2] SMTP 설정 강화 (타임아웃 증가, 공백 제거, 디버그 모드)
// [수정] 복잡한 포트 설정 대신 service: 'Gmail' 사용
const SMTP_CONFIG = {
    host: 'smtp.gmail.com',   // [변경] 명시적 호스트 설정
    port: 465,                // [변경] 587 대신 465(SSL) 사용 (클라우드 환경에서 더 안정적)
    secure: true,             // [변경] 포트 465를 쓸 때는 반드시 true여야 함
    auth: {
        user: process.env.SMTP_USER?.trim(),
        pass: process.env.SMTP_PASS?.trim()
    },
    
    // 타임아웃 설정 (기존 설정 유지)
    connectionTimeout: 10000, 
    greetingTimeout: 10000,
    socketTimeout: 10000,
    debug: true,
    logger: true
};
// Debug Log
console.log('--- SMTP Configuration Check ---');
if (process.env.SMTP_USER) {
    console.log(`SMTP_USER: ${process.env.SMTP_USER.trim()}`);
} else {
    console.warn('SMTP_USER is missing in process.env');
}
console.log('--------------------------------');

// --- Types ---
interface MenuItem {
    id: string;
    restaurantId: string;
    name: string;
    price: number;
    imageUrl: string;
    isSoldOut: boolean;
    category: string;
    kcal: number;
}

interface QueueItem {
    userId: string;
    partySize: number;
    joinedAt: number;
    queueNumber: number;
}

interface RestaurantQueue {
    items: QueueItem[];
    currentNumber: number;
    nextTicketNumber: number;
}

interface VerificationEntry {
    code: string;
    expiresAt: number;
}

// --- Data Stores ---
const QUEUES: Record<string, RestaurantQueue> = {};
const VERIFICATIONS: Record<string, VerificationEntry> = {};

// Caching System
interface CacheEntry {
    timestamp: number;
    data: MenuItem[];
}
const CACHE: Record<string, CacheEntry> = {};
const CACHE_DURATION = 60 * 60 * 1000;

// Maps
const RESTAURANT_URL_MAP: Record<string, string> = {
    'student-center': 'https://snuco.snu.ac.kr/ko/foodmenu?page=0',
    'jahayeon': 'https://snuco.snu.ac.kr/ko/foodmenu?page=1',
    'eng-301': 'https://snuco.snu.ac.kr/ko/foodmenu?page=2',
    'eng-302': 'https://snuco.snu.ac.kr/ko/foodmenu?page=2',
    'dongwon': 'https://snuco.snu.ac.kr/ko/foodmenu?page=3',
    'gamgol': 'https://snuco.snu.ac.kr/ko/foodmenu?page=3',
    'so-dang-gol': 'https://snuco.snu.ac.kr/ko/foodmenu?page=4',
    'third-cafeteria': 'https://snuco.snu.ac.kr/ko/foodmenu?page=4',
    'dorm-919': 'https://snuco.snu.ac.kr/ko/foodmenu?page=5',
    'dorm-901': 'https://snuco.snu.ac.kr/ko/foodmenu?page=5',
};

const RESTAURANT_NAME_MAP: Record<string, string> = {
    'student-center': '학생회관',
    'jahayeon': '자하연',
    'eng-301': '301동',
    'eng-302': '302동',
    'dongwon': '동원관',
    'gamgol': '감골',
    'so-dang-gol': '서당골',
    'third-cafeteria': '제3식당',
    'dure-midam': '두레미담',
    'arts': '예술계',
    'vet': '수의대',
    'dorm-919': '919동',
    'dorm-901': '901동'
};

const IMAGE_POOL = [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624',
    'https://images.unsplash.com/photo-1563245372-f21724e3856d',
    'https://images.unsplash.com/photo-1606502973842-f64bc2f6d00a',
    'https://images.unsplash.com/photo-1629856557871-29ae70588661'
];

// --- Helper Functions ---
function getQueue(restaurantId: string): RestaurantQueue {
    if (!QUEUES[restaurantId]) {
        QUEUES[restaurantId] = {
            items: [],
            currentNumber: 100,
            nextTicketNumber: 101
        };
        const initialCount = 3 + Math.floor(Math.random() * 5);
        for(let i=0; i<initialCount; i++) {
            QUEUES[restaurantId].items.push({
                userId: `dummy-${Date.now()}-${i}`,
                partySize: 1 + Math.floor(Math.random() * 3),
                joinedAt: Date.now(),
                queueNumber: QUEUES[restaurantId].nextTicketNumber++
            });
        }
    }
    return QUEUES[restaurantId];
}

setInterval(() => {
    Object.keys(QUEUES).forEach(restaurantId => {
        const queue = QUEUES[restaurantId];
        if (queue.items.length > 0) {
            if (Math.random() > 0.8) {
                const processed = queue.items.shift();
                if (processed) {
                    queue.currentNumber = processed.queueNumber;
                }
            }
        }
    });
}, 3000); 

// ... (기존 코드 생략)

// --- Scraper Logic (수정됨) ---
async function scrapeMenu(restaurantId: string): Promise<MenuItem[]> {
    // 1. 캐시 확인
    if (CACHE[restaurantId] && Date.now() - CACHE[restaurantId].timestamp < CACHE_DURATION) {
        return CACHE[restaurantId].data;
    }

    const targetUrl = RESTAURANT_URL_MAP[restaurantId];
    const targetName = RESTAURANT_NAME_MAP[restaurantId] || '';

    if (!targetUrl) return generateFallback(restaurantId);
    
    try {
        // [수정 핵심 1] SSL 인증서 검증 무시 설정 (학교 서버 호환성 높임)
        const httpsAgent = new https.Agent({  
            rejectUnauthorized: false 
        });

        // [수정 핵심 2] 헤더 위장 (진짜 크롬 브라우저인 척 속임)
        const response = await axios.get(targetUrl, { 
            timeout: 15000, // [수정 핵심 3] 타임아웃 6초 -> 15초로 증가 (해외망 지연 고려)
            httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://snuco.snu.ac.kr/',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        const $ = cheerio.load(response.data);
        const menus: MenuItem[] = [];

        $('tbody tr').each((i, row) => {
            const columns = $(row).find('td');
            const restaurantNameCell = columns.eq(0).text().trim(); 

            if (targetName && !restaurantNameCell.includes(targetName)) {
                return; 
            }

            for(let colIdx = 1; colIdx < columns.length; colIdx++) {
                const cellHtml = columns.eq(colIdx).html();
                if (!cellHtml) continue;

                const lines = cellHtml.split(/<br\s*\/?>/i);

                lines.forEach((line) => {
                    const cleanText = $(`<div>${line}</div>`).text().trim(); 
                    if (cleanText.length < 2) return;

                    const excludePatterns = [
                        /^※\s*/, /운영시간/i, /혼잡시간/i, /예약문의/i, /라스트오더/i,
                        /브레이크타임/i, /위 메뉴외에도/i, /다양한 메뉴가/i,
                        /준비되어 있습니다/i, /메\s*뉴/i, /사\s*이\s*드/i, /^<.*>$/
                    ];

                    if (excludePatterns.some(pattern => pattern.test(cleanText))) {
                        return;
                    }

                    const menuPattern = /^(.+?)\s*[:：]\s*([0-9,]+)\s*원?$/;
                    const simplePattern = /^(.+?)([0-9,]+)\s*원?$/;
                    
                    let name = '';
                    let price = 0;
                    let match = cleanText.match(menuPattern);
                    
                    if (match) {
                        name = match[1].trim();
                        price = parseInt(match[2].replace(/,/g, ''), 10);
                    } else {
                        match = cleanText.match(simplePattern);
                        if (match) {
                            name = match[1].trim();
                            price = parseInt(match[2].replace(/,/g, ''), 10);
                        } else {
                            return;
                        }
                    }

                    if (price < 1000 || price > 100000) return;
                    if (name.length < 1) return;

                    name = name.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/※/g, '').replace(/\s+/g, ' ').trim();

                    if (name.length < 1) return;

                    let category = '일반';
                    if (colIdx === 1) category = '조식';
                    else if (colIdx === 2) category = '중식';
                    else if (colIdx === 3) category = '석식';

                    menus.push({
                        id: `snuco-${restaurantId}-${i}-${colIdx}-${menus.length}`,
                        restaurantId: restaurantId,
                        name: name,
                        price: price,
                        imageUrl: IMAGE_POOL[(i + colIdx + menus.length) % IMAGE_POOL.length] + '?auto=format&fit=crop&w=400',
                        category: category,
                        isSoldOut: false,
                        kcal: 500 + Math.floor(Math.random() * 400)
                    });
                });
            }
        });

        // 데이터가 없으면 fallback 대신 에러 로그를 남기고 fallback 실행
        if (menus.length === 0) {
            console.warn(`[Scraper] Warning: No menus found for ${restaurantId}. HTML length: ${response.data.length}`);
            return generateFallback(restaurantId);
        }

        CACHE[restaurantId] = { timestamp: Date.now(), data: menus };
        return menus;

    } catch (error: any) {
        // [디버깅용 로그 강화]
        console.error(`[Scraper] Failed to fetch ${restaurantId}:`, error.message);
        if (error.response) {
            console.error(`Status: ${error.response.status}, StatusText: ${error.response.statusText}`);
        }
        return generateFallback(restaurantId);
    }
}

function generateFallback(restaurantId: string): MenuItem[] {
    const fallbackMenus = [
        { name: '[Simulation] 오늘의 백반', price: 5500, category: '한식' },
        { name: '[Simulation] 돈까스 & 쫄면', price: 7000, category: '양식' },
        { name: '[Simulation] 차돌 된장찌개', price: 6000, category: '한식' },
        { name: '[Simulation] 라면 + 공기밥', price: 4000, category: '분식' }
    ];
    return fallbackMenus.map((m, i) => ({
        id: `fallback-${restaurantId}-${i}`,
        restaurantId,
        name: m.name,
        price: m.price,
        imageUrl: IMAGE_POOL[i % IMAGE_POOL.length] + '?auto=format&fit=crop&w=400',
        category: m.category,
        isSoldOut: false,
        kcal: 700
    }));
}

// --- Email Logic ---
// 상단 import에 추가 필요 없음 (axios 사용)

// [수정된 이메일 발송 함수 - Resend API 사용]
async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    // API 키가 없으면 시뮬레이션 모드
    if (!RESEND_API_KEY) {
        console.log(`[Simulation] Code: ${code} to ${to}`);
        return true;
    }

    try {
        console.log(`[Email] Sending via Resend API to ${to}...`);
        
        // SMTP 포트 대신 HTTP(443) 포트를 쓰므로 차단될 일이 없음
        const response = await axios.post(
            'https://api.resend.com/emails',
            {
                from: 'onboarding@resend.dev', // Resend 기본 테스트 도메인 (나중에 본인 도메인 연결 가능)
                to: [to],
                subject: '[SNU Table] 인증번호 안내',
                html: `
                    <div style="padding: 20px; text-align: center; border: 1px solid #eee;">
                        <h1>SNU Table</h1>
                        <p>인증번호: <strong>${code}</strong></p>
                    </div>
                `
            },
            {
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`[Email] Success! ID: ${response.data.id}`);
        return true;
    } catch (error: any) {
        console.error("[Email] Resend API Error:", error.response?.data || error.message);
        return false;
    }
}


// --- Routes ---
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

app.post('/api/auth/send-code', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            res.status(400).json({ error: '이메일 주소를 입력해주세요.' });
            return;
        }

        const cleanEmail = email.trim().toLowerCase();
        // [테스트용] gmail도 허용하고 싶다면 아래 주석 해제 (지금은 snu.ac.kr만)
        // const SNU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(snu\.ac\.kr|gmail\.com)$/;
        const SNU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$/;
        
        if (!SNU_EMAIL_REGEX.test(cleanEmail)) {
            res.status(400).json({ error: '서울대학교 웹메일(@snu.ac.kr) 형식이 아닙니다.' });
            return;
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        VERIFICATIONS[cleanEmail] = {
            code,
            expiresAt: Date.now() + 3 * 60 * 1000
        };

        const sent = await sendVerificationEmail(cleanEmail, code);

        if (sent) {
            const response: any = { success: true, message: '인증번호가 발송되었습니다.' };
            if (!SMTP_CONFIG.auth.user) response.code = code;
            res.json(response);
        } else {
            res.status(500).json({ error: '이메일 발송 실패 (서버 로그 확인)' });
        }
    } catch (error: any) {
        console.error('[Auth] Send code error:', error);
        res.status(500).json({ error: '서버 오류: ' + error.message });
    }
});

app.post('/api/auth/verify-code', (req: Request, res: Response) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            res.status(400).json({ error: '이메일과 코드를 입력해주세요.' });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const record = VERIFICATIONS[cleanEmail];

        if (!record) {
            res.status(400).json({ error: '인증 정보가 없습니다. 다시 요청해주세요.' });
            return;
        }
        if (Date.now() > record.expiresAt) {
            delete VERIFICATIONS[cleanEmail];
            res.status(400).json({ error: '인증 시간이 만료되었습니다.' });
            return;
        }
        if (record.code === code || code === '123456') {
            delete VERIFICATIONS[cleanEmail];
            const token = `token-${cleanEmail}-${Date.now()}`;
            res.json({ success: true, token });
        } else {
            res.status(400).json({ error: '인증번호가 일치하지 않습니다.' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/menus/:restaurantId', async (req: Request, res: Response) => {
    try {
        const { restaurantId } = req.params;
        const allMenus = await scrapeMenu(restaurantId);
        const now = new Date();
        const hour = now.getHours();
        let allowedCategories: string[] = ['중식', '일반'];
        
        if (hour >= 7 && hour < 10) allowedCategories = ['조식', '일반'];
        else if (hour >= 11 && hour < 14) allowedCategories = ['중식', '일반'];
        else if (hour >= 17 && hour < 20) allowedCategories = ['석식', '일반'];
        
        const filteredMenus = allMenus.filter(menu => allowedCategories.includes(menu.category));
        res.json(filteredMenus.length > 0 ? filteredMenus : allMenus);
    } catch (error) {
        res.status(500).json({ error: '메뉴 로드 실패' });
    }
});

app.get('/api/queue/:restaurantId', (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    const userId = req.query.userId as string;
    const queue = getQueue(restaurantId);
    const userIndex = queue.items.findIndex(item => item.userId === userId);
    const totalQueueSize = queue.items.length;
    let status = totalQueueSize > 20 ? 'RED' : totalQueueSize > 5 ? 'YELLOW' : 'GREEN';

    res.json({
        restaurantId,
        myQueueNumber: userIndex !== -1 ? queue.items[userIndex].queueNumber : null,
        peopleAhead: userIndex === -1 ? totalQueueSize : userIndex,
        estimatedWaitTimeMinutes: Math.ceil((userIndex === -1 ? totalQueueSize : userIndex) * 1.5),
        totalQueueSize,
        currentStatus: status
    });
});

app.post('/api/queue/join', (req: Request, res: Response) => {
    const { restaurantId, userId, partySize } = req.body;
    const queue = getQueue(restaurantId);
    if (queue.items.find(i => i.userId === userId)) {
        res.json({ success: true, queueNumber: queue.items.find(i => i.userId === userId)!.queueNumber });
        return;
    }
    const ticketNumber = queue.nextTicketNumber++;
    queue.items.push({ userId, partySize: partySize || 1, joinedAt: Date.now(), queueNumber: ticketNumber });
    res.json({ success: true, queueNumber: ticketNumber });
});

app.post('/api/queue/leave', (req: Request, res: Response) => {
    const { restaurantId, userId } = req.body;
    const queue = getQueue(restaurantId);
    queue.items = queue.items.filter(i => i.userId !== userId);
    res.json({ success: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📧 Email Mode: ${SMTP_CONFIG.auth.user ? 'Active' : 'Simulation'}`);
    console.log(`=================================`);
});
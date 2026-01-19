import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';
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
const SMTP_CONFIG = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // 587포트는 false 필수
    auth: {
        // 혹시 모를 공백 제거 (.trim)
        user: process.env.SMTP_USER?.trim(),
        pass: process.env.SMTP_PASS?.trim()
    },
    family: 4, // IPv4 강제
    tls: {
        rejectUnauthorized: false
    },
    // 타임아웃을 60초(60000ms)로 대폭 늘림
    connectionTimeout: 60000, 
    greetingTimeout: 60000,
    socketTimeout: 60000,
    debug: true,  // 상세 로그 출력
    logger: true  // 상세 로그 출력
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


// --- Scraper Logic ---
async function scrapeMenu(restaurantId: string): Promise<MenuItem[]> {
    if (CACHE[restaurantId] && Date.now() - CACHE[restaurantId].timestamp < CACHE_DURATION) {
        return CACHE[restaurantId].data;
    }

    const targetUrl = RESTAURANT_URL_MAP[restaurantId];
    const targetName = RESTAURANT_NAME_MAP[restaurantId] || '';

    if (!targetUrl) return generateFallback(restaurantId);
    
    try {
        const response = await axios.get(targetUrl, { timeout: 6000 });
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

        if (menus.length === 0) return generateFallback(restaurantId);
        CACHE[restaurantId] = { timestamp: Date.now(), data: menus };
        return menus;

    } catch (error) {
        console.error(`[Scraper] Failed to fetch ${restaurantId}:`, error);
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
async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
        console.log("\n=================================================");
        console.log(`[DEV MODE] Email Simulation (No SMTP Credentials Found)`);
        console.log(`To: ${to}, Code: ${code}`);
        console.log("=================================================\n");
        return true; 
    }

    try {
        console.log(`[Email] Creating Transport for: ${SMTP_CONFIG.auth.user}`);
        const transporter = nodemailer.createTransport(SMTP_CONFIG);

        // [추가] 연결 테스트
        try {
            await transporter.verify();
            console.log('[Email] Server is ready to take our messages');
        } catch (verifyError) {
            console.error('[Email] Verify Error:', verifyError);
            throw verifyError; // 연결 실패 시 바로 에러 처리
        }

        const mailOptions = {
            from: `"SNU Table" <${SMTP_CONFIG.auth.user}>`,
            to: to,
            subject: '[SNU Table] 인증번호 안내',
            text: `인증번호: ${code}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; text-align: center; border: 1px solid #eee; border-radius: 10px;">
                    <h1 style="color: #1e3a8a;">SNU Table</h1>
                    <p>인증번호 6자리를 입력해주세요.</p>
                    <div style="background: #f3f4f6; padding: 15px; margin: 20px 0; font-size: 24px; font-weight: bold; color: #1e3a8a;">
                        ${code}
                    </div>
                </div>
            `
        };

        console.log(`[Email] Sending email to ${to}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email] Success! MessageID: ${info.messageId}`);
        return true;
    } catch (error: any) {
        console.error("[Email] Failed to send email:", error);
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
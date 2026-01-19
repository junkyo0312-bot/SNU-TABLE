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
app.use(cors({
    origin: 'https://snu-table.vercel.app', // 본인의 Vercel 주소로 변경
    credentials: true
}));
const PORT = 4000;

// Update CORS to explicitly allow Frontend origin
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
}));

app.use(express.json());

// Request Logging Middleware (Debug purpose)
app.use((req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    next();
});

// --- SMTP Configuration (Environment Variables) ---
// Note: To send real emails, you must provide SMTP_USER and SMTP_PASS in your environment (e.g., .env file)
// For Gmail, enable 2-Factor Auth and use an App Password: https://myaccount.google.com/apppasswords
const SMTP_CONFIG = {
    host: 'smtp.gmail.com',  // 구글 주소를 명확하게!
    port: 465,               // 보안 포트(SSL) 사용!
    secure: true,            // 보안 접속 켜기!
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    // Timeout settings to prevent hanging connections
    connectionTimeout: 10000, // 10 seconds to connect
    greetingTimeout: 10000,   // 10 seconds to wait for greeting
    socketTimeout: 15000      // 15 seconds of inactivity
};

// Debug Log for SMTP Configuration
console.log('--- SMTP Configuration Check ---');
if (process.env.SMTP_USER) {
    console.log(`SMTP_USER: ${process.env.SMTP_USER}`);
} else {
    console.warn('SMTP_USER is missing in process.env');
}
if (process.env.SMTP_PASS) {
    console.log(`SMTP_PASS: ${process.env.SMTP_PASS ? '****** (Set)' : 'Missing'}`);
} else {
    console.warn('SMTP_PASS is missing in process.env');
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
    currentNumber: number; // The number currently being served
    nextTicketNumber: number; // The next number to assign
}

interface VerificationEntry {
    code: string;
    expiresAt: number;
}

// --- Data Stores ---
const QUEUES: Record<string, RestaurantQueue> = {};
const VERIFICATIONS: Record<string, VerificationEntry> = {}; // email -> { code, expiresAt }

// 1. Caching System
interface CacheEntry {
    timestamp: number;
    data: MenuItem[];
}
const CACHE: Record<string, CacheEntry> = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

// Map Frontend IDs to SNUCO URLs
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

// Map ID to Korean Name for filtering rows
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

// Background Worker
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
    // 1. Check Cache
    if (CACHE[restaurantId] && Date.now() - CACHE[restaurantId].timestamp < CACHE_DURATION) {
        return CACHE[restaurantId].data;
    }

    const targetUrl = RESTAURANT_URL_MAP[restaurantId];
    const targetName = RESTAURANT_NAME_MAP[restaurantId] || '';

    // If no URL mapped, use fallback immediately
    if (!targetUrl) return generateFallback(restaurantId);
    
    try {
        const response = await axios.get(targetUrl, { timeout: 6000 });
        const $ = cheerio.load(response.data);
        const menus: MenuItem[] = [];

        // SNUCO structure: <tbody> <tr> ... </tr> </tbody>
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

                    // 운영시간, 혼잡시간, 예약문의 등 정보성 텍스트 제외
                    const excludePatterns = [
                        /^※\s*/,  // ※로 시작하는 줄
                        /운영시간/i,
                        /혼잡시간/i,
                        /예약문의/i,
                        /라스트오더/i,
                        /브레이크타임/i,
                        /위 메뉴외에도/i,
                        /다양한 메뉴가/i,
                        /준비되어 있습니다/i,
                        /메\s*뉴/i,  // "메 뉴" 같은 헤더
                        /사\s*이\s*드/i,  // "사 이 드" 같은 헤더
                        /^<.*>$/  // HTML 태그만 있는 경우
                    ];

                    // 제외 패턴 체크
                    if (excludePatterns.some(pattern => pattern.test(cleanText))) {
                        return;
                    }

                    // 메뉴 이름과 가격 패턴: "메뉴이름 : 가격원" 또는 "메뉴이름 : 가격 원" 형식
                    // 또는 "메뉴이름가격원" 형식도 허용
                    const menuPattern = /^(.+?)\s*[:：]\s*([0-9,]+)\s*원?$/;
                    const simplePattern = /^(.+?)([0-9,]+)\s*원?$/;
                    
                    let name = '';
                    let price = 0;
                    let match = cleanText.match(menuPattern);
                    
                    if (match) {
                        name = match[1].trim();
                        price = parseInt(match[2].replace(/,/g, ''), 10);
                    } else {
                        // 간단한 패턴 시도
                        match = cleanText.match(simplePattern);
                        if (match) {
                            name = match[1].trim();
                            price = parseInt(match[2].replace(/,/g, ''), 10);
                        } else {
                            // 가격만 있는 경우 (예: "4,500원")
                            const priceOnlyMatch = cleanText.match(/^([0-9,]+)\s*원?$/);
                            if (priceOnlyMatch) {
                                return; // 가격만 있고 메뉴 이름이 없으면 제외
                            }
                            return; // 패턴에 맞지 않으면 제외
                        }
                    }

                    // 유효성 검사
                    if (price < 1000 || price > 100000) {
                        // 가격이 너무 낮거나 높으면 제외 (1000원 미만 또는 100000원 초과)
                        return;
                    }

                    if (name.length < 1) {
                        return;
                    }

                    // 메뉴 이름 정리: 괄호 안의 내용, 특수문자 제거
                    name = name
                        .replace(/\[.*?\]/g, '')  // [조식], [중식] 등 제거
                        .replace(/\(.*?\)/g, '')  // 괄호 안 내용 제거
                        .replace(/※/g, '')  // ※ 제거
                        .replace(/\s+/g, ' ')  // 연속 공백을 하나로
                        .trim();

                    if (name.length < 1) {
                        return;
                    }

                    // 카테고리 결정
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

        // 캐시에는 모든 메뉴를 저장 (시간대별 필터링은 API 응답 시 수행)
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
    // Check if Credentials exist
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
        console.log("\n=================================================");
        console.log(`[DEV MODE] Email Simulation (No SMTP Credentials Found)`);
        console.log(`To receive real emails, set SMTP_USER and SMTP_PASS environment variables.`);
        console.log(`To: ${to}`);
        console.log(`Code: ${code}`);
        console.log("=================================================\n");
        return true; 
    }

    try {
        console.log(`[Email] Initializing SMTP transport for user: ${SMTP_CONFIG.auth.user}...`);
        const transporter = nodemailer.createTransport(SMTP_CONFIG);

        const mailOptions = {
            from: `"SNU Table" <${SMTP_CONFIG.auth.user}>`,
            to: to,
            subject: '[SNU Table] 인증번호 안내',
            text: `안녕하세요.\nSNU Table 인증번호는 [${code}] 입니다.\n3분 내에 입력해주세요.`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; text-align: center; border: 1px solid #eee; border-radius: 10px;">
                    <h1 style="color: #1e3a8a;">SNU Table</h1>
                    <p>안녕하세요, 서울대학교 학식 웨이팅 서비스입니다.</p>
                    <p>아래 인증번호 6자리를 입력해주세요.</p>
                    <div style="background: #f3f4f6; padding: 15px; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1e3a8a;">
                        ${code}
                    </div>
                    <p style="color: #888; font-size: 12px;">3분 내에 입력하지 않으면 만료됩니다.</p>
                </div>
            `
        };

        console.log(`[Email] Sending email to ${to}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email] Sent real verification email to ${to}. MessageID: ${info.messageId}`);
        return true;
    } catch (error: any) {
        console.error("[Email] Failed to send email:", error);
        console.error("Debug Info:");
        console.error("- SMTP_USER Set:", !!SMTP_CONFIG.auth.user);
        console.error("- SMTP_PASS Set:", !!SMTP_CONFIG.auth.pass);
        console.error("- Error Message:", error.message);
        console.error("- Error Code:", error.code);
        return false;
    }
}


// --- Routes ---

const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// Auth API - Send Code
app.post('/api/auth/send-code', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        
        if (!email || typeof email !== 'string') {
            res.status(400).json({ error: '이메일 주소를 입력해주세요.' });
            return;
        }

        const cleanEmail = email.trim().toLowerCase();
        
        // 이메일 형식 검증 (프론트엔드와 동일한 정규식 사용)
        const SNU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$/;
        if (!SNU_EMAIL_REGEX.test(cleanEmail)) {
            res.status(400).json({ error: '서울대학교 웹메일(@snu.ac.kr) 형식이 아닙니다.' });
            return;
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        VERIFICATIONS[cleanEmail] = {
            code,
            expiresAt: Date.now() + 3 * 60 * 1000 // 3 minutes
        };

        console.log(`[Auth] 인증 코드 생성: ${cleanEmail} -> ${code}`);

        const sent = await sendVerificationEmail(cleanEmail, code);

        if (sent) {
            // 개발 모드에서는 응답에 코드 포함 (프로덕션에서는 제거)
            const response: any = { 
                success: true, 
                message: '인증번호가 발송되었습니다.' 
            };
            
            // SMTP 설정이 없으면 개발 모드로 간주하고 코드 반환
            if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
                response.code = code; // 개발 모드에서만 코드 반환
                console.log(`[Auth] 개발 모드: 인증 코드를 응답에 포함했습니다.`);
            }
            
            res.json(response);
        } else {
            res.status(500).json({ error: '이메일 발송에 실패했습니다. 서버 로그를 확인해주세요.' });
        }
    } catch (error: any) {
        console.error('[Auth] Send code error:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다: ' + (error.message || 'Unknown error') });
    }
});

// Auth API - Verify Code
app.post('/api/auth/verify-code', (req: Request, res: Response) => {
    try {
        const { email, code } = req.body;
        
        if (!email || typeof email !== 'string') {
            res.status(400).json({ error: '이메일 주소를 입력해주세요.' });
            return;
        }

        if (!code || typeof code !== 'string' || code.length !== 6) {
            res.status(400).json({ error: '6자리 인증번호를 입력해주세요.' });
            return;
        }

        const cleanEmail = email.trim().toLowerCase();
        const record = VERIFICATIONS[cleanEmail];

        // Check if record exists
        if (!record) {
            console.log(`[Auth] 인증 시도 실패: ${cleanEmail} - 인증 정보 없음`);
            res.status(400).json({ error: '인증 정보가 없습니다. 인증번호를 다시 요청해주세요.' });
            return;
        }

        // Check expiration
        if (Date.now() > record.expiresAt) {
            delete VERIFICATIONS[cleanEmail];
            console.log(`[Auth] 인증 시도 실패: ${cleanEmail} - 시간 만료`);
            res.status(400).json({ error: '인증 시간이 만료되었습니다. 인증번호를 다시 요청해주세요.' });
            return;
        }

        // Check code match (Or allow master key '123456' for demo/admin)
        if (record.code === code || code === '123456') {
            delete VERIFICATIONS[cleanEmail]; // Verify once
            const token = `token-${cleanEmail}-${Date.now()}`;
            console.log(`[Auth] 인증 성공: ${cleanEmail}`);
            res.json({ success: true, token });
        } else {
            console.log(`[Auth] 인증 시도 실패: ${cleanEmail} - 코드 불일치 (입력: ${code}, 기대: ${record.code})`);
            res.status(400).json({ error: '인증번호가 올바르지 않습니다.' });
        }
    } catch (error: any) {
        console.error('[Auth] Verify code error:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다: ' + (error.message || 'Unknown error') });
    }
});

// Menu API
app.get('/api/menus/:restaurantId', async (req: Request, res: Response) => {
    try {
        const { restaurantId } = req.params;
        const allMenus = await scrapeMenu(restaurantId);
        
        // 현재 시간에 맞는 메뉴만 필터링
        const now = new Date();
        const hour = now.getHours();
        
        let allowedCategories: string[] = [];
        
        if (hour >= 7 && hour < 10) {
            // 조식 시간대: 7:00 ~ 10:00
            allowedCategories = ['조식', '일반'];
        } else if (hour >= 11 && hour < 14) {
            // 중식 시간대: 11:00 ~ 14:00
            allowedCategories = ['중식', '일반'];
        } else if (hour >= 17 && hour < 20) {
            // 석식 시간대: 17:00 ~ 20:00
            allowedCategories = ['석식', '일반'];
        } else {
            // 그 외 시간대: 기본적으로 중식 메뉴 표시
            allowedCategories = ['중식', '일반'];
        }
        
        const filteredMenus = allMenus.filter(menu => allowedCategories.includes(menu.category));
        
        // 필터링 후 메뉴가 없으면 전체 메뉴 반환 (안전장치)
        const data = filteredMenus.length > 0 ? filteredMenus : allMenus;
        
        res.json(data);
    } catch (error: any) {
        console.error('[Menu API] Error:', error);
        res.status(500).json({ error: '메뉴를 가져오는 중 오류가 발생했습니다.' });
    }
});

// Queue APIs
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
    if (!restaurantId || !userId) {
         res.status(400).json({ error: "Missing fields" });
         return;
    }
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

// [기존 코드 대신 아래 코드로 덮어씌우세요]
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`🚀 SNU Table Server running on port ${PORT}`);
    console.log(`📧 Email Service: ${SMTP_CONFIG.auth.user ? 'Active' : 'Simulation Mode'}`);
    console.log(`=================================`);
}).on('error', (err: any) => {
    // ... (에러 처리 코드는 그대로 두셔도 됩니다) ...
    if (err.code === 'EADDRINUSE') {
        // ...
        process.exit(1);
    } else {
        console.error('서버 시작 오류:', err);
        process.exit(1);
    }
});
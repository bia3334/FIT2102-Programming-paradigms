# 🎮 Trò Chơi Flappy Bird - Tài Liệu Hàm Chi Tiết

## 📋 Mục Lục
1. [Hằng Số & Kiểu Dữ Liệu](#hằng-số--kiểu-dữ-liệu)
2. [Hệ Thống RNG](#hệ-thống-rng)
3. [Quản Lý Trạng Thái](#quản-lý-trạng-thái)
4. [Các Hàm Logic Game](#các-hàm-logic-game)
5. [Observable Streams](#observable-streams)
6. [Các Hàm Rendering](#các-hàm-rendering)
7. [Main Game Stream](#main-game-stream)

---

## 🔧 Hằng Số & Kiểu Dữ Liệu

### **Hằng Số**
```typescript
const Viewport = {
    CANVAS_WIDTH: 600,
    CANVAS_HEIGHT: 400,
} as const;

const Birb = {
    WIDTH: 42,
    HEIGHT: 30,
    INITIAL_X: Viewport.CANVAS_WIDTH * 0.3,
    INITIAL_Y: Viewport.CANVAS_HEIGHT / 2,
} as const;

const Constants = {
    PIPE_WIDTH: 50,
    TICK_RATE_MS: 16,        // 60 FPS
    PIPE_SPEED: 2,
    PIPE_SPAWN_X: Viewport.CANVAS_WIDTH,
    INITIAL_LIVES: 3,
    RNG_SEED: 1234,
} as const;
```

**Mục đích:** Các giá trị cấu hình không đổi cho kích thước game, vật lý và hành vi.

### **Định Nghĩa Kiểu Dữ Liệu**

#### **Kiểu Pipe**
```typescript
type Pipe = Readonly<{
    id: number;           // Định danh duy nhất
    x: number;            // Vị trí ngang
    gapY: number;         // Vị trí trung tâm gap Y
    gapHeight: number;    // Chiều cao gap tính bằng pixel
    passed: boolean;      // Chim đã bay qua pipe này chưa
}>;

type PipeTemplate = Readonly<{
    gapY: number;         // Trung tâm gap (phần của chiều cao canvas)
    gapHeight: number;    // Chiều cao gap (phần của chiều cao canvas)
    time: number;         // Thời gian spawn tính bằng giây
}>;
```

#### **Kiểu Ghost Bird**
```typescript
type BirdPosition = Readonly<{
    x: number;            // Vị trí X của chim
    y: number;            // Vị trí Y của chim
    time: number;         // Thời gian game khi ghi lại
}>;

type GhostBird = Readonly<{
    x: number;            // Vị trí X hiện tại
    y: number;            // Vị trí Y hiện tại
    visible: boolean;     // Ghost có hiển thị không
    opacity: number;      // Độ trong suốt của ghost (0-1)
}>;
```

#### **Kiểu State**
```typescript
type State = Readonly<{
    bird: { x: number; y: number; vy: number; };  // Vị trí & vận tốc chim
    pipes: readonly Pipe[];                       // Các pipe đang hoạt động
    pipeTemplates: readonly PipeTemplate[];       // Dữ liệu pipe từ CSV
    spawnedPipeTimes: readonly number[];          // Theo dõi các pipe đã spawn
    gameTime: number;                             // Thời gian game hiện tại
    nextPipeId: number;                           // ID pipe tiếp theo
    lives: number;                                // Số mạng còn lại
    rngSeed: number;                              // Seed RNG hiện tại
    gameEnd: boolean;                             // Cờ kết thúc game
    score: number;                                // Điểm hiện tại
}>;
```

---

## 🎲 Hệ Thống RNG

### **Lớp RNG**
```typescript
abstract class RNG {
    private static m = 0x80000000; // 2^31
    private static a = 1103515245;
    private static c = 12345;

    public static hash = (seed: number): number =>
        (RNG.a * seed + RNG.c) % RNG.m;

    public static scale = (hash: number): number =>
        (2 * hash) / (RNG.m - 1) - 1; // trong [-1, 1]
}
```

**Mục đích:** Tạo số ngẫu nhiên xác định sử dụng Linear Congruential Generator (LCG).

**Cách sử dụng:**
- **`hash(seed)`**: Tạo seed tiếp theo trong chuỗi
- **`scale(hash)`**: Chuyển đổi hash thành giá trị trong khoảng [-1, 1]

**Tại sao xác định?**
- Cho phép gameplay có thể tái tạo để test
- Hỗ trợ ghost bird replay với bounces giống hệt
- Duy trì tính thuần túy của functional programming

---

## 🏗️ Quản Lý Trạng Thái

### **createInitialState**
```typescript
const createInitialState = (pipeTemplates: readonly PipeTemplate[]): State => ({
    bird: {
        x: Birb.INITIAL_X,
        y: Birb.INITIAL_Y,
        vy: 0,
    },
    pipes: [],
    pipeTemplates,
    spawnedPipeTimes: [],
    gameTime: 0,
    nextPipeId: 0,
    lives: Constants.INITIAL_LIVES,
    rngSeed: Constants.RNG_SEED,
    gameEnd: false,
    score: 0,
});
```

**Mục đích:** Tạo trạng thái game ban đầu với các giá trị mặc định.

**Tham số:**
- `pipeTemplates`: Dữ liệu CSV đã parse cho việc tạo pipe

**Trả về:** Đối tượng trạng thái ban đầu hoàn chỉnh

---

## 🎮 Các Hàm Logic Game

### **parsePipeTemplates**
```typescript
const parsePipeTemplates = (csvContent: string): readonly PipeTemplate[] => {
    const lines = csvContent.trim().split("\n").slice(1);
    return lines.map(line => {
        const [gapY, gapHeight, time] = line.split(",").map(Number);
        return { gapY, gapHeight, time };
    });
};
```

**Mục đích:** Parse nội dung CSV thành các đối tượng pipe template.

**Quy trình:**
1. Chia CSV thành các dòng
2. Bỏ qua dòng header (`slice(1)`)
3. Parse mỗi dòng thành `gapY`, `gapHeight`, `time`
4. Trả về mảng các đối tượng `PipeTemplate`

### **checkCollisions**
```typescript
const checkCollisions = (
    bird: State["bird"],
    pipes: readonly Pipe[],
    rngSeed: number,
): CollisionInfo => {
    // Kiểm tra collision với boundary
    // Kiểm tra collision với pipe
    // Trả về thông tin collision với RNG seed mới
};
```

**Mục đích:** Phát hiện collision giữa chim và boundary/pipe.

**Tham số:**
- `bird`: Trạng thái chim hiện tại
- `pipes`: Mảng các pipe đang hoạt động
- `rngSeed`: Seed RNG hiện tại

**Trả về:** `CollisionInfo` với:
- `hasCollision`: Có xảy ra collision không
- `bounceUp`: Hướng bounce (true = lên, false = xuống)
- `rngSeed`: Seed đã cập nhật cho giá trị random tiếp theo

**Các loại collision:**
1. **Boundary collisions**: Trên/dưới màn hình
2. **Pipe collisions**: Nửa trên/dưới của pipe

### **tick**
```typescript
const tick = (s: State) => {
    if (s.gameEnd) return s;
    
    // Cập nhật thời gian game
    // Áp dụng trọng lực cho chim
    // Spawn pipe mới
    // Di chuyển pipe hiện có
    // Kiểm tra collision
    // Cập nhật điểm
    // Xác định kết thúc game
    // Trả về trạng thái mới
};
```

**Mục đích:** Hàm cập nhật game chính được gọi mỗi frame.

**Quy trình:**
1. **Cập nhật thời gian**: Tăng thời gian game theo tick rate
2. **Vật lý**: Áp dụng trọng lực cho vận tốc chim
3. **Quản lý pipe**: Spawn pipe mới, di chuyển pipe hiện có
4. **Phát hiện collision**: Kiểm tra collision và xử lý bounce
5. **Tính điểm**: Trao điểm cho pipe đã bay qua
6. **Kết thúc game**: Kiểm tra điều kiện thắng/thua

**Tính năng chính:**
- **Tentative State Pattern**: Tính vị trí chim trước khi giải quyết collision
- **Random Bounces**: Sử dụng RNG cho vận tốc bounce collision
- **Hệ thống mạng**: Giảm mạng khi collision
- **Theo dõi điểm**: Trao điểm cho pipe đã bay qua thành công

### **jump**
```typescript
const jump = (s: State): State => {
    if (s.gameEnd) return s;

    const JUMP_VELOCITY = -4;
    return {
        ...s,
        bird: {
            ...s.bird,
            vy: JUMP_VELOCITY,
        },
    };
};
```

**Mục đích:** Xử lý chim nhảy khi nhấn spacebar.

**Tham số:**
- `s`: Trạng thái game hiện tại

**Trả về:** Trạng thái đã cập nhật với vận tốc chim mới

**Hành vi:**
- Đặt vận tốc dọc của chim thành -4 (lên trên)
- Chỉ hoạt động khi game chưa kết thúc
- Hàm thuần túy - không có side effects

---

## 🔄 Observable Streams

### **Ghost Bird Streams**

#### **Biến Stream Toàn Cục**
```typescript
const gamePositionStreams$ = new Subject<BehaviorSubject<BirdPosition[]>>();
let currentGamePositions: BirdPosition[] = [];
let currentGameRecording$: BehaviorSubject<BirdPosition[]>;
const gameTime$ = new BehaviorSubject<number>(0);
```

**Mục đích:** Quản lý hệ thống ghi lại và replay ghost bird.

**Vai trò Stream:**
- **`gamePositionStreams$`**: Subject phát ra các recording game mới
- **`currentGamePositions`**: Mảng lưu vị trí chim của game hiện tại
- **`currentGameRecording$`**: BehaviorSubject cho vị trí chim của game hiện tại
- **`gameTime$`**: Nguồn thời gian trung tâm cho đồng bộ ghost

#### **allGameStreams$**
```typescript
const allGameStreams$ = gamePositionStreams$.pipe(
    scan(
        (acc, stream$) => [...acc, stream$],
        [] as BehaviorSubject<BirdPosition[]>[]
    ),
    switchMap(
        streams => (streams.length ? combineLatest(streams) : of([]))
    ),
);
```

**Mục đích:** Kết hợp tất cả game recording thành một stream duy nhất.

**Cách sử dụng Observable:**
- **`scan`**: Tích lũy tất cả game recording streams
- **`switchMap`**: Chuyển sang stream kết hợp của tất cả recording
- **`combineLatest`**: Phát ra giá trị mới nhất từ tất cả game streams
- **`of([])`**: Trả về mảng rỗng khi chưa có game nào

#### **createGhostFromRecording**
```typescript
const createGhostFromRecording = (
    gamePositions: BirdPosition[],
    opacity: number,
): Observable<GhostBird> => {
    return gameTime$.pipe(
        map(currentTime => {
            const matchingPosition = gamePositions.find(pos => {
                const timeDiff = Math.abs(pos.time - currentTime);
                return timeDiff < 0.2; // Dung sai 200ms
            });

            if (matchingPosition) {
                return {
                    x: matchingPosition.x,
                    y: matchingPosition.y,
                    visible: true,
                    opacity,
                };
            } else {
                return {
                    x: 0,
                    y: 0,
                    visible: false,
                    opacity,
                };
            }
        }),
    );
};
```

**Mục đích:** Tạo observable cho một ghost bird từ recording.

**Cách sử dụng Observable:**
- **`gameTime$.pipe()`**: Đăng ký vào stream thời gian trung tâm
- **`map`**: Chuyển đổi thời gian thành vị trí ghost bird
- **Time Matching**: Tìm vị trí trong dung sai 200ms
- **Visibility Logic**: Hiển thị/ẩn ghost dựa trên khớp thời gian

#### **createGhostBirds$**
```typescript
const createGhostBirds$ = (): Observable<GhostBird[]> => {
    return allGameStreams$.pipe(
        switchMap((allGamePositions: BirdPosition[][]) => {
            if (allGamePositions.length === 0) {
                return of([]);
            }

            const ghostObservables = allGamePositions.map(
                (gamePositions: BirdPosition[], index: number) => {
                    return createGhostFromRecording(
                        gamePositions,
                        0.2 + (index % 5) * 0.1,
                    );
                },
            );

            return combineLatest(ghostObservables);
        }),
    );
};
```

**Mục đích:** Tạo observable cho tất cả ghost birds từ tất cả recording.

**Cách sử dụng Observable:**
- **`allGameStreams$.pipe()`**: Đăng ký vào combined game streams
- **`switchMap`**: Chuyển sang combination ghost mới khi games thay đổi
- **`map`**: Tạo ghost observable cho mỗi game recording
- **`combineLatest`**: Kết hợp tất cả ghost observables thành mảng duy nhất
- **Opacity Variation**: Opacity khác nhau cho mỗi ghost (0.2, 0.3, 0.4, 0.5, 0.6)

---

## 🎨 Các Hàm Rendering

### **Các Hàm Helper SVG**

#### **createSvgElement**
```typescript
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
): SVGElement => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};
```

**Mục đích:** Tạo các phần tử SVG với thuộc tính.

**Tham số:**
- `namespace`: URI namespace SVG
- `name`: Tên tag phần tử
- `props`: Các thuộc tính cần đặt

**Trả về:** Phần tử SVG đã cấu hình

#### **show/hide**
```typescript
const show = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "visible");
    bringToForeground(elem);
};

const hide = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "hidden");
};
```

**Mục đích:** Điều khiển khả năng hiển thị phần tử.

**Side Effects:** Sửa đổi thuộc tính phần tử DOM

### **render**
```typescript
const render = (): ((s: State) => void) => {
    // Tạo các phần tử DOM một lần
    // Thiết lập subscription ghost bird
    // Trả về hàm render
};
```

**Mục đích:** Thiết lập hệ thống rendering và trả về hàm render.

**Quy trình:**
1. **DOM Setup**: Tạo chim, ghost birds, container pipes
2. **Ghost Subscription**: Đăng ký vào ghost birds observable
3. **Return Function**: Trả về hàm render state-to-DOM

**Cách sử dụng Observable:**
```typescript
const ghostBirds$ = createGhostBirds$();
ghostBirds$.subscribe(ghosts => {
    // Cập nhật các phần tử DOM ghost bird
    ghostBirdElements.forEach((ghostElement, index) => {
        if (index < ghosts.length && ghosts[index].visible) {
            // Hiển thị và định vị ghost
        } else {
            // Ẩn ghost
        }
    });
});
```

**Hàm Render:**
```typescript
return (s: State) => {
    // Cập nhật vị trí chim
    // Xóa và vẽ lại pipes
    // Cập nhật điểm và mạng
    // Hiển thị/ẩn màn hình game over
};
```

---

## 🎯 Main Game Stream

### **state$**
```typescript
export const state$ = (csvContents: string): Observable<State> => {
    const pipeTemplates = parsePipeTemplates(csvContents);
    
    // Input streams
    const key$ = fromEvent<KeyboardEvent>(document, "keydown");
    const jump$ = key$.pipe(
        filter(({ code }) => code === "Space"),
        map(() => jump),
    );
    const tick$ = interval(Constants.TICK_RATE_MS).pipe(map(() => tick));
    const restart$ = key$.pipe(filter(({ code }) => code === "KeyR"));
    
    // Pause system
    const togglePause$ = key$.pipe(filter(({ code }) => code === "KeyP"));
    const paused$ = merge(
        togglePause$.pipe(map(() => "toggle" as const)),
        restart$.pipe(map(() => "reset" as const)),
    ).pipe(
        startWith("reset" as const),
        scan(
            (paused, action) => (action === "toggle" ? !paused : false),
            false,
        ),
    );
    
    // Main game stream
    const gameStream$ = restart$.pipe(
        startWith(null),
        tap(() => {
            // Reset recording cho game mới
            currentGamePositions = [];
            currentGameRecording$ = new BehaviorSubject<BirdPosition[]>([]);
            gameTime$.next(0);
        }),
        switchMap(() => {
            const initialState = createInitialState(pipeTemplates);
            const updates$ = merge(jump$, tick$).pipe(
                withLatestFrom(paused$),
                filter(([, paused]) => !paused),
                map(([fn]) => fn),
            );
            
            return updates$.pipe(
                scan((state: State, updateFn) => updateFn(state), initialState),
                tap(s => {
                    // Ghi lại vị trí chim
                    // Cập nhật thời gian game
                }),
                pairwise(),
                tap(([prev, curr]) => {
                    // Lưu recording khi game kết thúc
                }),
                map(([, curr]) => curr),
            );
        }),
    );
    
    return gameStream$;
};
```

**Mục đích:** Main Observable stream quản lý toàn bộ trạng thái game.

**Cách sử dụng Observable:**

#### **Input Streams**
- **`key$`**: Tất cả sự kiện bàn phím
- **`jump$`**: Nhấn phím Space → hàm jump
- **`tick$`**: Timer interval → hàm tick
- **`restart$`**: Nhấn phím R → restart game

#### **Hệ Thống Pause**
```typescript
const paused$ = merge(
    togglePause$.pipe(map(() => "toggle" as const)),
    restart$.pipe(map(() => "reset" as const)),
).pipe(
    startWith("reset" as const),
    scan(
        (paused, action) => (action === "toggle" ? !paused : false),
        false,
    ),
);
```
- **`merge`**: Kết hợp pause toggle và restart events
- **`startWith`**: Khởi tạo với action "reset"
- **`scan`**: Tích lũy trạng thái pause
- **`withLatestFrom`**: Gate updates dựa trên trạng thái pause

#### **Game Stream**
```typescript
const gameStream$ = restart$.pipe(
    startWith(null),
    tap(() => {
        // Reset recording cho game mới
    }),
    switchMap(() => {
        // Tạo instance game mới
    }),
);
```
- **`restart$.pipe()`**: Restart game khi nhấn R
- **`startWith(null)`**: Bắt đầu game đầu tiên ngay lập tức
- **`tap`**: Side effects cho recording reset
- **`switchMap`**: Chuyển sang instance game mới

#### **State Updates**
```typescript
return updates$.pipe(
    scan((state: State, updateFn) => updateFn(state), initialState),
    tap(s => {
        // Ghi lại vị trí chim
        // Cập nhật thời gian game
    }),
    pairwise(),
    tap(([prev, curr]) => {
        // Lưu recording khi game kết thúc
    }),
    map(([, curr]) => curr),
);
```
- **`scan`**: Tích lũy thay đổi trạng thái
- **`tap`**: Side effects cho recording và time updates
- **`pairwise`**: Phát ra cặp trạng thái trước và hiện tại
- **`map`**: Trích xuất trạng thái hiện tại

### **Main Application Setup**
```typescript
csv$.pipe(
    switchMap(contents =>
        click$.pipe(switchMap(() => state$(contents))),
    ),
).subscribe(render());
```

**Mục đích:** Điểm vào ứng dụng.

**Cách sử dụng Observable:**
- **`csv$`**: Lấy nội dung file CSV
- **`click$`**: Chờ click đầu tiên của user
- **`switchMap`**: Chuyển sang game stream sau click
- **`subscribe(render())`**: Render trạng thái game vào DOM

---

## 🔑 Các Pattern Observable Chính

### **1. State Management với scan**
```typescript
scan((state: State, updateFn) => updateFn(state), initialState)
```
- **Mục đích**: Tích lũy thay đổi trạng thái
- **Pattern**: Reducer pattern với pure functions
- **Lợi ích**: Cập nhật trạng thái immutable, luồng trạng thái dự đoán được

### **2. Stream Composition với merge**
```typescript
merge(jump$, tick$)
```
- **Mục đích**: Kết hợp nhiều event streams
- **Pattern**: Event aggregation
- **Lợi ích**: Một stream duy nhất cho nhiều nguồn input

### **3. Conditional Updates với filter**
```typescript
filter(([, paused]) => !paused)
```
- **Mục đích**: Gate updates dựa trên điều kiện
- **Pattern**: Conditional stream processing
- **Lợi ích**: Chức năng pause, điều khiển trạng thái game

### **4. Side Effects với tap**
```typescript
tap(s => {
    // Ghi lại vị trí chim
    // Cập nhật thời gian game
})
```
- **Mục đích**: Thực hiện side effects mà không thay đổi stream
- **Pattern**: Side effect isolation
- **Lợi ích**: Giữ pure functions thuần túy, quản lý side effects

### **5. Stream Switching với switchMap**
```typescript
switchMap(() => {
    // Tạo instance game mới
})
```
- **Mục đích**: Chuyển sang stream mới khi restart
- **Pattern**: Stream lifecycle management
- **Lợi ích**: Game restarts sạch sẽ, quản lý memory

### **6. Time-based Coordination**
```typescript
gameTime$.next(s.gameTime);
```
- **Mục đích**: Đồng bộ ghost birds với game hiện tại
- **Pattern**: Central time source
- **Lợi ích**: Đồng bộ ghost hoàn hảo, độ chính xác replay

---

## 🎯 Tóm Tắt

Implementation Flappy Bird này thể hiện các khái niệm **Functional Reactive Programming** nâng cao:

### **Nguyên Tắc Cốt Lõi**
- **Pure Functions**: Tất cả hàm logic game đều thuần túy
- **Immutable State**: Cập nhật trạng thái sử dụng spread operators
- **Observable Streams**: Trạng thái game được quản lý qua RxJS
- **Side Effect Isolation**: Thao tác DOM được chứa trong hàm render

### **Tính Năng Nâng Cao**
- **Ghost Bird System**: Replay multi-game sử dụng stream composition phức tạp
- **Deterministic RNG**: Gameplay có thể tái tạo để test
- **Pause System**: Conditional stream processing
- **State Persistence**: Game recordings tồn tại qua restarts

### **Observable Mastery**
- **Stream Composition**: merge, switchMap, combineLatest
- **State Accumulation**: scan operator cho state management
- **Side Effect Management**: tap cho recording và time updates
- **Conditional Processing**: filter cho pause functionality
- **Time Coordination**: BehaviorSubject cho ghost synchronization

Implementation này cho thấy cách **Observables** có thể quản lý trạng thái game phức tạp trong khi duy trì các nguyên tắc **functional programming** và cho phép các tính năng nâng cao như hệ thống ghost replay.

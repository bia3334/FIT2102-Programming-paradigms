# 🎮 Flappy Bird Game - Complete Function Documentation

## 📋 Table of Contents
1. [Constants & Types](#constants--types)
2. [RNG System](#rng-system)
3. [State Management](#state-management)
4. [Game Logic Functions](#game-logic-functions)
5. [Observable Streams](#observable-streams)
6. [Rendering Functions](#rendering-functions)
7. [Main Game Stream](#main-game-stream)

---

## 🔧 Constants & Types

### **Constants**
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

**Purpose:** Immutable configuration values for game dimensions, physics, and behavior.

### **Type Definitions**

#### **Pipe Types**
```typescript
type Pipe = Readonly<{
    id: number;           // Unique identifier
    x: number;            // Horizontal position
    gapY: number;         // Gap center Y position
    gapHeight: number;    // Gap height in pixels
    passed: boolean;      // Whether bird has passed this pipe
}>;

type PipeTemplate = Readonly<{
    gapY: number;         // Gap center (fraction of canvas height)
    gapHeight: number;    // Gap height (fraction of canvas height)
    time: number;         // Spawn time in seconds
}>;
```

#### **Ghost Bird Types**
```typescript
type BirdPosition = Readonly<{
    x: number;            // Bird X position
    y: number;            // Bird Y position
    time: number;         // Game time when recorded
}>;

type GhostBird = Readonly<{
    x: number;            // Current X position
    y: number;            // Current Y position
    visible: boolean;     // Whether ghost is visible
    opacity: number;      // Ghost transparency (0-1)
}>;
```

#### **State Type**
```typescript
type State = Readonly<{
    bird: { x: number; y: number; vy: number; };  // Bird position & velocity
    pipes: readonly Pipe[];                       // Active pipes
    pipeTemplates: readonly PipeTemplate[];       // CSV pipe data
    spawnedPipeTimes: readonly number[];          // Track spawned pipes
    gameTime: number;                             // Current game time
    nextPipeId: number;                           // Next pipe ID
    lives: number;                                // Remaining lives
    rngSeed: number;                              // Current RNG seed
    gameEnd: boolean;                             // Game over flag
    score: number;                                // Current score
}>;
```

---

## 🎲 RNG System

### **RNG Class**
```typescript
abstract class RNG {
    private static m = 0x80000000; // 2^31
    private static a = 1103515245;
    private static c = 12345;

    public static hash = (seed: number): number =>
        (RNG.a * seed + RNG.c) % RNG.m;

    public static scale = (hash: number): number =>
        (2 * hash) / (RNG.m - 1) - 1; // in [-1, 1]
}
```

**Purpose:** Deterministic random number generation using Linear Congruential Generator (LCG).

**Usage:**
- **`hash(seed)`**: Generates next seed in sequence
- **`scale(hash)`**: Converts hash to value in range [-1, 1]

**Why Deterministic?**
- Enables reproducible gameplay for testing
- Supports ghost bird replay with identical bounces
- Maintains functional programming purity

---

## 🏗️ State Management

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

**Purpose:** Creates initial game state with default values.

**Parameters:**
- `pipeTemplates`: Parsed CSV data for pipe generation

**Returns:** Complete initial state object

---

## 🎮 Game Logic Functions

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

**Purpose:** Parses CSV content into pipe template objects.

**Process:**
1. Split CSV into lines
2. Skip header row (`slice(1)`)
3. Parse each line into `gapY`, `gapHeight`, `time`
4. Return array of `PipeTemplate` objects

### **checkCollisions**
```typescript
const checkCollisions = (
    bird: State["bird"],
    pipes: readonly Pipe[],
    rngSeed: number,
): CollisionInfo => {
    // Boundary collision checks
    // Pipe collision checks
    // Returns collision info with new RNG seed
};
```

**Purpose:** Detects collisions between bird and boundaries/pipes.

**Parameters:**
- `bird`: Current bird state
- `pipes`: Array of active pipes
- `rngSeed`: Current RNG seed

**Returns:** `CollisionInfo` with:
- `hasCollision`: Whether collision occurred
- `bounceUp`: Direction of bounce (true = up, false = down)
- `rngSeed`: Updated seed for next random value

**Collision Types:**
1. **Boundary collisions**: Top/bottom of screen
2. **Pipe collisions**: Top/bottom halves of pipes

### **tick**
```typescript
const tick = (s: State) => {
    if (s.gameEnd) return s;
    
    // Update game time
    // Apply gravity to bird
    // Spawn new pipes
    // Move existing pipes
    // Check collisions
    // Update score
    // Determine game end
    // Return new state
};
```

**Purpose:** Main game update function called every frame.

**Process:**
1. **Time Update**: Increment game time by tick rate
2. **Physics**: Apply gravity to bird velocity
3. **Pipe Management**: Spawn new pipes, move existing ones
4. **Collision Detection**: Check for collisions and handle bounces
5. **Scoring**: Award points for passed pipes
6. **Game End**: Check win/lose conditions

**Key Features:**
- **Tentative State Pattern**: Calculates bird position before collision resolution
- **Random Bounces**: Uses RNG for collision bounce velocities
- **Lives System**: Decrements lives on collision
- **Score Tracking**: Awards points for successfully passed pipes

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

**Purpose:** Handles bird jump when spacebar is pressed.

**Parameters:**
- `s`: Current game state

**Returns:** Updated state with new bird velocity

**Behavior:**
- Sets bird vertical velocity to -4 (upward)
- Only works when game is not ended
- Pure function - no side effects

---

## 🔄 Observable Streams

### **Ghost Bird Streams**

#### **Global Stream Variables**
```typescript
const gamePositionStreams$ = new Subject<BehaviorSubject<BirdPosition[]>>();
let currentGamePositions: BirdPosition[] = [];
let currentGameRecording$: BehaviorSubject<BirdPosition[]>;
const gameTime$ = new BehaviorSubject<number>(0);
```

**Purpose:** Manage ghost bird recording and replay system.

**Stream Roles:**
- **`gamePositionStreams$`**: Subject that emits new game recordings
- **`currentGamePositions`**: Array storing current game's bird positions
- **`currentGameRecording$`**: BehaviorSubject for current game's positions
- **`gameTime$`**: Central time source for ghost synchronization

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

**Purpose:** Combines all game recordings into a single stream.

**Observable Usage:**
- **`scan`**: Accumulates all game recording streams
- **`switchMap`**: Switches to combined stream of all recordings
- **`combineLatest`**: Emits latest values from all game streams
- **`of([])`**: Returns empty array when no games exist

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
                return timeDiff < 0.2; // 200ms tolerance
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

**Purpose:** Creates observable for single ghost bird from recording.

**Observable Usage:**
- **`gameTime$.pipe()`**: Subscribes to central time stream
- **`map`**: Transforms time into ghost bird position
- **Time Matching**: Finds position within 200ms tolerance
- **Visibility Logic**: Shows/hides ghost based on time match

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

**Purpose:** Creates observable for all ghost birds from all recordings.

**Observable Usage:**
- **`allGameStreams$.pipe()`**: Subscribes to combined game streams
- **`switchMap`**: Switches to new ghost combination when games change
- **`map`**: Creates ghost observable for each game recording
- **`combineLatest`**: Combines all ghost observables into single array
- **Opacity Variation**: Different opacity for each ghost (0.2, 0.3, 0.4, 0.5, 0.6)

---

## 🎨 Rendering Functions

### **SVG Helper Functions**

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

**Purpose:** Creates SVG elements with attributes.

**Parameters:**
- `namespace`: SVG namespace URI
- `name`: Element tag name
- `props`: Attributes to set

**Returns:** Configured SVG element

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

**Purpose:** Controls element visibility.

**Side Effects:** Modifies DOM element attributes

### **render**
```typescript
const render = (): ((s: State) => void) => {
    // Create DOM elements once
    // Set up ghost bird subscription
    // Return render function
};
```

**Purpose:** Sets up rendering system and returns render function.

**Process:**
1. **DOM Setup**: Creates bird, ghost birds, pipes container
2. **Ghost Subscription**: Subscribes to ghost birds observable
3. **Return Function**: Returns state-to-DOM render function

**Observable Usage:**
```typescript
const ghostBirds$ = createGhostBirds$();
ghostBirds$.subscribe(ghosts => {
    // Update ghost bird DOM elements
    ghostBirdElements.forEach((ghostElement, index) => {
        if (index < ghosts.length && ghosts[index].visible) {
            // Show and position ghost
        } else {
            // Hide ghost
        }
    });
});
```

**Render Function:**
```typescript
return (s: State) => {
    // Update bird position
    // Clear and redraw pipes
    // Update score and lives
    // Show/hide game over screen
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
            // Reset recording for new game
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
                    // Record bird positions
                    // Update game time
                }),
                pairwise(),
                tap(([prev, curr]) => {
                    // Save recording when game ends
                }),
                map(([, curr]) => curr),
            );
        }),
    );
    
    return gameStream$;
};
```

**Purpose:** Main Observable stream that manages entire game state.

**Observable Usage:**

#### **Input Streams**
- **`key$`**: All keyboard events
- **`jump$`**: Space key presses → jump function
- **`tick$`**: Timer interval → tick function
- **`restart$`**: R key presses → game restart

#### **Pause System**
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
- **`merge`**: Combines pause toggle and restart events
- **`startWith`**: Initializes with "reset" action
- **`scan`**: Accumulates pause state
- **`withLatestFrom`**: Gates updates based on pause state

#### **Game Stream**
```typescript
const gameStream$ = restart$.pipe(
    startWith(null),
    tap(() => {
        // Reset recording for new game
    }),
    switchMap(() => {
        // Create new game instance
    }),
);
```
- **`restart$.pipe()`**: Restarts game on R key
- **`startWith(null)`**: Starts first game immediately
- **`tap`**: Side effects for recording reset
- **`switchMap`**: Switches to new game instance

#### **State Updates**
```typescript
return updates$.pipe(
    scan((state: State, updateFn) => updateFn(state), initialState),
    tap(s => {
        // Record bird positions
        // Update game time
    }),
    pairwise(),
    tap(([prev, curr]) => {
        // Save recording when game ends
    }),
    map(([, curr]) => curr),
);
```
- **`scan`**: Accumulates state changes
- **`tap`**: Side effects for recording and time updates
- **`pairwise`**: Emits previous and current state pairs
- **`map`**: Extracts current state

### **Main Application Setup**
```typescript
csv$.pipe(
    switchMap(contents =>
        click$.pipe(switchMap(() => state$(contents))),
    ),
).subscribe(render());
```

**Purpose:** Application entry point.

**Observable Usage:**
- **`csv$`**: Fetches CSV file content
- **`click$`**: Waits for first user click
- **`switchMap`**: Switches to game stream after click
- **`subscribe(render())`**: Renders game state to DOM

---

## 🔑 Key Observable Patterns

### **1. State Management with scan**
```typescript
scan((state: State, updateFn) => updateFn(state), initialState)
```
- **Purpose**: Accumulates state changes
- **Pattern**: Reducer pattern with pure functions
- **Benefits**: Immutable state updates, predictable state flow

### **2. Stream Composition with merge**
```typescript
merge(jump$, tick$)
```
- **Purpose**: Combines multiple event streams
- **Pattern**: Event aggregation
- **Benefits**: Single stream for multiple input sources

### **3. Conditional Updates with filter**
```typescript
filter(([, paused]) => !paused)
```
- **Purpose**: Gates updates based on conditions
- **Pattern**: Conditional stream processing
- **Benefits**: Pause functionality, game state control

### **4. Side Effects with tap**
```typescript
tap(s => {
    // Record bird positions
    // Update game time
})
```
- **Purpose**: Performs side effects without changing stream
- **Pattern**: Side effect isolation
- **Benefits**: Keeps pure functions pure, manages side effects

### **5. Stream Switching with switchMap**
```typescript
switchMap(() => {
    // Create new game instance
})
```
- **Purpose**: Switches to new stream on restart
- **Pattern**: Stream lifecycle management
- **Benefits**: Clean game restarts, memory management

### **6. Time-based Coordination**
```typescript
gameTime$.next(s.gameTime);
```
- **Purpose**: Synchronizes ghost birds with current game
- **Pattern**: Central time source
- **Benefits**: Perfect ghost synchronization, replay accuracy

---

## 🎯 Summary

This Flappy Bird implementation demonstrates advanced **Functional Reactive Programming** concepts:

### **Core Principles**
- **Pure Functions**: All game logic functions are pure
- **Immutable State**: State updates use spread operators
- **Observable Streams**: Game state managed through RxJS
- **Side Effect Isolation**: DOM manipulation contained in render function

### **Advanced Features**
- **Ghost Bird System**: Multi-game replay using complex stream composition
- **Deterministic RNG**: Reproducible gameplay for testing
- **Pause System**: Conditional stream processing
- **State Persistence**: Game recordings survive restarts

### **Observable Mastery**
- **Stream Composition**: merge, switchMap, combineLatest
- **State Accumulation**: scan operator for state management
- **Side Effect Management**: tap for recording and time updates
- **Conditional Processing**: filter for pause functionality
- **Time Coordination**: BehaviorSubject for ghost synchronization

This implementation showcases how **Observables** can manage complex game state while maintaining **functional programming** principles and enabling advanced features like ghost replay systems.

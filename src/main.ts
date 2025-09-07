/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import {
    BehaviorSubject,
    Observable,
    Subject,
    catchError,
    combineLatest,
    filter,
    fromEvent,
    interval,
    map,
    merge,
    of,
    withLatestFrom,
    scan,
    startWith,
    switchMap,
    take,
    tap,
    pairwise,
} from "rxjs";
import { fromFetch } from "rxjs/fetch";

/** Constants */

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
    TICK_RATE_MS: 16,
    PIPE_SPEED: 2,
    PIPE_SPAWN_X: Viewport.CANVAS_WIDTH,
    INITIAL_LIVES: 3,
    RNG_SEED: 1234,
} as const;

// Type for pipe
type Pipe = Readonly<{
    id: number;
    x: number;
    gapY: number;
    gapHeight: number;
    passed: boolean;
}>;

type PipeTemplate = Readonly<{
    gapY: number;
    gapHeight: number;
    time: number;
}>;

// Save bird position at one time
type BirdPosition = Readonly<{
    x: number;
    y: number;
    time: number;
}>;

// Type for ghost bird, have position and visible
type GhostBird = Readonly<{
    x: number;
    y: number;
    visible: boolean;
    opacity: number;
}>;

// RNG System
abstract class RNG {
    private static m = 0x80000000; // 2^31
    private static a = 1103515245;
    private static c = 12345;

    public static hash = (seed: number): number =>
        (RNG.a * seed + RNG.c) % RNG.m;

    public static scale = (hash: number): number =>
        (2 * hash) / (RNG.m - 1) - 1; // in [-1, 1]
}

// State processing
type State = Readonly<{
    bird: {
        x: number;
        y: number;
        vy: number; // vertical velocity
    };
    pipes: readonly Pipe[];
    pipeTemplates: readonly PipeTemplate[];
    spawnedPipeTimes: readonly number[];
    gameTime: number;
    nextPipeId: number;
    lives: number;
    rngSeed: number;
    gameEnd: boolean;
    score: number;
}>;

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

// Parse CSV to make pipe template
const parsePipeTemplates = (csvContent: string): readonly PipeTemplate[] => {
    const lines = csvContent.trim().split("\n").slice(1);
    return lines.map(line => {
        const [gapY, gapHeight, time] = line.split(",").map(Number);
        return { gapY, gapHeight, time };
    });
};

// Check bird hit pipe or not, return info
type CollisionInfo = {
    hasCollision: boolean;
    bounceUp: boolean; // true = bounce up, false = bounce down
    rngSeed: number; // updated seed after collision
};

const checkCollisions = (
    bird: State["bird"],
    pipes: readonly Pipe[],
    rngSeed: number,
): CollisionInfo => {
    const birdLeft = bird.x - Birb.WIDTH / 2;
    const birdRight = bird.x + Birb.WIDTH / 2;
    const birdTop = bird.y - Birb.HEIGHT / 2;
    const birdBottom = bird.y + Birb.HEIGHT / 2;

    // Check boundary collisions first
    if (birdTop <= 0) {
        // Hit top of screen
        return {
            hasCollision: true,
            bounceUp: false,
            rngSeed: RNG.hash(rngSeed),
        };
    }
    if (birdBottom >= Viewport.CANVAS_HEIGHT) {
        // Hit bottom of screen
        return {
            hasCollision: true,
            bounceUp: true,
            rngSeed: RNG.hash(rngSeed),
        };
    }

    // Check pipe collisions
    for (const pipe of pipes) {
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + Constants.PIPE_WIDTH;

        // Check if bird overlaps horizontally with pipe
        if (birdRight >= pipeLeft && birdLeft <= pipeRight) {
            const gapTop = pipe.gapY - pipe.gapHeight / 2;
            const gapBottom = pipe.gapY + pipe.gapHeight / 2;

            // Check collision with top half of pipe
            if (birdTop <= gapTop) {
                return {
                    hasCollision: true,
                    bounceUp: false,
                    rngSeed: RNG.hash(rngSeed),
                };
            }
            // Check collision with bottom half of pipe
            if (birdBottom >= gapBottom) {
                return {
                    hasCollision: true,
                    bounceUp: true,
                    rngSeed: RNG.hash(rngSeed),
                };
            }
        }
    }

    return { hasCollision: false, bounceUp: false, rngSeed };
};

// Subject for ghost bird stream
const gamePositionStreams$ = new Subject<BehaviorSubject<BirdPosition[]>>();
let currentGamePositions: BirdPosition[] = [];
let currentGameRecording$: BehaviorSubject<BirdPosition[]>;
const gameTime$ = new BehaviorSubject<number>(0);

// Stream to collect all game record and combine
const allGameStreams$ = gamePositionStreams$.pipe(
    scan(
        (acc, stream$) => [...acc, stream$],
        [] as BehaviorSubject<BirdPosition[]>[],
    ),
    switchMap(
        streams => (streams.length ? combineLatest(streams) : of([])), // Return empty array observable if no streams yet
    ),
);

// Make ghost bird observable from game record
const createGhostFromRecording = (
    gamePositions: BirdPosition[],
    opacity: number,
): Observable<GhostBird> => {
    return gameTime$.pipe(
        map(currentTime => {
            // Find the position that matches current game time (within tolerance)
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

// Make observable for all ghost birds from all game record
const createGhostBirds$ = (): Observable<GhostBird[]> => {
    return allGameStreams$.pipe(
        switchMap((allGamePositions: BirdPosition[][]) => {
            if (allGamePositions.length === 0) {
                return of([]); // Return empty array observable if no games
            }

            // Create ghost observables from each game's positions
            const ghostObservables = allGamePositions.map(
                (gamePositions: BirdPosition[], index: number) => {
                    return createGhostFromRecording(
                        gamePositions,
                        0.2 + (index % 5) * 0.1,
                    );
                },
            );

            // Combine all ghost observables into single array
            return combineLatest(ghostObservables);
        }),
    );
};

// Remove recording helper, move to stream side-effect to keep reducer pure

// Update state for each time step
// s: current state
// return: new state
const tick = (s: State) => {
    if (s.gameEnd) return s;

    // Update game time
    const newGameTime = s.gameTime + Constants.TICK_RATE_MS / 1000;

    // Apply gravity to bird
    const GRAVITY = 0.3;
    const newVy = s.bird.vy + GRAVITY;

    // Calculate new position
    const newY = s.bird.y + newVy;

    // Spawn new pipes based on game time
    const pipesToSpawn = s.pipeTemplates.filter(
        template =>
            template.time <= newGameTime &&
            !s.spawnedPipeTimes.includes(template.time),
    );

    const newPipes = [
        ...s.pipes,
        ...pipesToSpawn.map(template => ({
            id: s.nextPipeId + pipesToSpawn.indexOf(template),
            x: Constants.PIPE_SPAWN_X,
            gapY: template.gapY * Viewport.CANVAS_HEIGHT,
            gapHeight: template.gapHeight * Viewport.CANVAS_HEIGHT,
            passed: false,
        })),
    ];

    // Move existing pipes
    const movedPipes = newPipes.map(pipe => ({
        ...pipe,
        x: pipe.x - Constants.PIPE_SPEED,
    }));

    const filteredPipes = movedPipes.filter(
        pipe => pipe.x > -Constants.PIPE_WIDTH,
    ); // Remove off-screen pipes

    // Create tentative bird state
    const tentativeBird = {
        ...s.bird,
        y: newY,
        vy: newVy,
    };

    // Check collisions with updated collision detection
    const collision = checkCollisions(tentativeBird, filteredPipes, s.rngSeed);

    let finalBird = tentativeBird;
    let newLives = s.lives;
    let newRngSeed = collision.rngSeed;

    if (collision.hasCollision) {
        // Lose a life
        newLives = s.lives - 1;

        // Generate random bounce velocity
        const randomValue = RNG.scale(collision.rngSeed);
        const bounceVelocity = collision.bounceUp
            ? -(3 + Math.abs(randomValue) * 4) // Bounce up: -3 to -7
            : 3 + Math.abs(randomValue) * 4; // Bounce down: +3 to +7

        finalBird = {
            ...s.bird,
            y: Math.max(
                0,
                Math.min(Viewport.CANVAS_HEIGHT - Birb.HEIGHT, newY),
            ),
            vy: bounceVelocity,
        };
    }

    // Update score (bird passed pipe)
    const passedPipes = filteredPipes.filter(
        pipe => !pipe.passed && pipe.x + Constants.PIPE_WIDTH < finalBird.x,
    );
    const newScore = s.score + passedPipes.length;
    const scoredPipes = filteredPipes.map(pipe =>
        passedPipes.includes(pipe) ? { ...pipe, passed: true } : pipe,
    );

    // Game end conditions
    const allPipesNavigated =
        s.pipeTemplates.every(template => template.time <= newGameTime) &&
        scoredPipes.length === 0; // All pipes spawned and cleared

    const gameEnd = newLives <= 0 || allPipesNavigated;

    return {
        ...s,
        bird: finalBird,
        pipes: scoredPipes,
        spawnedPipeTimes: [
            ...s.spawnedPipeTimes,
            ...pipesToSpawn.map(template => template.time),
        ],
        gameTime: newGameTime,
        nextPipeId: s.nextPipeId + pipesToSpawn.length,
        lives: newLives,
        rngSeed: newRngSeed,
        gameEnd,
        score: newScore,
    };
};

/**
 * Handles bird jump when space is pressed
 *
 * @param s Current state
 * @returns Updated state
 */
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

// Rendering (side effect)

/**
 * Brings an SVG element to the foreground.
 * @param elem SVG element to bring to the foreground
 */
const bringToForeground = (elem: SVGElement): void => {
    elem.parentNode?.appendChild(elem);
};

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "visible");
    bringToForeground(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "hidden");
};

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
): SVGElement => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

const render = (): ((s: State) => void) => {
    // Canvas elements
    const gameOver = document.querySelector("#gameOver") as SVGElement;
    const container = document.querySelector("#main") as HTMLElement;

    // Text fields
    const livesText = document.querySelector("#livesText") as HTMLElement;
    const scoreText = document.querySelector("#scoreText") as HTMLElement;

    const svg = document.querySelector("#svgCanvas") as SVGSVGElement;

    svg.setAttribute(
        "viewBox",
        `0 0 ${Viewport.CANVAS_WIDTH} ${Viewport.CANVAS_HEIGHT}`,
    );

    // Create bird element once
    const birdImg = createSvgElement(svg.namespaceURI, "image", {
        id: "bird",
        href: "assets/birb.png",
        width: `${Birb.WIDTH}`,
        height: `${Birb.HEIGHT}`,
    });
    birdImg.setAttribute("x", `${Birb.INITIAL_X - Birb.WIDTH / 2}`);
    birdImg.setAttribute("y", `${Birb.INITIAL_Y - Birb.HEIGHT / 2}`);
    svg.appendChild(birdImg);

    // Create multiple ghost bird elements
    const ghostBirdElements: SVGElement[] = [];
    const maxGhostBirds = 10; // I don't want to create too many ghost birds

    for (let i = 0; i < maxGhostBirds; i++) {
        const hueRotate = 120 + ((i * 36) % 360); // Distribute colors evenly around color wheel

        const ghostBirdImg = createSvgElement(svg.namespaceURI, "image", {
            id: `ghostBird${i}`,
            href: "assets/birb.png",
            width: `${Birb.WIDTH}`,
            height: `${Birb.HEIGHT}`,
            style: `filter: hue-rotate(${hueRotate}deg)`,
            visibility: "hidden",
        });
        svg.appendChild(ghostBirdImg);
        ghostBirdElements.push(ghostBirdImg);
    }

    // Container for dynamic pipes
    const pipesContainer = createSvgElement(svg.namespaceURI, "g", {
        id: "pipes",
    });
    svg.appendChild(pipesContainer);

    // Subscribe to ghost birds observable
    const ghostBirds$ = createGhostBirds$();
    ghostBirds$.subscribe(ghosts => {
        // Update all ghost bird elements
        ghostBirdElements.forEach((ghostElement, index) => {
            if (index < ghosts.length && ghosts[index].visible) {
                const ghost = ghosts[index];
                ghostElement.setAttribute("x", `${ghost.x - Birb.WIDTH / 2}`);
                ghostElement.setAttribute("y", `${ghost.y - Birb.HEIGHT / 2}`);
                ghostElement.setAttribute("opacity", ghost.opacity.toString());
                show(ghostElement);
            } else {
                hide(ghostElement);
            }
        });
    });

    /**
     * Renders the current state to the canvas.
     * @param s Current state
     */
    return (s: State) => {
        // Update bird position
        birdImg.setAttribute("x", `${s.bird.x - Birb.WIDTH / 2}`);
        birdImg.setAttribute("y", `${s.bird.y - Birb.HEIGHT / 2}`);

        // Clear existing pipes
        pipesContainer.innerHTML = "";

        // Render all pipes
        s.pipes.forEach(pipe => {
            const gapTop = pipe.gapY - pipe.gapHeight / 2;
            const gapBottom = pipe.gapY + pipe.gapHeight / 2;

            // Top pipe
            const topPipe = createSvgElement(svg.namespaceURI, "rect", {
                x: pipe.x.toString(),
                y: "0",
                width: Constants.PIPE_WIDTH.toString(),
                height: gapTop.toString(),
                fill: "green",
            });

            // Bottom pipe
            const bottomPipe = createSvgElement(svg.namespaceURI, "rect", {
                x: pipe.x.toString(),
                y: gapBottom.toString(),
                width: Constants.PIPE_WIDTH.toString(),
                height: (Viewport.CANVAS_HEIGHT - gapBottom).toString(),
                fill: "green",
            });

            pipesContainer.appendChild(topPipe);
            pipesContainer.appendChild(bottomPipe);
        });

        // Update score and lives
        scoreText.textContent = s.score.toString();
        livesText.textContent = s.lives.toString();

        // Show/hide game over
        if (s.gameEnd) {
            show(gameOver);
        } else {
            hide(gameOver);
        }
    };
};

export const state$ = (csvContents: string): Observable<State> => {
    // Parse pipe templates from CSV
    const pipeTemplates = parsePipeTemplates(csvContents);

    /** User input */
    const key$ = fromEvent<KeyboardEvent>(document, "keydown");

    /** Jump stream - triggered by Space key */
    const jump$ = key$.pipe(
        filter(({ code }) => code === "Space"),
        map(() => jump),
    );

    // Tick stream, update game physics
    const tick$ = interval(Constants.TICK_RATE_MS).pipe(map(() => tick));

    // Restart stream, when press R
    const restart$ = key$.pipe(filter(({ code }) => code === "KeyR"));

    // Pause toggle, press P; reset pause when restart
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

    // Game stream, ghost record by stream
    const gameStream$ = restart$.pipe(
        startWith(null), // Start first game
        tap(() => {
            // Reset recording for new game
            currentGamePositions = [];
            currentGameRecording$ = new BehaviorSubject<BirdPosition[]>([]);
            gameTime$.next(0);
        }),
        switchMap(() => {
            const initialState = createInitialState(pipeTemplates);
            // Gate updates while paused so no state emissions occur
            const updates$ = merge(jump$, tick$).pipe(
                withLatestFrom(paused$),
                filter(([, paused]) => !paused),
                map(([fn]) => fn),
            );

            // Build state stream here (record, time, save when end)
            return updates$.pipe(
                scan((state: State, updateFn) => updateFn(state), initialState),
                tap(s => {
                    // drive global time for ghosts
                    gameTime$.next(s.gameTime);

                    // record current position only while game is running
                    if (!s.gameEnd) {
                        const pos: BirdPosition = {
                            x: s.bird.x,
                            y: s.bird.y,
                            time: s.gameTime,
                        };
                        currentGamePositions = [...currentGamePositions, pos];
                        currentGameRecording$?.next(currentGamePositions);
                    }
                }),
                pairwise(),
                tap(([prev, curr]) => {
                    // on transition to game end, save this run as a ghost
                    if (
                        !prev.gameEnd &&
                        curr.gameEnd &&
                        currentGameRecording$
                    ) {
                        gamePositionStreams$.next(currentGameRecording$);
                    }
                }),
                map(([, curr]) => curr),
            );
        }),
    );

    return gameStream$;
};

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    const csvUrl = `${baseUrl}/assets/map.csv`;

    // Get the file from URL
    const csv$ = fromFetch(csvUrl).pipe(
        switchMap(response => {
            if (response.ok) {
                return response.text();
            } else {
                throw new Error(`Fetch error: ${response.status}`);
            }
        }),
        catchError(err => {
            console.error("Error fetching the CSV file:", err);
            throw err;
        }),
    );

    // Observable: wait for first user click
    const click$ = fromEvent(document.body, "mousedown").pipe(take(1));

    csv$.pipe(
        switchMap(contents =>
            // On click - start the game
            click$.pipe(switchMap(() => state$(contents))),
        ),
    ).subscribe(render());
}

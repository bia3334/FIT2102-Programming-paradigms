# Assignment 1 Report: Flappy Birb

## FRP Design Overview

This implementation demonstrates core FRP principles through reactive composition and pure state management. The game achieves full functional programming compliance by eliminating mutable state and representing all data flow as Observable streams.

## State Management and Purity

The game state follows strict immutability using `readonly` types and pure functions. The `tick` function exemplifies this approach - it accepts a state and returns a new state without mutation. This design enables predictable state transitions and eliminates side effects from game logic.

The state accumulation uses `scan` to fold game updates over time, maintaining referential transparency. Each frame produces a new immutable state object, ensuring the previous state remains unchanged. This functional approach makes debugging easier and prevents race conditions.

## Observable Usage Beyond Input

Beyond keyboard input, Observables serve three critical architectural roles:

**Time-based Composition**: The game timer (`interval`) drives physics updates, demonstrating how FRP naturally handles temporal aspects. Time becomes a first-class value flowing through the observable pipeline.

**Dynamic Stream Management**: CSV data loading uses `fromFetch` and `switchMap` to transform external data into game templates. This showcases Observable composition for asynchronous data integration.

**Cross-frame Communication**: The ghost bird system leverages `BehaviorSubject` and `combineLatest` to synchronize multiple game recordings. This reactive coordination would be complex in imperative programming but emerges naturally from FRP composition.

## Design Decisions and Justification

**Pure Function Architecture**: All game logic (collision detection, scoring, physics) uses pure functions. This decision enables easy testing, predictable behavior, and functional composition. The `checkCollisions` function demonstrates this - it computes collision state without modifying inputs.

**Observable Composition over Arrays**: Instead of storing game recordings in arrays, the system uses `Subject` streams accumulated via `scan`. This maintains FRP purity while enabling dynamic ghost bird generation. The `combineLatest` operator reactively derives ghost positions from recorded streams.

**Separation of Concerns**: Game logic, rendering, and state management are separated through function composition. The render function only handles DOM updates, while state transitions remain pure. This separation enables clear reasoning about program behavior.

## Advanced FRP Patterns

The ghost recording system exemplifies advanced FRP concepts. Each game generates a `BehaviorSubject` stream that replays bird positions. Multiple recordings are combined using `combineLatest`, creating a reactive array that updates when any recording changes. This approach demonstrates how FRP handles complex coordination without manual synchronization.

The time synchronization uses `gameTime$` as a global clock that ghost birds observe. This showcases how FRP enables declarative temporal coordination - ghost birds automatically synchronize to current game time without explicit timing logic.

## FRP Benefits Realized

This implementation achieves FRP's key benefits: predictable state flow, composable logic, and eliminated side effects. The reactive architecture makes features like ghost bird replay emerge naturally from stream composition rather than requiring complex imperative coordination.

## Ghost Bird Replay System (Additional Feature)

The ghost bird system represents a significant additional feature that demonstrates advanced FRP concepts through reactive stream composition.

**Architecture**: Each completed game creates a `BehaviorSubject<BirdPosition[]>` containing recorded bird positions with timestamps. These subjects are collected via `Subject<BehaviorSubject<BirdPosition[]>>` and combined using `scan` to accumulate recordings, then `switchMap` with `combineLatest` to create a reactive array of all game recordings.

**Synchronization Strategy**: Ghost birds synchronize to current game time using `gameTime$` as a global clock. The `combineLatest([gameTime$, recordings])` pattern ensures ghost positions update reactively when either time or recordings change. This eliminates manual coordination logic.

**FRP Benefits**: This design showcases how FRP naturally handles complex coordination. The ghost system emerges from stream composition rather than imperative state management. Each ghost bird is an independent observable that reacts to global time changes, demonstrating declarative temporal programming.

**Purity Maintenance**: Despite managing multiple game recordings, the system maintains FRP purity by avoiding mutable arrays. All ghost states derive from current observable values, ensuring referential transparency and predictable behavior.

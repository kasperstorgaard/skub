---
name: Saga
slug: saga
createdAt: 2026-07-22T19:29:10.294Z
difficulty: hard
minMoves: 10
genOptions:
  wallsRange:
    - 6
    - 20
  blockersRange:
    - 3
    - 8
  wallSpread: spread
  symmetry: 0.7
  targetMoves: 10
generatorVersion: 0.7.0
scoring:
  score: 0.3878
  mean: 0.3878
  min: 0.3746
  stddev: 0.0131
  metrics:
    setupRatio: 0.5
    coverage: 0.4063
    deception: 8
    reversals: 1
    crossTrailOverlap: 12
    totalDistance: 41
    pieceUsage: 5.9069
    stopWeighted: 19
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 2
    wallUtilization: 0.2353
    deadSpace: 0.4844
    puckPathVariety: 1
    clumping: 0.1079
    emptyRegion: 0.4219
    wallSymmetry: 0.8235
    firstMovePrecision: 0.5
    searchProfile: 0.8383
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: C1C7-A7A4-C7A7-A5-H5-H1-A4H4-H1H3-F3-F7
      score: 0.3746
      metrics:
        setupRatio: 0.2
        coverage: 0.4063
        deception: 8
        reversals: 1
        crossTrailOverlap: 6
        totalDistance: 39
        pieceUsage: 3.3219
        stopWeighted: 18
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 2
        wallUtilization: 0.2353
        deadSpace: 0.4844
        puckPathVariety: 1
        clumping: 0.1079
        emptyRegion: 0.4219
        wallSymmetry: 0.8235
        firstMovePrecision: 0.5
        searchProfile: 0.8383
        isolationGap: 0
        nearMissCount: 0
    - moves: A7A4-H4-D7A7-C1C7-A7A4-C7A7-A4G4-A7A4-F4-F7
      score: 0.4009
      metrics:
        setupRatio: 0.5
        coverage: 0.2969
        deception: 5
        reversals: 0
        crossTrailOverlap: 12
        totalDistance: 41
        pieceUsage: 5.9069
        stopWeighted: 19
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 3
        uniqueSolutions: 2
        wallUtilization: 0.2353
        deadSpace: 0.4844
        puckPathVariety: 1
        clumping: 0.1079
        emptyRegion: 0.4219
        wallSymmetry: 0.8235
        firstMovePrecision: 0.5
        searchProfile: 0.8383
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
rating: 4
reasons: []
solutionTags:
  C1C7-A7A4-C7A7-A5-H5-H1-A4H4-H1H3-F3-F7:
    - interesting
    - unique
---

```
+ A B C D E F G H +
1  |_ @     _ #̲|  |
2        |        |
3 _        |      |
4                 |
5                 |
6      |   |      |
7 # _ _ #|  X̲ _   |
8  |           |  |
+-----------------+
```

---
name: Gry
slug: gry
createdAt: 2026-07-22T19:29:10.294Z
difficulty: medium
minMoves: 9
genOptions:
  wallsRange:
    - 6
    - 20
  blockersRange:
    - 3
    - 8
  wallSpread: spread
  symmetry: 0.4
  targetMoves: 9
generatorVersion: 0.7.0
scoring:
  score: 0.4626
  mean: 0.4626
  min: 0.4317
  stddev: 0.0309
  metrics:
    setupRatio: 0.6667
    coverage: 0.1719
    deception: 2
    reversals: 2
    crossTrailOverlap: 6
    totalDistance: 28
    pieceUsage: 6.4919
    stopWeighted: 19
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 2
    wallUtilization: 0.3158
    deadSpace: 0.5313
    puckPathVariety: 0.5
    clumping: 0.1034
    emptyRegion: 0.2031
    wallSymmetry: 0.7368
    firstMovePrecision: 0.25
    searchProfile: 0.8277
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: A4A8-D8-E8E3-F3-E2E8-F3E3-E8E4-D4-D8D5
      score: 0.4935
      metrics:
        setupRatio: 0.6667
        coverage: 0.1719
        deception: 2
        reversals: 2
        crossTrailOverlap: 6
        totalDistance: 28
        pieceUsage: 6.4919
        stopWeighted: 19
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 2
        wallUtilization: 0.3158
        deadSpace: 0.5313
        puckPathVariety: 0.5
        clumping: 0.1034
        emptyRegion: 0.2031
        wallSymmetry: 0.7368
        firstMovePrecision: 0.25
        searchProfile: 0.8277
        isolationGap: 0
        nearMissCount: 0
    - moves: A4A8-E2B2-B3-D3-B4B8-D8-D4-A8D8-D5
      score: 0.4317
      metrics:
        setupRatio: 0.6667
        coverage: 0.1719
        deception: 2
        reversals: 0
        crossTrailOverlap: 6
        totalDistance: 26
        pieceUsage: 6.2288
        stopWeighted: 18
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 2
        wallUtilization: 0.3158
        deadSpace: 0.5313
        puckPathVariety: 0.5
        clumping: 0.1034
        emptyRegion: 0.2031
        wallSymmetry: 0.7368
        firstMovePrecision: 0.25
        searchProfile: 0.8277
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
solutionTags:
  A4A8-E2B2-B3-D3-B4B8-D8-D4-A8D8-D5:
    - boring
    - interesting
  A4A8-D8-E8E3-F3-E2E8-F3E3-E8E4-D4-D8D5:
    - interesting
    - unique
rating: 3.5
reasons: []
---

```
+ A B C D E F G H +
1   _    |        |
2  |      #    |  |
3   _    |   |_   |
4 @ #  |   |   |  |
5      |X  |   |  |
6    |   |        |
7  |           |  |
8        |#       |
+-----------------+
```

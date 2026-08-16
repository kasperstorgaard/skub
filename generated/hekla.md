---
name: Hekla
slug: hekla
createdAt: 2026-07-22T19:29:10.294Z
difficulty: medium
minMoves: 8
genOptions:
  wallsRange:
    - 8
    - 25
  blockersRange:
    - 3
    - 8
  wallSpread: spread
  symmetry: 0.8
  targetMoves: 8
generatorVersion: 0.7.0
scoring:
  score: 0.4179
  mean: 0.4179
  min: 0.4118
  stddev: 0.0055
  metrics:
    setupRatio: 0.375
    coverage: 0.375
    deception: 6
    reversals: 1
    crossTrailOverlap: 9
    totalDistance: 35
    pieceUsage: 6.9069
    stopWeighted: 17
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 3
    wallUtilization: 0.2
    deadSpace: 0.3438
    puckPathVariety: 1
    clumping: 0.0727
    emptyRegion: 0.4531
    wallSymmetry: 0.9
    firstMovePrecision: 0.25
    searchProfile: 0.9636
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: H6H5-A5-A1-B6B1-E1-E5-A1E1-E4
      score: 0.4251
      metrics:
        setupRatio: 0.375
        coverage: 0.3125
        deception: 3
        reversals: 0
        crossTrailOverlap: 9
        totalDistance: 31
        pieceUsage: 6.9069
        stopWeighted: 17
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 3
        wallUtilization: 0.2
        deadSpace: 0.3438
        puckPathVariety: 1
        clumping: 0.0727
        emptyRegion: 0.4531
        wallSymmetry: 0.9
        firstMovePrecision: 0.25
        searchProfile: 0.9636
        isolationGap: 0
        nearMissCount: 0
    - moves: H6H8-A8-A1-B6B1-E1-E5-A1E1-E4
      score: 0.4167
      metrics:
        setupRatio: 0.375
        coverage: 0.375
        deception: 3
        reversals: 0
        crossTrailOverlap: 7
        totalDistance: 35
        pieceUsage: 6.9069
        stopWeighted: 16
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 3
        wallUtilization: 0.2
        deadSpace: 0.3438
        puckPathVariety: 1
        clumping: 0.0727
        emptyRegion: 0.4531
        wallSymmetry: 0.9
        firstMovePrecision: 0.25
        searchProfile: 0.9636
        isolationGap: 0
        nearMissCount: 0
    - moves: E6E1-H6E6-E1E5-E6E8-A8-A1-E1-E4
      score: 0.4118
      metrics:
        setupRatio: 0.25
        coverage: 0.375
        deception: 6
        reversals: 1
        crossTrailOverlap: 5
        totalDistance: 32
        pieceUsage: 4.585
        stopWeighted: 15
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 1
        uniqueSolutions: 3
        wallUtilization: 0.2
        deadSpace: 0.3438
        puckPathVariety: 1
        clumping: 0.0727
        emptyRegion: 0.4531
        wallSymmetry: 0.9
        firstMovePrecision: 0.25
        searchProfile: 0.9636
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
solutionTags:
  E6E1-H6E6-E1E5-E6E8-A8-A1-E1-E4:
    - interesting
    - unique
  H6H8-A8-A1-B6B1-E1-E5-A1E1-E4:
    - interesting
    - too-easy
  H6H5-A5-A1-B6B1-E1-E5-A1E1-E4:
    - interesting
rating: 3.5
reasons:
  - ugly
  - clumped
---

```
+ A B C D E F G H +
1     _     #̲ #   |
2                 |
3    |   |   |  # |
4         X     _ |
5                 |
6   #|   |#     @ |
7     _     _     |
8                 |
+-----------------+
```

---
name: Sylvi
slug: sylvi
createdAt: 2026-07-22T19:29:10.294Z
difficulty: medium
minMoves: 8
genOptions:
  wallsRange:
    - 6
    - 17
  blockersRange:
    - 2
    - 7
  wallSpread: spread
  symmetry: 0.7
  targetMoves: 8
generatorVersion: 0.7.0
scoring:
  score: 0.4401
  mean: 0.4401
  min: 0.4312
  stddev: 0.0079
  metrics:
    setupRatio: 0.5
    coverage: 0.25
    deception: 4
    reversals: 1
    crossTrailOverlap: 6
    totalDistance: 26
    pieceUsage: 7.4919
    stopWeighted: 19
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 3
    wallUtilization: 0.3077
    deadSpace: 0.4219
    puckPathVariety: 1
    clumping: 0.1364
    emptyRegion: 0.2656
    wallSymmetry: 0.7692
    firstMovePrecision: 0.25
    searchProfile: 0.9737
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: G3A3-A1-F1E1-D1D5-A1D1-D5F5-D1D5-E5
      score: 0.4504
      metrics:
        setupRatio: 0.375
        coverage: 0.25
        deception: 4
        reversals: 0
        crossTrailOverlap: 6
        totalDistance: 23
        pieceUsage: 7.4919
        stopWeighted: 19
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 3
        wallUtilization: 0.3077
        deadSpace: 0.4219
        puckPathVariety: 1
        clumping: 0.1364
        emptyRegion: 0.2656
        wallSymmetry: 0.7692
        firstMovePrecision: 0.25
        searchProfile: 0.9737
        isolationGap: 0
        nearMissCount: 0
    - moves: G3A3-D1D5-F1A1-A3A2-D2-D5F5-D2D5-E5
      score: 0.4386
      metrics:
        setupRatio: 0.375
        coverage: 0.2188
        deception: 3
        reversals: 0
        crossTrailOverlap: 6
        totalDistance: 25
        pieceUsage: 7.1699
        stopWeighted: 18
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 3
        wallUtilization: 0.3077
        deadSpace: 0.4219
        puckPathVariety: 1
        clumping: 0.1364
        emptyRegion: 0.2656
        wallSymmetry: 0.7692
        firstMovePrecision: 0.25
        searchProfile: 0.9737
        isolationGap: 0
        nearMissCount: 0
    - moves: G4G8-G3G7-E7-E1-G8H8-H6-E6-E1E5
      score: 0.4312
      metrics:
        setupRatio: 0.5
        coverage: 0.2031
        deception: 2
        reversals: 1
        crossTrailOverlap: 5
        totalDistance: 26
        pieceUsage: 5.3923
        stopWeighted: 16
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 1
        uniqueSolutions: 3
        wallUtilization: 0.3077
        deadSpace: 0.4219
        puckPathVariety: 1
        clumping: 0.1364
        emptyRegion: 0.2656
        wallSymmetry: 0.7692
        firstMovePrecision: 0.25
        searchProfile: 0.9737
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
rating: 3.5
reasons:
  - pretty
solutionTags:
  G3A3-D1D5-F1A1-A3A2-D2-D5F5-D2D5-E5:
    - interesting
    - unique
  G3A3-A1-F1E1-D1D5-A1D1-D5F5-D1D5-E5:
    - interesting
  G4G8-G3G7-E7-E1-G8H8-H6-E6-E1E5:
    - too-easy
    - interesting
note: not sure if too easy solution on 0.43
---

```
+ A B C D E F G H +
1       #   #     |
2   _    |    _   |
3 _           @ # |
4  | |       |#   |
5 _  |    X  |  _ |
6   _   #         |
7        |        |
8                 |
+-----------------+
```

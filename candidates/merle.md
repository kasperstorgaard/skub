---
name: Merle
slug: merle
createdAt: 2026-09-03T18:44:31.145Z
difficulty: easy
minMoves: 6
genOptions:
  wallsRange:
    - 10
    - 25
  blockersRange:
    - 3
    - 8
  wallSpread: balanced
  symmetry: 0.55
  targetMoves: 6
generatorVersion: 0.7.0
scoring:
  score: 0.3313
  mean: 0.3313
  min: 0.32
  stddev: 0.0159
  metrics:
    setupRatio: 0.5
    coverage: 0.1563
    deception: 0
    reversals: 1
    crossTrailOverlap: 5
    totalDistance: 18
    pieceUsage: 3.3219
    stopWeighted: 11
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 3
    wallUtilization: 0.1379
    deadSpace: 0.6875
    puckPathVariety: 0.6667
    clumping: 0.1345
    emptyRegion: 0.1094
    wallSymmetry: 0.8276
    firstMovePrecision: 0.3333
    searchProfile: 0.7564
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: B3B1-G1-G3-D6D1-G1-G3G2
      score: 0.3538
      metrics:
        setupRatio: 0.3333
        coverage: 0.1563
        deception: 0
        reversals: 1
        crossTrailOverlap: 4
        totalDistance: 18
        pieceUsage: 3
        stopWeighted: 11
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 3
        wallUtilization: 0.1379
        deadSpace: 0.6875
        puckPathVariety: 0.6667
        clumping: 0.1345
        emptyRegion: 0.1094
        wallSymmetry: 0.8276
        firstMovePrecision: 0.3333
        searchProfile: 0.7564
        isolationGap: 0
        nearMissCount: 0
    - moves: B3B1-G1-G5H5-H3-G3-G1G2
      score: 0.32
      metrics:
        setupRatio: 0.5
        coverage: 0.1406
        deception: 0
        reversals: 0
        crossTrailOverlap: 0
        totalDistance: 12
        pieceUsage: 3.3219
        stopWeighted: 11
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 3
        wallUtilization: 0.1379
        deadSpace: 0.6875
        puckPathVariety: 0.6667
        clumping: 0.1345
        emptyRegion: 0.1094
        wallSymmetry: 0.8276
        firstMovePrecision: 0.3333
        searchProfile: 0.7564
        isolationGap: 0
        nearMissCount: 0
    - moves: B3B1-D6D1-G1-G3-B1G1-G2
      score: 0.32
      metrics:
        setupRatio: 0.5
        coverage: 0.1406
        deception: 0
        reversals: 0
        crossTrailOverlap: 5
        totalDistance: 18
        pieceUsage: 3.3219
        stopWeighted: 11
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 3
        wallUtilization: 0.1379
        deadSpace: 0.6875
        puckPathVariety: 0.6667
        clumping: 0.1345
        emptyRegion: 0.1094
        wallSymmetry: 0.8276
        firstMovePrecision: 0.3333
        searchProfile: 0.7564
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
source: generated
solutionTags:
  B3B1-G1-G5H5-H3-G3-G1G2:
    - too-easy
rating: 1.5
reasons: []
---

```
+ A B C D E F G H +
1  |           |  |
2 _| |       |X _ |
3   @̲|     | |_   |
4    | |     |    |
5      |   | |#   |
6 _  |  #  | |  _ |
7 #| |       | |  |
8  |           |  |
+-----------------+
```

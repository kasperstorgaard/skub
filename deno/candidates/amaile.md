---
name: Amaile
slug: amaile
createdAt: 2026-08-30T18:41:17.545Z
difficulty: medium
minMoves: 7
genOptions:
  wallsRange:
    - 6
    - 23
  blockersRange:
    - 3
    - 6
  wallSpread: balanced
  symmetry: 0.6
  targetMoves: 7
generatorVersion: 0.7.0
scoring:
  score: 0.4066
  mean: 0.4066
  min: 0.3831
  stddev: 0.0188
  metrics:
    setupRatio: 0.7143
    coverage: 0.2344
    deception: 0
    reversals: 1
    crossTrailOverlap: 4
    totalDistance: 22
    pieceUsage: 7.7549
    stopWeighted: 16
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 5
    wallUtilization: 0.2174
    deadSpace: 0.5625
    puckPathVariety: 0.8
    clumping: 0.1217
    emptyRegion: 0.125
    wallSymmetry: 0.6957
    firstMovePrecision: 0.1667
    searchProfile: 0.9077
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: A3H3-E2H2-D6H6-H3H5-F5-H2H5-F5G5
      score: 0.4147
      metrics:
        setupRatio: 0.4286
        coverage: 0.1875
        deception: 0
        reversals: 1
        crossTrailOverlap: 3
        totalDistance: 22
        pieceUsage: 5.585
        stopWeighted: 14
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 5
        wallUtilization: 0.2174
        deadSpace: 0.5625
        puckPathVariety: 0.8
        clumping: 0.1217
        emptyRegion: 0.125
        wallSymmetry: 0.6957
        firstMovePrecision: 0.1667
        searchProfile: 0.9077
        isolationGap: 0
        nearMissCount: 0
    - moves: A3H3-D6H6-H4-G4-H3H7-G7-G5
      score: 0.3831
      metrics:
        setupRatio: 0.4286
        coverage: 0.2344
        deception: 0
        reversals: 0
        crossTrailOverlap: 4
        totalDistance: 21
        pieceUsage: 4.9069
        stopWeighted: 15
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 5
        wallUtilization: 0.2174
        deadSpace: 0.5625
        puckPathVariety: 0.8
        clumping: 0.1217
        emptyRegion: 0.125
        wallSymmetry: 0.6957
        firstMovePrecision: 0.1667
        searchProfile: 0.9077
        isolationGap: 0
        nearMissCount: 0
    - moves: D1D3-H3-A3G3-F7H7-H3H6-D6G6-G3G5
      score: 0.425
      metrics:
        setupRatio: 0.7143
        coverage: 0.1406
        deception: 0
        reversals: 0
        crossTrailOverlap: 4
        totalDistance: 22
        pieceUsage: 7.7549
        stopWeighted: 16
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 2
        uniqueSolutions: 5
        wallUtilization: 0.2174
        deadSpace: 0.5625
        puckPathVariety: 0.8
        clumping: 0.1217
        emptyRegion: 0.125
        wallSymmetry: 0.6957
        firstMovePrecision: 0.1667
        searchProfile: 0.9077
        isolationGap: 0
        nearMissCount: 0
    - moves: E2E3-H3-A3G3-F7H7-H3H6-D6G6-G3G5
      score: 0.425
      metrics:
        setupRatio: 0.7143
        coverage: 0.1406
        deception: 0
        reversals: 0
        crossTrailOverlap: 3
        totalDistance: 20
        pieceUsage: 7.7549
        stopWeighted: 16
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 2
        uniqueSolutions: 5
        wallUtilization: 0.2174
        deadSpace: 0.5625
        puckPathVariety: 0.8
        clumping: 0.1217
        emptyRegion: 0.125
        wallSymmetry: 0.6957
        firstMovePrecision: 0.1667
        searchProfile: 0.9077
        isolationGap: 0
        nearMissCount: 0
    - moves: E2H2-D6H6-H2H5-A3H3-H5F5-H3H5-G5
      score: 0.385
      metrics:
        setupRatio: 0.5714
        coverage: 0.1719
        deception: 0
        reversals: 0
        crossTrailOverlap: 4
        totalDistance: 22
        pieceUsage: 5.9069
        stopWeighted: 14
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 3
        uniqueSolutions: 5
        wallUtilization: 0.2174
        deadSpace: 0.5625
        puckPathVariety: 0.8
        clumping: 0.1217
        emptyRegion: 0.125
        wallSymmetry: 0.6957
        firstMovePrecision: 0.1667
        searchProfile: 0.9077
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
source: generated
solutionTags:
  A3H3-D6H6-H4-G4-H3H7-G7-G5:
    - interesting
    - unique
  E2H2-D6H6-H2H5-A3H3-H5F5-H3H5-G5:
    - interesting
    - too-easy
  A3H3-E2H2-D6H6-H3H5-F5-H2H5-F5G5:
    - interesting
  D1D3-H3-A3G3-F7H7-H3H6-D6G6-G3G5:
    - interesting
  E2E3-H3-A3G3-F7H7-H3H6-D6G6-G3G5:
    - boring
    - interesting
reasons:
  - ugly
  - pretty
rating: 3.5
---

```
+ A B C D E F G H +
1   _  |#  |  #̲ _ |
2     _   # _     |
3 @ _   _ _       |
4    |     | |    |
5   _| |  _|  X   |
6       #   _     |
7 _ _       #   _ |
8          |      |
+-----------------+
```

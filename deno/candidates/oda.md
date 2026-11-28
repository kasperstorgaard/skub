---
name: Oda
slug: oda
createdAt: 2026-07-22T19:29:10.294Z
difficulty: easy
minMoves: 6
source: generated
genOptions:
  wallsRange:
    - 6
    - 17
  blockersRange:
    - 2
    - 7
  wallSpread: spread
  symmetry: 0.7
  targetMoves: 6
generatorVersion: 0.7.0
scoring:
  score: 0.2698
  mean: 0.2698
  min: 0.247
  stddev: 0.0228
  metrics:
    setupRatio: 0.1667
    coverage: 0.1875
    deception: 1
    reversals: 0
    crossTrailOverlap: 2
    totalDistance: 14
    pieceUsage: 3.585
    stopWeighted: 11
    pointlessClearance: 1
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 2
    wallUtilization: 0.1875
    deadSpace: 0.7188
    puckPathVariety: 0.5
    clumping: 0.127
    emptyRegion: 0.5156
    wallSymmetry: 1
    firstMovePrecision: 0.3333
    searchProfile: 0.8892
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: F8F7-E7E6-F7E7-E8-D8-D1
      score: 0.2926
      metrics:
        setupRatio: 0.1667
        coverage: 0.1875
        deception: 1
        reversals: 0
        crossTrailOverlap: 1
        totalDistance: 12
        pieceUsage: 3.585
        stopWeighted: 11
        pointlessClearance: 1
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 2
        wallUtilization: 0.1875
        deadSpace: 0.7188
        puckPathVariety: 0.5
        clumping: 0.127
        emptyRegion: 0.5156
        wallSymmetry: 1
        firstMovePrecision: 0.3333
        searchProfile: 0.8892
        isolationGap: 0
        nearMissCount: 0
    - moves: E7H7-F8F7-E7-E8-D8-D1
      score: 0.247
      metrics:
        setupRatio: 0.1667
        coverage: 0.1875
        deception: 1
        reversals: 0
        crossTrailOverlap: 2
        totalDistance: 14
        pieceUsage: 2
        stopWeighted: 9
        pointlessClearance: 1
        sameDirectionRepeat: 0
        openingSetup: 1
        uniqueSolutions: 2
        wallUtilization: 0.1875
        deadSpace: 0.7188
        puckPathVariety: 0.5
        clumping: 0.127
        emptyRegion: 0.5156
        wallSymmetry: 1
        firstMovePrecision: 0.3333
        searchProfile: 0.8892
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
rating: 2
reasons:
  - pretty
solutionTags:
  E7H7-F8F7-E7-E8-D8-D1:
    - boring
note: >-
  Pretty, but tutorial level easy and boring. just move a blocker out the way
  and take the only route...
---

```
+ A B C D E F G H +
1   _ #|X  |  _|  |
2     _  |# _     |
3                 |
4                 |
5         #       |
6     _     _     |
7   _    |#   _   |
8      |   |@  |  |
+-----------------+
```

---
name: Åse
slug: ase
createdAt: 2026-07-22T19:29:10.294Z
difficulty: easy
minMoves: 6
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
  score: 0.4694
  mean: 0.4694
  min: 0.4594
  stddev: 0.01
  metrics:
    setupRatio: 0.5
    coverage: 0.1875
    deception: 0
    reversals: 1
    crossTrailOverlap: 3
    totalDistance: 20
    pieceUsage: 7.3219
    stopWeighted: 16
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 2
    wallUtilization: 0.3
    deadSpace: 0.5
    puckPathVariety: 1
    clumping: 0.1636
    emptyRegion: 0.5469
    wallSymmetry: 0.9
    firstMovePrecision: 0.3333
    searchProfile: 0.9403
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: H7H5-H8H6-H5A5-H6D6-D2D5-A5C5
      score: 0.4794
      metrics:
        setupRatio: 0.5
        coverage: 0.1563
        deception: 0
        reversals: 1
        crossTrailOverlap: 3
        totalDistance: 20
        pieceUsage: 6.585
        stopWeighted: 15
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 2
        wallUtilization: 0.3
        deadSpace: 0.5
        puckPathVariety: 1
        clumping: 0.1636
        emptyRegion: 0.5469
        wallSymmetry: 0.9
        firstMovePrecision: 0.3333
        searchProfile: 0.9403
        isolationGap: 0
        nearMissCount: 0
    - moves: H7D7-G1G3-B3-D7D3-C3-C5
      score: 0.4594
      metrics:
        setupRatio: 0.3333
        coverage: 0.1875
        deception: 0
        reversals: 0
        crossTrailOverlap: 2
        totalDistance: 18
        pieceUsage: 7.3219
        stopWeighted: 16
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 2
        wallUtilization: 0.3
        deadSpace: 0.5
        puckPathVariety: 1
        clumping: 0.1636
        emptyRegion: 0.5469
        wallSymmetry: 0.9
        firstMovePrecision: 0.3333
        searchProfile: 0.9403
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
rating: 2
reasons:
  - clumped
  - ugly
solutionTags:
  H7H5-H8H6-H5A5-H6D6-D2D5-A5C5:
    - too-easy
    - boring
  H7D7-G1G3-B3-D7D3-C3-C5:
    - too-easy
    - boring
---

```
+ A B C D E F G H +
1             #   |
2     _ #   _     |
3  |_         _   |
4               _ |
5   _ X           |
6  |  #̲     _     |
7     #         @ |
8               # |
+-----------------+
```

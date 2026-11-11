/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Every demo's model files, so all of the demos can be shown together on one
// page (index.md) rather than each needing its own index.html.
//
// Left out on purpose:
//   - page scripts that build a view as soon as they load, such as
//     grid/script.js, squares/script.js, tabata/main.js and most of u2/
//     (Demo, Demo3, DetailView, Simple, Table, ...);
//   - PyTree/PyTreeCView.js and u2/PyTree3.js, which define global classes
//     named PyBranch and PyTree that would replace the ones in PyTree/PyTree.js;
//   - designpatterns/UML.js and m0/gen.js, which are not FOAM models;
//   - sweeper's service worker files and alternative poms;
//   - reflow/, which has its own pom.
foam.POM({
  name: 'demos',

  files: [
    // Framework models the demos use that no other pom loads.
    { name: '../animation/Animation',                flags: 'js' },
    { name: '../animation/Interp',                   flags: 'js' },
    { name: '../input/Gamepad',                      flags: 'js' },
    { name: '../physics/PhysicalBox',                flags: 'js' },
    { name: '../graphics/StereoCView',               flags: 'js' },
    { name: '../graphics/DataSource',                flags: 'js' },
    { name: '../graphics/LegendEntries',             flags: 'js' },
    { name: '../graphics/Graph',                     flags: 'js' },
    { name: '../graphics/GraphV',                    flags: 'js' },
    { name: '../graphics/GraphH',                    flags: 'js' },
    { name: '../graphics/ColumnGraph',               flags: 'js' },
    { name: '../graphics/PieGraph',                  flags: 'js' },
    { name: '../graphics/BarGraph',                  flags: 'js' },
    { name: '../graphics/PlotGraph',                 flags: 'js' },

    { name: 'JSONViewDemo',                          flags: 'js' },

    { name: 'albums/BlueMonday',                     flags: 'js' },
    { name: 'albums/BlueMonday6',                    flags: 'js' },
    { name: 'albums/DigitalTempleOfLove',            flags: 'js' },
    { name: 'albums/DigitalUnknownPleasures',        flags: 'js' },
    { name: 'albums/HeartUnknownPleasures',          flags: 'js' },
    { name: 'albums/PumpkinUnknownPleasures',        flags: 'js' },
    { name: 'albums/TempleOfLove',                   flags: 'js' },
    { name: 'albums/UnknownPleasures',               flags: 'js' },

    { name: 'alienart/AlienArt',                     flags: 'js' },

//    { name: 'basic/Basic',                           flags: 'js' },
//    { name: 'basic/Programs',                        flags: 'js' },

    { name: 'blocks/Brick',                          flags: 'js' },
    { name: 'blocks/Wall',                           flags: 'js' },
    { name: 'blocks/Blocks',                         flags: 'js' },

    { name: 'bouncingballs/BouncingBalls',           flags: 'js' },

    { name: 'bubbles/Bubbles',                       flags: 'js' },
    { name: 'bubbles/SquareBubbles',                 flags: 'js' },

    { name: 'cartesian/Cartesian',                   flags: 'js' },

    { name: 'chartjs/Benchmark',                     flags: 'js' },
    { name: 'chartjs/ConfigurableChartView',         flags: 'js' },
    { name: 'chartjs/Pie',                           flags: 'js' },
    { name: 'chartjs/Stock',                         flags: 'js' },

    { name: 'clock/Clock',                           flags: 'js' },

    { name: 'counter/Counter',                       flags: 'js' },

    { name: 'csv/CsvUploadDemo',                     flags: 'js' },

    { name: 'elementbuilder/Builder',                flags: 'js' },

    { name: 'exgen/ExGen',                           flags: 'js' },

    { name: 'fern/Fern',                             flags: 'js' },

    { name: 'fire/Fire',                             flags: 'js' },

//    { name: 'gitlog/Controller',                     flags: 'js' },

    { name: 'graphics/Dragon',                       flags: 'js' },
    { name: 'graphics/EyeCView',                     flags: 'js' },
    { name: 'graphics/EyesCView',                    flags: 'js' },
    { name: 'graphics/OrgChart',                     flags: 'js' },
    { name: 'graphics/Radio',                        flags: 'js' },
    { name: 'graphics/TreeGraphDemo',                flags: 'js' },
    { name: 'graphics/ZoomMapViewDemo',              flags: 'js' },

    { name: 'graphview/GraphView',                   flags: 'js' },
    { name: 'graphview/GraphViewTest',               flags: 'js' },

    { name: 'grid/Grid',                             flags: 'js' },

    { name: 'heroes/Hero',                           flags: 'js' },
    { name: 'heroes/CitationView',                   flags: 'js' },
    { name: 'heroes/DashboardCitationView',          flags: 'js' },
    { name: 'heroes/Controller',                     flags: 'js' },

//    { name: 'iban/IBAN',                             flags: 'js' },

//    { name: 'issue/Issue',                           flags: 'js' },

    { name: 'lifestar/Disk',                         flags: 'js' },
    { name: 'lifestar/LifeStar',                     flags: 'js' },

//    { name: 'm0/M0',                                 flags: 'js' },

    { name: 'mandelbrot/Mandelbrot',                 flags: 'js' },

    { name: 'maze/Maze',                             flags: 'js' },

//    { name: 'olympics/Medal',                        flags: 'js' },
//    { name: 'olympics/Controller',                   flags: 'js' },

    { name: 'pong/Pong',                             flags: 'js' },

    { name: 'PyTree/PyTree',                         flags: 'js' },

    { name: 'queryparser/QueryController',           flags: 'js' },
    { name: 'queryparser/FScriptQueryController',    flags: 'js' },

    { name: 'robot/Robot',                           flags: 'js' },

    { name: 'sevenguis/Cells',                       flags: 'js' },
    { name: 'sevenguis/CircleDrawer',                flags: 'js' },
    { name: 'sevenguis/Counter',                     flags: 'js' },
    { name: 'sevenguis/CRUD',                        flags: 'js' },
    { name: 'sevenguis/FlightBooker',                flags: 'js' },
    { name: 'sevenguis/TempConv',                    flags: 'js' },
    { name: 'sevenguis/Timer',                       flags: 'js' },

    { name: 'spacewars/SpaceWar',                    flags: 'js' },

    { name: 'spin/Spin',                             flags: 'js' },

    { name: 'squares/Squares',                       flags: 'js' },

    { name: 'sudoku/Sudoku',                         flags: 'js' },

    { name: 'sweeper/Cell',                          flags: 'js' },
    { name: 'sweeper/Board',                         flags: 'js' },
    { name: 'sweeper/Game',                          flags: 'js' },

    { name: 'tabata/TabataState',                    flags: 'js' },
    { name: 'tabata/Tabata',                         flags: 'js' },
    { name: 'tabata/TabataCView',                    flags: 'js' },
    { name: 'tabata/TabataSoundView',                flags: 'js' },

    { name: 'threedtest/ThreeDTest',                 flags: 'js' },

    { name: 'tudorwall/TudorWall',                   flags: 'js' },
/*
    { name: 'u2/AllViews',                           flags: 'js' },
    { name: 'u2/Border',                             flags: 'js' },
    { name: 'u2/Colours',                            flags: 'js' },
    { name: 'u2/EnumDemo',                           flags: 'js' },
    { name: 'u2/ListenerDemo',                       flags: 'js' },
    { name: 'u2/MarkdownViewDemo',                   flags: 'js' },
    { name: 'u2/MDAllViews',                         flags: 'js' },
    { name: 'u2/MementoStack',                       flags: 'js' },
    { name: 'u2/RadioView',                          flags: 'js' },
    { name: 'u2/RockPaperScissors',                  flags: 'js' },
    { name: 'u2/Sample',                             flags: 'js' },
    { name: 'u2/TokenTest',                          flags: 'js' },
    { name: 'u2/Visibility',                         flags: 'js' }
    */
  ]
});

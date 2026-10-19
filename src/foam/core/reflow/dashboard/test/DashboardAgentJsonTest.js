/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow.dashboard.test',
  name: 'DashboardAgentJsonTest',
  extends: 'foam.core.test.JSTest',

  requires: [
    'foam.core.reflow.dashboard.DashboardBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardPieChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardStackedBarChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardLineChartDAOAgent',
    'foam.core.reflow.dashboard.DashboardCalendarChartDAOAgent'
  ],

  methods: [
    async function runTest(x) {
      await this.testBarOldFormat(x);
      await this.testBarNewFormat(x);
      await this.testPieOldFormat(x);
      await this.testPieNewFormat(x);
      await this.testStackedOldFormat(x);
      await this.testLineOldFormat(x);
      await this.testCalendarOldFormat(x);
    },

    async function testBarOldFormat(x) {
      var json = '{"class":"foam.core.reflow.dashboard.DashboardBarChartDAOAgent","horizontal":true,"height":400,"xAxisLabel":"X"}';
      var a = foam.json.parseString(json, x);
      x.test(a && a.displaySink && a.displaySink.horizontal === true, 'old flat Bar.horizontal → displaySink');
      x.test(a && a.displaySink && a.displaySink.height === 400, 'old flat Bar.height → displaySink');
      x.test(a && a.displaySink && a.displaySink.xAxisLabel === 'X', 'old flat Bar.xAxisLabel → displaySink');
    },

    async function testBarNewFormat(x) {
      var json = '{"class":"foam.core.reflow.dashboard.DashboardBarChartDAOAgent","displaySink":{"class":"foam.core.reflow.dashboard.DashboardBarSink","horizontal":true,"height":400}}';
      var a = foam.json.parseString(json, x);
      x.test(a && a.displaySink && a.displaySink.horizontal === true, 'new nested Bar.horizontal');
      x.test(a && a.displaySink && a.displaySink.height === 400, 'new nested Bar.height');
    },

    async function testPieOldFormat(x) {
      var json = '{"class":"foam.core.reflow.dashboard.DashboardPieChartDAOAgent","showPercentages":true,"cutoutPercentage":50,"disableLegendClick":true}';
      var a = foam.json.parseString(json, x);
      x.test(a && a.displaySink && a.displaySink.showPercentages === true, 'old flat Pie.showPercentages → displaySink');
      x.test(a && a.displaySink && a.displaySink.cutoutPercentage === 50, 'old flat Pie.cutoutPercentage → displaySink');
      x.test(a && a.displaySink && a.displaySink.disableLegendClick === true, 'old flat Pie.disableLegendClick → displaySink');
    },

    async function testPieNewFormat(x) {
      var json = '{"class":"foam.core.reflow.dashboard.DashboardPieChartDAOAgent","displaySink":{"class":"foam.core.reflow.dashboard.DashboardPieSink","showPercentages":true,"cutoutPercentage":50}}';
      var a = foam.json.parseString(json, x);
      x.test(a && a.displaySink && a.displaySink.showPercentages === true, 'new nested Pie.showPercentages');
      x.test(a && a.displaySink && a.displaySink.cutoutPercentage === 50, 'new nested Pie.cutoutPercentage');
    },

    async function testStackedOldFormat(x) {
      var json = '{"class":"foam.core.reflow.dashboard.DashboardStackedBarChartDAOAgent","horizontal":true,"showGridLines":false,"onClickScript":"x"}';
      var a = foam.json.parseString(json, x);
      x.test(a && a.displaySink && a.displaySink.horizontal === true, 'StackedBar old flat horizontal');
      x.test(a && a.displaySink && a.displaySink.showGridLines === false, 'StackedBar old flat showGridLines');
      x.test(a && a.displaySink && a.displaySink.onClickScript === 'x', 'StackedBar old flat onClickScript');
    },

    async function testLineOldFormat(x) {
      var json = '{"class":"foam.core.reflow.dashboard.DashboardLineChartDAOAgent","fill":true,"tension":0.3,"stepped":true,"pointRadius":5}';
      var a = foam.json.parseString(json, x);
      a.createSink();
      x.test(a && a.displaySink && a.displaySink.fill === true, 'Line old flat fill');
      x.test(a && a.displaySink && a.displaySink.tension === 0.3, 'Line old flat tension');
      x.test(a && a.displaySink && a.displaySink.stepped === true, 'Line old flat stepped');
      x.test(a && a.displaySink && a.displaySink.pointRadius === 5, 'Line old flat pointRadius');
    },

    async function testCalendarOldFormat(x) {
      var json = '{"class":"foam.core.reflow.dashboard.DashboardCalendarChartDAOAgent","periodCount":15,"height":180,"animate":false}';
      var a = foam.json.parseString(json, x);
      x.test(a && a.displaySink && a.displaySink.periodCount === 15, 'Calendar old flat periodCount');
      x.test(a && a.displaySink && a.displaySink.height === 180, 'Calendar old flat height');
      x.test(a && a.displaySink && a.displaySink.animate === false, 'Calendar old flat animate');
    }
  ]
});

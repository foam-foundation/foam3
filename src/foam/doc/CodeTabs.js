/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.doc',
  name: 'CodeTabs',
  extends: 'foam.u2.UnstyledTabs',

  documentation: 'Multiple code tabs.',

  css: `
    ^ {
      display: block;
    }
    ^tabRow { height: 30px; }
    ^tab {
      background: $backgroundInverseTertiary;
      border: 1px solid $borderDefault;
      border-radius: 3px 3px 0 0;
      display: inline-block;
      height: -2px;
      padding: 5px;
      border-bottom: none;
    }
    ^tab.selected {
      background:$backgroundDefault;
      position: relative;
      z-index: 1;
    }
    ^bottomEdge {
      background:$backgroundDefault;
      height: 2.5px;
      left: 0;
      position: absolute;
      top: 27px;
      width: 100%;
    }
    ^content {
      margin: 4px;
      padding: 6px;
      background:$backgroundDefault;
      border: 1px solid $borderStrong;
      position: relative;
      top: -3px;
      left: -4px;
    }
  `
});

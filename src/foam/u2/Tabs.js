/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// TODO: don't instantiate tabs until viewed

foam.CLASS({
  package: 'foam.u2',
  name: 'Tab',
  extends: 'foam.u2.Element',

  properties: [
    {
      name: 'label',
      documentation: 'Label for current tab, can be simple string or any U2 Element/ViewSpec'
    },
    {
      class: 'String',
      name: 'mementoLabel',
      documentation: 'String that is stored in memento when tab is selected',
      factory: function() {
        return foam.String.isInstance(this.label) ? this.label : null;
      }
    },
    { class: 'Boolean', name: 'selected' }
  ]
});

foam.CLASS({
  package: 'foam.u2',
  name: 'UnderlinedTabs',
  extends: 'foam.u2.UnstyledTabs',
  css: `
    ^tabRow {
      border-bottom: 1px solid $borderLight;
      background-color: $white;
      overflow-x: auto;
      white-space: nowrap;
    }
    ^tab {
      border-top: 3px solid transparent;
      border-bottom: 3px solid transparent;
      display: inline-block;
      height: 48px;
      box-sizing: border-box;
      padding: 13px 16px;
    }
    ^tab:hover {
      cursor: pointer;
    }
    ^tab.selected {
      border-bottom: 3px solid $borderBrand;
    }
  `
});

foam.CLASS({
  package: 'foam.u2',
  name: 'Tabs',
  extends: 'foam.u2.UnstyledTabs',

  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'tabActiveColor',
      value: '$textBrandSecondary'
    },
    {
      class: 'foam.u2.ColorToken',
      name: 'tabInactiveColor',
      value: '$textBrandSecondary'
    },
    {
      name: 'tabActiveBackground',
      value: '$backgroundBrandTertiary'
    }
  ],

  css: `
    ^tabRow {
      background-color: $backgroundDefault;
      border-radius: 4px 4px 0 0;
      border-bottom: 1px solid $borderLight;
      display: flex;
      gap: 12px 24px;
      padding: 12px;
      overflow-x: auto;
      white-space: nowrap;
    }
    ^tab {
      align-items: center;
      background: none;
      border-radius: 4px;
      color: $tabInactiveColor;
      display: flex;
      justify-content: center;
      padding: 7px 12px;
    }
    ^tab:hover {
      background: $tabActiveBackground;
      cursor: pointer;
    }
    ^tab.selected {
      background: $tabActiveBackground;
      color: $tabActiveColor;
      font-weight: $font-medium;
    }
  `
});

foam.CLASS({
  package: 'foam.u2',
  name: 'SegmentedTabs',
  extends: 'foam.u2.UnstyledTabs',

  cssTokens: [
    {
      class: 'foam.u2.ColorToken',
      name: 'tabPrimaryColor',
      value: '$textBrand'
    }
  ],

  css: `
    ^ {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      --tabRow-padding: 0.4rem;
      --tabRow-radius: 0.8rem;
    }
    ^content{
      flex: 1;
      display: flex;
    }
    /* hacky as U2 add() adds an extra div, remove with U3 */
    ^content > * {
      flex: 1;
      position: relative;
      width: 100%;
    }
    ^tabRow {
      flex: 0 0 auto;
      border-radius: var(--tabRow-radius, 0.4rem);
      border: 1px solid $borderLight;
      gap: 8px;
      padding: var(--tabRow-padding, 0.4rem);
      white-space: nowrap;
      background-color: $backgroundDefault;
      // box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
      align-self: center;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(100px, 1fr);
      width: 100%;
      overflow: auto;
    }
    ^tab {
      border-radius: 3px;
      align-items: center;
      background: none;
      border-radius: max(calc(var(--tabRow-radius, 0.4rem) - var(--tabRow-padding, 0.4rem)), 0.2rem);
      color: $tabPrimaryColor;
      display: flex;
      justify-content: center;
      padding: 8px 12px;
      flex: 1 1 0;
    }
    ^tab:hover {
      background: $tabPrimaryColor$hover;
      color: $tabPrimaryColor$foreground;
      cursor: pointer;
    }
    ^tab.selected {
      color: $tabPrimaryColor$foreground;
      background-color: $tabPrimaryColor;
    }
  `
});

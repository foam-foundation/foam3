/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.view',
  name: 'NavigationButton',
  extends: 'foam.u2.ActionView',
  mixins: ['foam.u2.view.NavButtonMixin'],
  documentation: 'Button style to be used by nav components, typically differs drastically from other buttons so is subclassed',
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'NavigationMenu',
  extends: 'foam.u2.view.MenuView',
  mixins: ['foam.u2.view.NavButtonMixin'],
  documentation: 'MenuView style to be used by nav components, typically differs drastically from other menuViews so is subclassed',
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'NavigationOverlayButton',
  extends: 'foam.u2.view.OverlayActionListView',
  mixins: ['foam.u2.view.NavButtonMixin'],
  documentation: 'OverlayActionListButton style to be used by nav components, typically differs drastically from other buttons so is subclassed',
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'NavButtonMixin',
  documentation: 'Mixin with tokens requred for navigation buttons',
  cssTokens: [
    {
      name: 'NavButtonBackgroundColor',
      class: 'foam.u2.ColorToken',
      value: '$foam.core.menu.VerticalMenu.menuBackground',
      onLight: '$textSecondary',
      disabledModifier: -10,
      hoverModifier: -10,
      activeModifier: -15
    },
    {
      name: 'NavSelectedIconColor',
      value: function(e) { return e.LIGHTEN(e.TOKEN('$NavButtonSelectedLabelColor'), 10) },
      variantKey: 'color'
    },
    {
      class: 'foam.u2.ColorToken',
      name: 'NavButtonSelectedLabelColor',
      value: '$textBrandSecondary'
    },
    {
      name: 'NavButtonSelectedBackgroundColor',
      value: '$NavButtonBackgroundColor$hover',
      variantKey: 'color'
    }
  ],
  css: `
    <<:hover:not(:disabled):not(:active):not(.selected) {
      background-color: $NavButtonBackgroundColor$hover;
      color: $NavButtonBackgroundColor$hover$foreground;
    }
    <<:hover:not(:disabled):not(:active):not(.selected) svg {
      fill: $NavButtonBackgroundColor$hover$foreground;
    }
    <<:active, <<.selected {
      background-color: $NavButtonSelectedBackgroundColor;
      color:  $NavButtonSelectedLabelColor;
    }
    <<:active svg,<<.selected svg {
      fill: $NavSelectedIconColor;
    }
    <<{
      color: $NavButtonBackgroundColor$foreground;
    }
    << svg {
      fill: $NavButtonBackgroundColor$foreground;
    }
  `
});

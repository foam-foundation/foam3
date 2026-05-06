/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.dashboard.view',
  name: 'DashboardView',
  extends: 'foam.dashboard.view.Dashboard',
  mixins: ['foam.u2.layout.ContainerWidth'],

  imports: [
    'menuDAO',
    'displayWidth?',
    'document'
  ],

  requires: [
    'foam.core.menu.Menu'
  ],

  css: `
    ^ {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    ^main {
      height: fit-content;
      min-height: 600px;
      padding: 24px 32px;
      max-width: 160rem;
      margin: auto;
    }
    ^widget-container {
      width: 100%;
      display: grid;
      flex-grow: 1;
    }
  `,

  messages: [
    { name: 'TITLE', message: 'Dashboard' }
  ],

  properties: [
    {
      class: 'String',
      name: 'viewTitle',
      factory: function() {
        return this.TITLE;
      }
    },
    'dashboardTitle',
    {
      name: 'main',
      documentation: 'Should be set to true on the most top-level dashboard.',
      value: false
    },
    {
      name: 'width',
      documentation: 'The fixed number of grid columns for the dashboard.',
      expression: function(containerWidth) {
        if ( ! containerWidth ) return 'repeat(12, 1fr)';
        this.document.documentElement.style.setProperty('--dashboard-max-col', containerWidth.cols); 
        return `repeat(${containerWidth.cols}, 1fr)`;
      }
    },
    {
      name: 'height',
      documentation: 'The fixed number of grid rows for the dashboard.',
      value: 'min-content'
    },
    {
      name: 'gap',
      documentation: 'The px gap between dashboard widgets.',
      value: '1.6em'
    },
    {
      class: 'Map',
      name: 'widgets',
      documentation: 'Mapping of menu id to aspect ratio for widgets that will be displayed in the dashboard.',
      factory: function() {
        return {};
      },
      description: `The map of widgets used to render the dashboard. Allows specifying different columns for various
      widths of the dashboard container using '<displayWidth>Column'. This also supports percentage value config for a row of widgets.
      It uses a similar syntax to css grid where 1fr,2fr,3fr correspond to the width of the width with respect to total "fr"s in the row.
      Sample for fixed span columns:
        widgets: {
          <menu.id>: { column: 6, SMColumn: 12 .....}
        }

      Sample for fractional columns:
        widgets: {
          menuA: { column: '1fr' }
          menuB: { column: '1fr' }
          menuC: { column: 12 }
          menuD: { column: '2fr' }
          menuE: { column: '2fr' }
          menuF: { column: '1fr' }
        }
      Resulting grid template: 
        menuA-menuA--- ---menuB-menuB
        menuC menuC menuC menuC menuC
        menuD menuD menuE menuE menuF
      In this case, menuA and menuB will split available columns between the two of them and menu D,E,F will split the columns in row three between them
      based on the number of "fr" available (in this case, 5) where D and E get 2 each and F gets 1.
      `
    },
    {
      class: 'Map',
      tranient: true,
      hidden: true,
      name: 'containerMap'
    },
    'widgetContainer'
  ],

  methods: [
    async function render() {
      this.SUPER();
      this.initContainer();

      this
      .addClass(this.myClass())
      .enableClass(this.myClass('main'), this.main)
      .add(this.dynamic(function(dashboardTitle) {
        if ( ! dashboardTitle ) return;
        this
          .start()
            .enableClass('h500', this.dashboardTitle$)
            .style({ height: '2em' })
            .add(dashboardTitle)
          .end();
      }))
      .start('', {}, this.widgetContainer$)
        .addClass(this.myClass('widget-container'))
        .style({
          'grid-template-columns': this.width$,
          'grid-template-rows': this.height$,
          'grid-gap': this.gap$
        })
      .end();
      await this.initWidgets(this.widgetContainer);
      this.updateCols();
      this.containerWidth$.sub(this.updateCols);
    },
    async function initWidgets(widgetContainer) {
      let menuArray = Object.keys(this.widgets);
      let menuLength = menuArray.length;
      for( let step = 0; step < menuLength; step++ ) {
        let menuId = menuArray[step];
        let menu = await this.menuDAO.find(menuId);
        if ( ! await menu?.readPredicate.f(menu) )
          menu = null;
        if ( menu ) {
          widgetContainer.startContext().start(menu.handler.view).style({
            'grid-column': this.containerMap$.map(v => {
              return v[menuId] ?? this.containerWidth?.cols;
            })
          }).end();
        } else {
          delete this.widgets[menuId];
        }
      }
    }
  ],
 
  listeners: [
    {
      name: 'updateCols',
      isFramed: true,
      code: function() {
        let cw = this.containerWidth;
        let currentWidgetSet = 0;
        let widgetSetCount = 0;
        let cm = {}
        Object.keys(this.widgets).forEach(v => {
          let colConfig = this.widgets[v];
          let col = colConfig[`${cw}Column`] ?? colConfig['column'];
          if ( foam.String.isInstance(col) ) {
            let colSpan = col.indexOf('fr') != -1 ? col.split('fr')[0] : 1;
            if ( widgetSetCount == 0 )
              currentWidgetSet++;
            widgetSetCount += Number(colSpan);
            cm[v] = `span calc(${colSpan}*var(--dashboard-max-col)/var(--split-row-${currentWidgetSet}))`;
          } else {
            if ( widgetSetCount > 0 )
              this.document.documentElement.style.setProperty(`--split-row-${currentWidgetSet}`, widgetSetCount); 
            widgetSetCount = 0;
            cm[v] = 'span ' + col;
          }
        })
        // Set final one again in case it doesnt get set
        this.document.documentElement.style.setProperty(`--split-row-${currentWidgetSet}`, widgetSetCount);
        this.containerMap = cm;
      }
    }
  ]
});


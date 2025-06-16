/**
* @license
* Copyright 2025 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.filter',
  name: 'FilterConfigView',
  extends: 'foam.u2.view.OverlayActionListView',

  documentation: `
    Filter View configurator that can be used to add and remove filters on the fly
  `,

  imports: ['auth', 'data as filterView'],

  css: `
    ^ {
      padding: 7px;
      borderRadius: 4px;
      border: 1px solid $borderDefault;
      color: $textDefault;
      height: 100%;
    }
    ^filter-selection {
      max-height: 50vh;
      overflow: auto;
      display: flex;
      gap: 0.8rem;
      flex-direction: column;
    }
  `,
  messages: [
    { name: 'SELECTED_OPTIONS', message: 'Selected' },
    { name: 'OPTIONS', message: 'Options' },
    { name: 'ENABLE_COLUMNS', message: 'Filters' }
  ],
  constants: [
    { type: 'Integer', name: 'MAX_FILTERS', value: 9 }
  ],
  properties: [
    {
      name: 'dao'
    },
    {
      name: 'lazy',
      value: true
    },
    {
      class: 'String',
      name: 'filterSearch',
      placeholder: 'Search...',
      onKey: true
    },
    ['showDropdownIcon', false],
    ['themeIcon', 'settings'],
    'reload_'
  ],
  methods: [
    async function initializeOverlay(x, y) {
      let self = this;
      this.overlayInitialized_ = true;
      const of = self.dao.of;
      this.ctrl.add(this.overlay_);
      let props = of.getAxiomsByClass(foam.lang.Property)
        .filter( m => m.searchView && m.name != 'reactions_' && ! m.hidden )
      let availableProps = []
      await Promise.all(props.map(p => {
        if ( ! this.auth || ! p.columnPermissionRequired )
          availableProps.push(p);
        else
          this.auth.check(null, `${of.name.toLowerCase()}.column.${p.name}`).then(v => v && availableProps.push(p))
      }));
      props = availableProps;
      this.overlay_.start()
        .addClass(self.myClass('filter-selection'))
        // search
        .start('p').addClass('p-label-lg').add(self.ENABLE_COLUMNS).end()
        .start().addClass(self.myClass('container-search'))
          .tag(self.FILTER_SEARCH, { data$: self.filterSearch$})
        .end()
        // selected
        .add(self.dynamic(function(filterView$filters, filterSearch, reload_) {
          var filteredProps = filterView$filters.filter(function(f) {
            return f.toLowerCase().includes(filterSearch.toLowerCase());
          }).map(key => props.find(v => v.name == key))
          if ( ! filteredProps?.length ) return;
          this.start()
            .start('p').addClass('p-label')
              .add(self.SELECTED_OPTIONS)
            .end()
            .forEach(filteredProps, function(prop) {
              if ( ! prop ) return;
              this
              .start()
                .on('click', () => self.deselectFilter(prop))
                .tag({ class: 'foam.u2.CheckBox', data: true, label: prop.columnLabel })
              .end();
            }).end();
        }))
        // options
        .add(self.dynamic(function(filterView$filters, filterSearch, reload_) {
          var otherProps = props.filter(function(f) {
            return f.name.toLowerCase().includes(filterSearch.toLowerCase()) && ! filterView$filters.includes(f.name);
          })
          if ( ! otherProps?.length ) return;
          this.start()
            .start().addClass('p-label')
              .add(self.OPTIONS)
            .end()
            .forEach(otherProps, function(prop) {
              var data = foam.lang.SimpleSlot.create({ value: false })
              this.start()
                .on('click', () => self.selectFilter(prop, data))
                .tag({ class: 'foam.u2.CheckBox', data$: data, label: prop.columnLabel })
              .end();
            }).end();
        }))
      .end();
      this.overlay_.open(x,y)
    },

    function selectFilter(key, data) {
      key = key.name;
      if ( this.data.length >= this.MAX_FILTERS ) {
        this.notify('Max filters: ' + this.MAX_FILTERS, '', this.LogLevel.ERROR);
        data.set(false);
        return;
      }
      this.filterView.filters$push(key);
      this.propertyChange.pub('reload_', this.reload_$);
    },

    function deselectFilter(key) {
      key = key.name;
      var index = this.filterView.filters.indexOf(key);
      if ( index !== -1 ) {
        this.filterView.filters$splice(index, 1);
        this.propertyChange.pub('reload_', this.reload_$);
      }
    },
  ]
})
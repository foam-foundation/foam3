/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'ColumnConfigPropView',
  extends: 'foam.u2.Controller',

  requires: [
    'foam.u2.view.ColumnViewHeader',
    'foam.u2.view.ColumnViewBody',
    'foam.u2.view.RootColumnConfigPropView'
  ],

  imports: [
    'columnStorage'
  ],

  css: `
    ^ {
      max-width: 200px;
      overflow: auto;
    }
    ^searchWrapper {
      padding: 0px 8px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      width: 100%;
    }
    ^searchBar{
      width: 100%
    }
    ^ input[type='search']{
      width: 100%;
    }
    ^resetButton {
      float: right;
      background: none;
      color: $textBrand;
    }
    ^resetButton:hover:not(:disabled) {
      text-decoration: underline;
    }
    ^resetButton:disabled {
      color: $textTertiary;
    }
    ^colContainer {
      overflow-x: hidden;
      height: 100%;
      flex: 1;
      width: -webkit-fill-available;
      width: -moz-fill-available;
    }
  `,

  properties: [
    'data',
    {
      name: 'columns',
      expression: function(data) {
        return this.getColumns();
      }
    },
    {
      name: 'views',
      expression: function(columns) {
        var arr = [];
        for ( var i = 0 ; i < columns.length ; i++ ) {
          arr.push(this.RootColumnConfigPropView.create({
            index: i,
            prop: columns[i],
            onDragAndDropParentFunction: this.onTopLevelPropertiesDragAndDrop.bind(this),
            onSelectionChangedParentFunction: this.onTopPropertiesSelectionChange.bind(this),
            onGroupByChangedParentFunction: this.onTopPropertiesGroupByChange.bind(this),
            onDragAndDrop: this.onDragAndDrop.bind(this),//for parent to call on its views on child drag and drop
            onSelectionChanged: this.onSelectionChanged.bind(this),//for parent to call on its views on child selectionChanged
            onGroupChanged: this.onGroupChanged.bind(this)
          }));
        }
        return arr;
      }
    },
    {
      name: 'updateSort',
      class: 'Boolean'
    },
    {
      class: 'String',
      name: 'menuSearch',
      view: {
        class: 'foam.u2.SearchField',
        onKey: true,
        autocomplete: false
      },
      value: '',
      postSet: function() {
        this.onMenuSearchUpdate();
      }
    },
    {
      name: 'columnHandler',
      class: 'FObjectProperty',
      of: 'foam.core.column.CommonColumnHandler',
      factory: function() {
        return foam.core.column.CommonColumnHandler.create();
      }
    },
    {
      name: 'groupByColumns',
      value: []
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      this
      .on('click', this.stopPropagation)
          .start()
            .start(this.MENU_SEARCH).addClass(this.myClass('searchBar')).end()
            .addClass(this.myClass('searchWrapper'))
            .start(self.RESET_COLUMNS, {buttonStyle : 'LINK'})
              .addClass(this.myClass('resetButton'))
            .end()
          .end()
          .add(this.slot(function(views) {
            var i = 0;
            return this.E()
              .addClass(self.myClass('colContainer'))
              .forEach(views, function(view) {
                view.prop.index = i;
                this
                  .start()
                  .add(view)
                  .end();
                i++;
              });
          }));
      this.data.selectedColumnNames$.sub(this.rebuildSelectedColumns);
    },
    function stopPropagation(e) {
      e.stopPropagation();
    },
    function onClose() {
      if ( this.menuSearch )
        this.menuSearch = '';
      this.columns.forEach(c => c.onClose());
    },
    function onTopLevelPropertiesDragAndDrop(targetIndex, draggableIndex) {
      this.onDragAndDrop(this.views, targetIndex, draggableIndex);
    },
    function onTopPropertiesSelectionChange(isColumnSelected, index, isColumnSelectionHaventChanged) {
      if ( ! isColumnSelectionHaventChanged )
        this.onSelectionChanged(isColumnSelected, index, this.views);
      this.data.selectedColumnNames = this.rebuildSelectedColumns();
      this.data.updateColumns();
    },
    function onTopPropertiesGroupByChange(isColumnSelected, index, isColumnSelectionHaventChanged, isChild) {
      if ( ! isColumnSelectionHaventChanged )
        this.onGroupChanged(isColumnSelected, index, this.views, isChild);
      this.data.updateColumns();
    },
    function onDragAndDrop(views, targetIndex, draggableIndex) {
      this.resetProperties(views, targetIndex, draggableIndex);
      this.data.selectedColumnNames = this.rebuildSelectedColumns();
      this.data.updateColumns();
    },
    function resetProperties(views, targetIndex, draggableIndex) {
      var thisProps = views.map(v => v.prop);
      thisProps = [...thisProps];
      var replaceIndex;
      replaceIndex = targetIndex;
      if ( draggableIndex < targetIndex ) {

        for ( var i = draggableIndex ; i < targetIndex ; i++ ) {
          thisProps[i+1].index = i;
          views[i].prop = thisProps[i+1];
        }
      } else {
        for ( var i = targetIndex + 1 ; i <= draggableIndex ; i++ ) {
          thisProps[i-1].index = i;
          views[i].prop = thisProps[i-1];
        }
      }
      thisProps[draggableIndex].index = replaceIndex;
      views[replaceIndex].prop = thisProps[draggableIndex];
    },
    function rebuildSelectedColumns() {
      var arr = [];
      if ( ! this.views ) return;
      for ( var i = 0 ; i < this.views.length ; i++ ) {
        if ( this.views[i].prop.isPropertySelected ) {
          var propSelectedTraversed = this.views[i].prop.returnSelectedProps();
          for ( var j = 0 ; j < propSelectedTraversed.length ; j++ ) {
            if ( foam.Array.isInstance(propSelectedTraversed[j]) )
              arr.push(propSelectedTraversed[j].filter(Boolean).join('.'));
            else if ( propSelectedTraversed[j] )
              arr.push(propSelectedTraversed[j]);
          }
        }
      }
      return arr;
    },
    function onSelectionChanged(isColumnSelected, index, views) {
      if ( isColumnSelected ) {
        this.onSelect(index, views);
      } else if ( ! isColumnSelected ) {
        this.onUnSelect(index, views);
      }
    },
    function onGroupChanged(isColumnSelected, index, views, isChild) {
      if ( isColumnSelected ) {
        this.onSelectGroup(index, views, isChild);
      } else if ( ! isColumnSelected ) {
        this.onUnSelectGroup(index, views, isChild);
      }
    },
    function onSelect(draggableIndex, views) {
      var startUnselectedIndex = views.find(v => ! v.prop.isPropertySelected);
      if ( ! startUnselectedIndex )
        return;
      startUnselectedIndex =  startUnselectedIndex.index;

      if ( draggableIndex > startUnselectedIndex )
        return this.resetProperties(views, startUnselectedIndex, draggableIndex);
    },
    function onSelectGroup(draggableIndex, views, isChild) {
      var el = views[draggableIndex].prop;
      if ( this.groupByColumns.length > 0 ) {
        this.groupByColumns.forEach(element => {
          if ( ! isChild )
            element.isPropertyGrouped = false;
          if ( ! element.isPropertySelected )
            this.onUnSelect(element.index, views);
        });
        if ( ! isChild ) this.groupByColumns = [];
      }
      var currEl = views.find(v => v.prop.rootProperty == el.rootProperty);
      var tc = currEl.prop.rootProperty[0];
      if ( ! isChild ) {
        axiom = this.data.of.getAxiomByName(tc);
        this.data.groupBy = axiom;
      }
      this.groupByColumns.push(currEl.prop);
      this.resetProperties(views, 0, currEl.index);
    },
    function onUnSelect(draggableIndex, views) {
      if ( views[draggableIndex].prop.isPropertyGrouped ) return;
      var startUnselectedIndex = views.find(v => ! v.prop.isPropertyGrouped && ! v.prop.isPropertySelected && v.index !== draggableIndex);
      if ( ! startUnselectedIndex ) {
        return this.resetProperties(views, views.length - 1, draggableIndex);
      }
      startUnselectedIndex =  startUnselectedIndex.index;
      if ( startUnselectedIndex - draggableIndex === 1 ) {
        var currentProp = this.columnHandler.checkIfArrayAndReturnRootPropertyHeader(views[draggableIndex].prop.rootProperty);
        var comparedToProp =  this.columnHandler.checkIfArrayAndReturnRootPropertyHeader(views[startUnselectedIndex].prop.rootProperty);
        if ( currentProp.toLowerCase().localeCompare(comparedToProp.toLowerCase()) < 1 ) {
          return this.resetProperties(views, startUnselectedIndex-1, draggableIndex);
        }
      }
      while ( startUnselectedIndex < views.length ) {
        var currentProp = this.columnHandler.checkIfArrayAndReturnRootPropertyHeader(views[draggableIndex].prop.rootProperty);
        var comparedToProp =  this.columnHandler.checkIfArrayAndReturnRootPropertyHeader(views[startUnselectedIndex].prop.rootProperty);
        if ( currentProp.toLowerCase().localeCompare(comparedToProp.toLowerCase()) < 0 ) {
          break;
        }
        startUnselectedIndex++;
      }
      return this.resetProperties(views, startUnselectedIndex-1, draggableIndex);
    },
    function onUnSelectGroup(draggableIndex, views, isChild) {
      this.data.groupBy = undefined;
      this.groupByColumns = [];
      if ( ! views[draggableIndex].prop.isPropertySelected )
        this.onUnSelect(draggableIndex, views);
    },
    function getColumns() {
      var data = this.data;
      var arr = [];
      var notSelectedColumns = [];
      var colnames = data.selectedColumnNames.map(c =>
      {
        return this.columnHandler.propertyNamesForColumnArray(c)
      });

      if ( ! foam.Array.equals(colnames, data.selectedColumnNames) )
        data.selectedColumnNames = colnames;

      var tableColumns = this.data.columns;
      tableColumns = tableColumns.filter( c => data.allColumns.includes(this.columnHandler.propertyNamesForColumnArray(c))).map(c => this.columnHandler.propertyNamesForColumnArray(c));
      //to keep record of columns that are selected
      var topLevelProps = [];
      //or some kind of outputter might be used to convert property to number of nested properties eg 'address' to [ 'address.city', 'address.region', ... ]
      var columnThatShouldBeDeleted = [];
      for ( var i = 0 ; i < data.selectedColumnNames.length ; i++ ) {
        var rootProperty;
        if ( foam.String.isInstance(data.selectedColumnNames[i]) ) {
          var axiom;
          if ( data.selectedColumnNames[i].includes('.') )
            axiom = data.of.getAxiomByName(data.selectedColumnNames[i].split('.')[0]);
          else {
            axiom = tableColumns.find(c => c.name === data.selectedColumnNames[i]);
            if ( ! axiom )
              axiom = data.of.getAxiomByName(data.selectedColumnNames[i]);
          }
          if ( ! axiom  || foam.dao.DAOProperty.isInstance(axiom) || axiom.hidden ) {
            continue;
          }
          rootProperty = [ axiom.name, this.columnHandler.returnAxiomHeader(axiom) ];
        } else {
          rootProperty = data.selectedColumnNames[i];
          }
        var rootPropertyName = this.columnHandler.propertyNamesForColumnArray(rootProperty);
        if ( ! topLevelProps.includes(rootPropertyName) ) {
          arr.push(foam.u2.view.SubColumnSelectConfig.create({
            index: i,
            rootProperty: rootProperty,
            level: 0,
            of: data.of,
            selectedColumns$: data.selectedColumnNames$,
          }, this));
          topLevelProps.push(rootPropertyName);
        }
      }

      for ( var colToDelete of columnThatShouldBeDeleted ) {
        data.selectedColumnNames.splice(data.selectedColumnNames.indexOf(colToDelete), 1);
      }

      var notSelectedColumns = data.allColumns.filter(c => {
        return ! topLevelProps.includes(c);
      });
      // to add properties that are specified in 'tableColumns' as an option
      tableColumns = tableColumns.filter(c => ! topLevelProps.includes(c));
      for ( var i = 0 ; i < tableColumns.length ; i++ ) {
        var indexOfTableColumn = notSelectedColumns.indexOf(tableColumns[i]);
        if ( indexOfTableColumn === -1 ) {
          notSelectedColumns.push(tableColumns[i]);
        } else {
          notSelectedColumns.splice(indexOfTableColumn, 1, tableColumns[i]);
        }
      }
        var nonSelectedViewModels = [];
        for ( i = 0 ; i < notSelectedColumns.length ; i++ ) {
          var rootProperty;
          if ( this.columnHandler.canColumnBeTreatedAsAnAxiom(notSelectedColumns[i]) ) {
            rootProperty = notSelectedColumns[i];
          }
          else {
            var axiom =  tableColumns.find(c => c.name === notSelectedColumns[i]);
            axiom = axiom || data.of.getAxiomByName(notSelectedColumns[i]);
            if ( foam.dao.DAOProperty.isInstance(axiom) || axiom.hidden ) {
              continue;
            }
            rootProperty = [ axiom.name, this.columnHandler.returnAxiomHeader(axiom) ];
          }

          nonSelectedViewModels.push(foam.u2.view.SubColumnSelectConfig.create({
            index: data.selectedColumnNames.length + i,
            rootProperty: rootProperty,
            level: 0,
            of: data.of,
            selectedColumns$: data.selectedColumnNames$,
          }, this));
        }
        nonSelectedViewModels.sort((a, b) => {
          var aName = this.columnHandler.checkIfArrayAndReturnRootPropertyHeader(a.rootProperty);
          var bName = this.columnHandler.checkIfArrayAndReturnRootPropertyHeader(b.rootProperty);
          return aName.toLowerCase().localeCompare(bName.toLowerCase());
        });
      arr = arr.concat(nonSelectedViewModels);
      return arr;
    }
  ],

  listeners: [
    {
      name: 'onMenuSearchUpdate',
      isMerged: true,
      mergeDelay: 500,
      code: function() {
        var query = this.menuSearch.trim().toLowerCase()
        for ( var i = 0 ; i < this.columns.length ; i++ ) {
          this.columns[i].updateOnSearch(query);
        }
      }
    }
  ],

  actions: [
    {
      name: 'resetColumns',
      label: 'Reset Columns',
      code: function() {
        this.columnStorage.removeItem(this.data.of.id);
        this.data.selectedColumnNames = undefined;
        this.data.resetColWidths();
        this.data.updateColumns();
        this.columns = this.getColumns();
        if ( this.groupByColumns ) {
          this.groupByColumns.forEach(element => element.isPropertyGrouped = false);
          this.groupByColumns = [];
          this.data.groupBy = undefined;
        }
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'RootColumnConfigPropView',
  extends: 'foam.u2.Controller',
  imports: ['theme'],

  properties: [
    // {
    //   class: 'Boolean',
    //   name: 'draggable',
    //   documentation: 'Enable to allow drag&drop editing.'
    // },
    {
      class: 'foam.u2.ViewSpec',
      name: 'head',
      value: { class:'foam.u2.view.ColumnViewHeader'}
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'body',
      value: { class:'foam.u2.view.ColumnViewBody'}
    },
    {
      name: 'prop',
    },
    'index',
    {
      name: 'onDragAndDropParentFunction',
      documentation: 'parent\'s on this DragAndDrop function'
    },
    {
      name: 'onSelectionChangedParentFunction',
      documentation: 'parent\'s on this onSelectionChanged function'
    },
    {
      name: 'onGroupByChangedParentFunction',
      documentation: 'parent\'s on this onGroupChanged function'
    },
    {
      name: 'onDragAndDrop',
      documentation: 'to reuse onDragAndDrop function'
    },
    {
      name: 'onSelectionChanged',
      documentation: 'to reuse onSelectionChanged function'
    },
    {
       name: 'onGroupChanged',
       documentation: 'to reuse onGroupChanged function'
    }
  ],

  constants: [
    {
      name: 'ON_DRAG_OVER_BG_COLOR',
      type: 'String',
      value: '#e5f1fc'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();
      this
        .add(self.slot(function(prop) {
          return self.E()
          .attrs({ draggable: prop.isPropertySelected$ ? 'true' : 'false' })
          .callIf(prop.isPropertySelected$, function() {
            this.on('dragstart',   self.onDragStart.bind(self)).
              on('dragenter',   self.onDragOver.bind(self)).
              on('dragover',    self.onDragOver.bind(self)).
              on('dragleave',   self.onDragLeave.bind(self)).
              on('drop',        self.onDrop.bind(self));
          })
          .style({'cursor': prop.isPropertySelected$ ? 'pointer' : 'default'})
          .show(self.prop.showOnSearch$)
          .start()
            .add(foam.u2.ViewSpec.createView(self.head, {data$:self.prop$, onSelectionChangedParentFunction:self.onSelectionChangedParentFunction, onGroupByChangedParentFunction:self.onGroupByChangedParentFunction },  self, self.__subSubContext__))
          .end()
          .start()
            .add(foam.u2.ViewSpec.createView(self.body, {data$:self.prop$, onSelectionChangedParentFunction: this.onSelectionChangedParentFunction, onGroupByChangedParentFunction: this.onGroupByChangedParentFunction,  onDragAndDrop: this.onDragAndDrop, onSelectionChanged: this.onSelectionChanged, onGroupChanged: this.onGroupChanged },  self, self.__subSubContext__))
          .end();
        }));
    }
  ],

  listeners: [
    function onDragStart(e) {
      e.dataTransfer.setData('draggableId', this.index);
      e.stopPropagation();
    },
    function onDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.style.setProperty('background-color', this.theme ? this.theme.primary5 : this.ON_DRAG_OVER_BG_COLOR);
    },
    function onDragLeave(e) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.style.setProperty( 'background-color', this.theme ? this.theme.white : '#ffffff' );
    },
    function onDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.style.setProperty('background-color', this.theme ? this.theme.white : '#ffffff');
      this.onDragAndDropParentFunction(this.index, parseInt(e.dataTransfer.getData('draggableId')));
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'ColumnViewHeader',
  extends: 'foam.u2.View',

  imports: ['theme'],

  requires: [
    'foam.u2.CheckBox',
    'foam.u2.tag.Image'
  ],

  css: `
  ^selected {
    background: $blue50;
  }
  ^some-padding {
    text-align: left;
    padding: 4px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  ^some-padding:hover {
    background-color: $backgroundBrandTertiary;
    border-radius: 4px;
  }
  ^label {
    display: flex;
    align-items: center;
    justify-content: start;
    width: 100%;
  }
  ^selection-buttons + ^selection-buttons {
    padding: 8px;
  }
  ^labelText {
    flex: 1;
    overflow: hidden;
    padding-left: 8px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  `,

  properties: [
    'onSelectionChangedParentFunction',
    'onGroupByChangedParentFunction',
    {
      name: 'columnHandler',
      class: 'FObjectProperty',
      of: 'foam.core.column.CommonColumnHandler',
      factory: function() {
        return foam.core.column.CommonColumnHandler.create();
      }
    }
  ],

  methods: [
    function render() {
      var self = this;
      this.SUPER();
      this
        .on('click', this.toggleExpanded)
          .start()
            .addClass('p', this.myClass('some-padding'))
            .style({
              'padding-left': self.data.level * 16 + 8 + 'px',
              'padding-right': '8px'
            })
            .start()
              .addClass(this.myClass('label'))
              .start()
                .addClass(this.myClass('selection-buttons'))
                .add(this.CheckBox.create({ data$: this.data.isPropertySelected$ }))
                .on('click', this.toggleSelection)
              .end()
               .start()
                 .addClass(this.myClass('selection-buttons'))
                 .call(function() {
                   if ( self.data.level > 1 ) return;
                   if ( self.theme ) {
                     this.add(self.slot(function( data$isPropertyGrouped ) {
                       var image;
                       if ( self.data.isPropertyGrouped ) {
                         image = self.theme.glyphs.folderFill.getDataUrl({ fill: self.theme.primary3 });
                       } else {
                         image = self.theme.glyphs.folderOutline.getDataUrl({ fill: self.theme.grey2 });
                       }
                       return this.E()
                       .start(self.Image, { data: image , displayHeight: '1.5em' , displayWidth: '1.5em' })
                       .end()
                     }))
                   }
                   else {
                     this
                     .start().add(self.CheckBox.create({ data$: self.data.isPropertyGrouped$ }))
                     .end()
                   }
                 })
                 .on('click', this.toggleGroup)
               .end()
               .start()
                .addClass(self.myClass('labelText'))
                .add(this.columnHandler.checkIfArrayAndReturnRootPropertyHeader(this.data.rootProperty))
              .end()
            .end()
            .start()
              .show(this.data.hasSubProperties)
              .style({
                'vertical-align': 'middle',
                'visibility':     'visible',
                'float':          'right',
                'transform':      this.data.expanded$.map(function(c) { return c ? 'rotate(180deg)' : 'rotate(90deg)'; })
              })
              .addClass('h500')
              .on('click', this.toggleExpanded)
              .add('\u2303')
            .end()
          .end();
    }
  ],

  listeners: [
    function toggleSelection(e) {
      e.stopPropagation();
      if ( ! this.data.hasSubProperties || foam.lang.Reference.isInstance(this.data.prop) || foam.lang.FObjectProperty.isInstance(this.data.prop) ) {
        if ( ! this.data.isPropertySelected )
          this.data.expanded = false;
        this.onSelectionChangedParentFunction(this.data.isPropertySelected, this.data.index);
      }
    },
    function toggleGroup(e) {
      e.stopPropagation();
      if ( this.theme ) {
        this.data.isPropertyGrouped = ! this.data.isPropertyGrouped;
      }
      if ( ! this.data.hasSubProperties || foam.lang.Reference.isInstance(this.data.prop) || foam.lang.FObjectProperty.isInstance(this.data.prop) ) {
        if ( ! this.data.isPropertyGrouped )
          this.data.expanded = false;
        this.onGroupByChangedParentFunction(this.data.isPropertyGrouped, this.data.index);
      }
    },
    function toggleExpanded(e) {
      e.stopPropagation();
      if ( this.data.hasSubProperties )
        this.data.expanded = ! this.data.expanded;
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'ColumnViewBody',
  extends: 'foam.u2.View',
  requires: [
    'foam.u2.view.RootColumnConfigPropView'
  ],
  properties: [
    {
      name: 'views',
      expression: function(data$subColumnSelectConfig) {
        var arr = [];
        for ( var i = 0 ; i < this.data.subColumnSelectConfig.length ; i++ ) {
          arr.push(this.RootColumnConfigPropView.create({
            index: i,
            prop: this.data.subColumnSelectConfig[i],
            onDragAndDrop: this.onDragAndDrop,
            onSelectionChanged: this.onSelectionChanged,
            onGroupChanged: this.onGroupChanged,
            onSelectionChangedParentFunction: this.onChildrenSelectionChanged.bind(this),
            onGroupByChangedParentFunction: this.onChildrenGroupByChanged.bind(this),
            onDragAndDropParentFunction: this.onChildrenDragAndDrop.bind(this),
          }));
        }
        return arr;
      }
    },
    'onSelectionChangedParentFunction',
    'onGroupByChangedParentFunction',
    {
      name: 'onDragAndDrop',
      documentation: 'to reuse onDragAndDrop function'
    },
    {
      name: 'onSelectionChanged',
      documentation: 'to reuse onSelectionChanged function'
    },
    {
      name: 'onGroupChanged',
      documentation: 'to reuse onGroupChanged function'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      var self = this;
      this
        .start()
        .show(self.data.expanded$)
        .forEach(this.views$, function(v) {
          return this
            .show(self.data.expanded$)
            .add(v);
        })
      .end();
    },
    function updateSubColumnsOrder(selectionChanged) {
      //re-order subproperties
      this.data.subColumnSelectConfig.sort((a, b) => a.index > b.index ? 1 : -1);
      this.onSelectionChangedParentFunction(this.data.isPropertySelected, this.data.index, selectionChanged);
      this.onGroupByChangedParentFunction(this.data.isPropertyGrouped, this.data.index, selectionChanged, true);

    },
    function onChildrenDragAndDrop(targetIndex, draggableIndex) {
      this.onDragAndDrop(this.views, targetIndex, draggableIndex);
      this.updateSubColumnsOrder(true);
    },
    function onChildrenSelectionChanged(isColumnSelected, index, isColumnSelectionHaventChanged) {
      //isColumnSelectionHaventChanged to be false on either selectionChanged or being undefined
      if ( ! isColumnSelectionHaventChanged || foam.lang.Reference.isInstance(this.data.prop) || foam.lang.FObjectProperty.isInstance(this.data.prop) ) {
        //to change view
        this.onSelectionChanged(isColumnSelected, index, this.views);
        //to set currentProperty isColumnSelected
        var hasPropertySelectionChanged = this.data.isPropertySelected;
        //to re-check if isPropertySelected changed
        if ( this.data.isPropertySelected !== isColumnSelected ) {
          var anySelected = this.data.subColumnSelectConfig.find(s => s.isPropertySelected);
          if ( foam.lang.Reference.isInstance(this.data.prop) || foam.lang.FObjectProperty.isInstance(this.data.prop) ) {
            this.data.isPropertySelected = typeof anySelected !== 'undefined';
            //close if not selected
            if ( ! this.data.isPropertySelected )
              this.data.expanded = false;
          }
        }
        this.updateSubColumnsOrder( hasPropertySelectionChanged === this.data.isPropertySelected );
      } else {
        this.updateSubColumnsOrder(true);
      }
    },
    function onChildrenGroupByChanged(isColumnSelected, index, isColumnSelectionHaventChanged) {
      //isColumnSelectionHaventChanged to be false on either selectionChanged or being undefined
      if ( ! isColumnSelectionHaventChanged || foam.lang.Reference.isInstance(this.data.prop) || foam.lang.FObjectProperty.isInstance(this.data.prop) ) {
        //to change view
        this.onGroupChanged(isColumnSelected, index, this.views);
        //to set currentProperty isColumnSelected
        var hasPropertySelectionChanged = this.data.isPropertyGrouped;
        //to re-check if isPropertySelected changed
        if ( this.data.isPropertyGrouped !== isColumnSelected ) {
          var anySelected = this.data.subColumnSelectConfig.find(s => s.isPropertyGrouped);
          if ( foam.lang.Reference.isInstance(this.data.prop) || foam.lang.FObjectProperty.isInstance(this.data.prop) ) {
            this.data.isPropertyGrouped = typeof anySelected !== 'undefined';
            //close if not selected
            if ( ! this.data.isPropertyGrouped )
              this.data.expanded = false;
          }
        }
        this.updateSubColumnsOrder(hasPropertySelectionChanged === this.data.isPropertyGrouped);
      } else {
        this.updateSubColumnsOrder(true);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.u2.view',
  name: 'SubColumnSelectConfig',
  extends: 'foam.u2.View',
  properties: [
    'index',
    'of',
    {
      name: 'hasSubProperties',
      class: 'Boolean',
      expression: function(subProperties) {
        return subProperties.length > 0;
      }
    },
    {
      name: 'selectedColumns',
      documentation: 'array of names of selected proprties'
    },
    {
      name: 'prop',
      expression: function(rootProperty) {
        return this.of.getAxiomByName(this.columnHandler.checkIfArrayAndReturnPropertyNameForRootProperty(rootProperty)) || {};
      }
    },
    {
      name: 'subProperties',
      expression: function(prop) {
        if ( ! this.of || ! this.of.getAxiomByName )
          return [];
        if ( prop && prop.of && prop.cls_ && ( foam.lang.FObjectProperty.isInstance(prop) || ( foam.lang.Reference.isInstance(prop) && prop.showSubColumns ) ) )
          return prop.of.getAxiomsByClass(foam.lang.Property).map(p => { if ( ! foam.dao.DAOProperty.isInstance(p) )  return [p.name, this.columnHandler.returnAxiomHeader(p)] }).filter(e => e != undefined);
        return [];
      }
    },
    {
      name: 'subColumnSelectConfig',
      expression: function(subProperties, level, expanded) {
        return this.returnSubColumnSelectConfig(subProperties, level, expanded);
      }
    },
    {
      name: 'rootProperty'
    },
    {
      name: 'isPropertySelected',
      class: 'Boolean',
      factory: function() {
        var thisPropName = this.columnHandler.checkIfArrayAndReturnPropertyNameForRootProperty(this.rootProperty);
        return typeof this.selectedColumns.find(s => {
          var propName = foam.String.isInstance(s) ? s.split('.') : s.name;
          return foam.Array.isInstance(propName) ? ( this.level < propName.length && propName[this.level] === thisPropName ) : thisPropName === propName;
        }) !== 'undefined';
      }
    },
    {
      name: 'isPropertyGrouped',
      class: 'Boolean'
    },
    {
      name: 'level',
      class: 'Int',
    },
    {
      name: 'parentExpanded',
      class: 'Boolean',
      value: false,
      postSet: function(_, n) {
        if ( ! n )
          this.expanded = false;
      }
    },
    {
      name: 'expanded',
      class: 'Boolean'
    },
    {
      name: 'showOnSearch',
      class: 'Boolean',
      value: true
    },
    {
      name: 'columnHandler',
      class: 'FObjectProperty',
      of: 'foam.core.column.CommonColumnHandler',
      factory: function() {
        return foam.core.column.CommonColumnHandler.create();
      }
    }
  ],
  methods: [
    function onClose() {
      this.subColumnSelectConfig.forEach(c => c.onClose());
      this.expanded = false;
    },
    function returnSelectedProps() {
      if ( this.hasSubProperties ) {
        var arr = [];
        for ( var i = 0 ; i < this.subColumnSelectConfig.length ; i++ ) {
          if ( this.subColumnSelectConfig[i].isPropertySelected ) {
            var childProps = this.subColumnSelectConfig[i].returnSelectedProps();
            if ( ! childProps.length ) {
              arr.push(this.rootProperty[0]);
            } else {
              for ( var j = 0 ; j < childProps.length ; j++ ) {
                arr.push([this.rootProperty[0], childProps[j]].filter(Boolean).join('.'));
              }
            }
          }
        }
        if ( arr && arr.length > 0 )
          return arr;
      }
      if ( this.level === 0 ) {
        if ( foam.Array.isInstance(this.rootProperty) )
          return [this.rootProperty[0]];
        return [this.rootProperty];
      }
      return [this.rootProperty[0]];
    },
    function updateOnSearch(query) {
      this.showOnSearch = false;
      this.expanded = false;
      if ( query.length == 0 ) { this.showOnSearch = true; this.expanded = false; return this.showOnSearch; }
      this.showOnSearch = foam.Array.isInstance(this.rootProperty) ? this.rootProperty[1].toLowerCase().includes(query) : this.rootProperty.name.toLowerCase().includes(query);
      if ( this.hasSubProperties && this.level < 2 ) {
        this.expanded = false;
        if ( this.subColumnSelectConfig.length == 0 )
          this.subColumnSelectConfig = this.returnSubColumnSelectConfig(this.subProperties, this.level, this.expanded, true);
        for ( var  i = 0 ; i < this.subColumnSelectConfig.length ; i++ ) {
          if ( this.subColumnSelectConfig[i].updateOnSearch(query) ) {
            this.expanded = true;
            this.showOnSearch = true;
          }
        }
      }
      return this.showOnSearch;
    },
    function returnSubColumnSelectConfig(subProperties, level, expanded, ignoreExpanded ) {
      var arr = [];
      if ( ! this.of || ! this.of.getAxiomByName || subProperties.length === 0 )
          return arr;

      var thisRootPropName = this.columnHandler.checkIfArrayAndReturnPropertyNameForRootProperty(this.rootProperty);
      //find selectedColumn for the root property
      var selectedColumn = this.selectedColumns.filter(c => {
        var thisSelectedColumn = foam.String.isInstance(c) ? c : c.name;
        return ( ! foam.String.isInstance(c) && this.level === 0 && thisSelectedColumn === thisRootPropName ) ||
        ( foam.String.isInstance(c) && c.split('.').length >= this.level && c.split('.')[this.level] === this.rootProperty[0] );
      });
      // Don't empty config if there are selected properties
      if ( selectedColumn.length < 2 && ( ! ignoreExpanded && ! expanded ) )
        return arr;

      var l = level + 1;
      var r = this.of.getAxiomByName(this.rootProperty[0]);
      if ( ! r )
        return arr;

      var selectedSubProperties = [];
      var otherSubProperties = [];

      if ( selectedColumn.find(c => foam.String.isInstance(c) && c.split('.').length == ( this.level + 1 )) ) {
        selectedSubProperties.push(['', 'To Summary']);
      } else {
        otherSubProperties.push(['', 'To Summary']);
      }

      for ( var i = 0 ; i < subProperties.length ; i++ ) {
        //the comparison mentioned above is working with the assumption that columns which are specified in 'tableColumns' are top-level properties and
        //we are not using nested "custom" table columns
        if ( selectedColumn.find(c => foam.String.isInstance(c) && c.split('.').length > ( this.level + 1 ) && c.split('.')[this.level+1] === subProperties[i][0]) ) {
          selectedSubProperties.push(subProperties[i]);
        } else {
          otherSubProperties.push(subProperties[i]);
        }
      }
      otherSubProperties.sort((a, b) => { return a[1].toLowerCase().localeCompare(b[1].toLowerCase());});

      for ( var i = 0 ; i < selectedSubProperties.length ; i++ ) {
        arr.push(this.cls_.create({
          index: i,
          rootProperty: selectedSubProperties[i],
          selectedColumns$: this.selectedColumns$,
          level: l,
          parentExpanded$: this.expanded$,
          of: r.of,
          isPropertySelected: true,
          isPropertyGrouped: false
        }));
      }

      for ( var i = 0 ; i < otherSubProperties.length ; i++ ) {
        arr.push(this.cls_.create({
          index: selectedSubProperties.length + i,
          rootProperty: otherSubProperties[i],
          selectedColumns$: this.selectedColumns$,
          level:l, parentExpanded$: this.expanded$,
          of: r.of,
          isPropertySelected: false,
          isPropertyGrouped: false
        }, this));
      }
      return arr;
    }
  ]
});

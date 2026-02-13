/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'LazyScrollManager',
  extends: 'foam.u2.View',
  mixins: [ 'foam.u2.memento.Memorable' ],

  documentation: 'A configurable scroll manager that dynamically lazy loads dao data',

  requires: [
    'foam.dao.FnSink',
    'foam.lang.Latch',
    'foam.dao.ProxyDAO',
    'foam.mlang.sink.Count',
    'foam.u2.LoadingSpinner'
  ],

  implements: [
    'foam.mlang.Expressions'
  ],

  imports: ['config'],

  constants: [
    {
      type: 'Float',
      name: 'MIN_PAGE_PROGRESS',
      documentation: `
       If the top or bottom page is scrolled by this amount update the currentTopPage_ accordingly
      `,
      value: 0.25
    },
    {
      type: 'Integer',
      name: 'NUM_PAGES_TO_RENDER',
      value: 3
    }
  ],

  messages: [
    { name: 'NO_DATA', message: 'No ${modelName} found', template: true }
  ],

  css: `
    ^no-data{
      display:flex;
      height: 100%;
      justify-content: center;
      align-items: center;
    }
  `,

  properties: [
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      class: 'Int',
      name: 'daoCount'
    },
    {
      type: 'Int',
      name: 'pageSize_',
      // Used to prevent extra large datasets being requested as it caused chrome to crash
      max: 1000,
      factory: function() { return this.pageSize; },
      documentation: 'The number of items in each "page". There are three pages.'
    },
    {
      type: 'Int',
      name: 'pageSize',
      // Used to prevent extra large datasets being requested as it caused chrome to crash
      max: 1000,
      value: 50,
      documentation: 'The number of items in each "page". There are three pages.'
    },
    {
      class: 'Int',
      name: 'numPages_',
      expression: function(daoCount, pageSize_) {
        return Math.ceil(daoCount / pageSize_);
      }
    },
    {
      class: 'Int',
      name: 'currentTopPage_',
      factory: function() { return 0; },
      preSet: function(o, n) {
        return foam.Number.clamp(0, n, this.numPages_ - this.NUM_PAGES_TO_RENDER );
      }
    },
    {
      class: 'Map',
      name: 'renderedPages_'
    },
    {
      class: 'Map',
      name: 'loadingPages_',
      documentation: 'Used to ensure pages that are currently being loaded are not reloaded/duplicated'
    },
    {
      class: 'Int',
      name: 'topRow',
      memorable: true,
      documentation: 'Stores the index top row that is currently displayed in the table',
      postSet: function(o, n) {
        if ( this.scrollToIndex || o == n ) return;
        var n1 = (n-(this.currentTopPage_*this.pageSize_))/this.pageSize_;
        if ( n < o && n1 <= 1 && n1 < 1 - this.MIN_PAGE_PROGRESS ) {
          this.currentTopPage_ --;
        }
      }
    },
    {
      class: 'Int',
      name: 'bottomRow',
      documentation: 'Stores the index of last row that is currently displayed in the table',
      postSet: function(o, n) {
        if ( this.scrollToIndex || o == n ) return;
        var n1 = (n-(this.currentTopPage_*this.pageSize_))/this.pageSize_;
        if ( n > o && n1 >= this.NUM_PAGES_TO_RENDER - 2 && n1%1 >= this.MIN_PAGE_PROGRESS ) {
          this.currentTopPage_++;
        }
      }
    },
    {
      class: 'Float',
      name: 'displayedRowCount_',
      documentation: 'Stores the number of rows that are currently displayed in the div height',
      expression: function(topRow, bottomRow) {
        return topRow && bottomRow ? bottomRow - topRow : 0;
      }
    },
    {
      class: 'Int',
      name: 'scrollToIndex',
      postSet: function () { 
          this.safeScroll(); 
      }
    },
    'rowObserver',
    {
      name: 'rootElement',
      documentation: 'FOAM element that is used as the observation bounds for intersectionManager'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'rowView'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'groupHeaderView'
    },
    {
      class: 'FObjectProperty',
      name: 'groupBy',
      documentation: 'An expression which returns the group title. Can be a Property.'
    },
    {
      class: 'Boolean',
      name: 'invertGroupingOrder',
      documentation: 'GroupBy returns groups in ascending order, use this to flip that behaviour'
    },
    {
      class: 'FObjectProperty',
      name: 'order',
      documentation: 'Optional order used to sort citations within a group'
    },
    {
      name: 'ctx',
      documentation: 'A context variable that is passed to the prepDAO function'
    },
    {
      class: 'Function',
      name:'prepDAO',
      documentation: `Function that is run before each page is loaded on a limited DAO,
      should always return a promise, can be used to create projections`,
      factory: function() {
        return function(dao) { return dao.select(); }
      }
    },
    {
      name: 'appendTo',
      factory: function() { return this.parentNode; },
      documentation: 'FOAM element that the ScrollManager adds rows to. Defaults to parentNode to avoid layout shifts'
    },
    {
      class: 'Int',
      name: 'offsetTop',
      value: 0,
      documentation: 'Offset property that is passed to IntersectionObserver'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.Latch',
      name: 'dataLatch',
      documentation: 'A latch used to wait for table data load.',
      factory: function () {
        return this.Latch.create();
      }
    },
    {
      class: 'Boolean',
      name: 'daoLoading',
      value: true
    },
    ['isInit', true],
    {
      class: 'Map',
      name: 'collapsedGroups',
      factory: function() { return {}; }
    },
    {
      class: 'Map',
      name: 'groupFirstPage_',
      documentation: 'Tracks the first page where each group appears to ensure headers show only once',
      factory: function() { return {}; }
    },
    ['suspendObserver', false]
  ],

  methods: [
    function init() {
      this.onDetach(this.data$proxy.listen(this.FnSink.create({
        fn: () => {
          this.updateCount();
        }
      })));
      this.updateCount();
      this.dataLoading = false;
    },

    async function render() {
      this.appendTo.id = 'id' + this.$UID;

      var self = this;
      var resize = new ResizeObserver (this.checkPageSize_);
      let root = await this.rootElement.el()
      let options = {
        root: root ?? null,
        rootMargin: `-${this.offsetTop}px 0px 0px`,
        threshold: [0, 0.25, 0.5, 0.75]
      };

      // defer till after atleast one page has been loaded in order
      // to ensure correct value for displayedRowCount_
      this.dataLatch.then(() => {
        this.rootElement?.el().then(el => {
          resize.observe(el);
        })
      })
      // Render empty view if dao is empty
      // Change to dynamic after U3
      this.appendTo.add(this.slot(function(daoCount, isInit, daoLoading) {
        if (daoLoading) {
          return this.E().addClass(self.myClass('no-data'))
          .tag(this.LoadingSpinner, { size: 48 });
        }
        if ( isInit || daoCount ) return;
        return this.E().addClass(self.myClass('no-data'))
          .add(self.NO_DATA({ modelName: self.config?.browseTitle ?? 'data' }));
      }));

      this.rowObserver = new IntersectionObserver(handleIntersect, options);
      // This needs to be here because intersectionObserver does not bind the correct this during callback
      function handleIntersect(entries, observer) {
        self.onRowIntersect(entries, self);
      }
      this.onDetach(() => {
        // might already be disconnected
        try { resize.disconnect(); } catch(x) {}
      });
      this.onDetach(() => {
        // might already be disconnected
        try { this.rowObserver.disconnect(); } catch(x) {}
      });
      this.onDetach(this.rootElement$.sub(this.updateRenderedPages_));
      this.onDetach(this.order$.sub(this.refresh));
      this.onDetach(this.groupBy$.sub(this.refresh));
    },

    function scrollView(scroll) {
      if ( this.rootElement.el_() )
        this.rootElement.el_().scrollTop = scroll - this.offsetTop;
      this.scrollToIndex = undefined;
    },

    function safeScroll() {
      if ( ! this.scrollToIndex ) return;
      var page = Math.floor(this.scrollToIndex/this.pageSize_);
      if ( this.renderedPages_[page] ) {
        var el = document.querySelector(`#${this.appendTo.id} [data-idx='${this.scrollToIndex}']`);
        if ( ! el ) return;
        this.scrollView(el.offsetTop);
      } else {
        if ( page == 0 && this.currentTopPage_ != 0 ) {
          this.currentTopPage_ = 0;
          return;
        }
        if ( page == this.numPages_ - 1 && this.currentTopPage_ != this.numPages_ - this.NUM_PAGES_TO_RENDER ) {
          this.currentTopPage_ = this.numPages_ - this.NUM_PAGES_TO_RENDER;
          return;
        }
        if ( page != this.currentTopPage_ + 1 ) {
          this.currentTopPage_ = page - 1;
          return;
        }
      }
    },

    function clearPage(page, opt_skipObserver) {
      ! opt_skipObserver && this.renderedPages_[page].childNodes?.forEach((e) => {
        if ( e.el_() )
          this.rowObserver.unobserve(e.el_());
      })
      this.renderedPages_[page].remove();
      delete this.renderedPages_[page];
    },

    function getPage(dao, page) {
      var self       = this;
      var proxy      = this.ProxyDAO.create({ delegate: dao });
      var sortParams = [];

      if ( this.groupBy )
        sortParams.push(this.invertGroupingOrder ? this.DESC(this.groupBy) : this.groupBy)

      if ( this.order ) sortParams.push(this.order)

      if ( sortParams.length ) proxy = proxy.orderBy(sortParams);

      self.loadingPages_$set(page);

      let promise = this.prepDAO(proxy, this.ctx);
      var e       = this.E().attr('data-page', page);

      return promise.then(values => {
        function populateRows(args) {
          if ( args.data === undefined ) return;

          var index = (page*self.pageSize_) + i + 1;
          var group = null;
          var showHeader = false;

          if ( self.groupBy ) {
            group = self.groupBy.f(args.data);
            var groupKey = foam.json.stringify(group);

            // Track if this is the first time we've seen this group
            if ( self.groupFirstPage_[groupKey] === undefined ) {
              self.groupFirstPage_[groupKey] = page;
            }

            // Show header only if this is the first page where this group appears
            // and it's different from the previous group in this page
            if ( page === self.groupFirstPage_[groupKey] ) {
              showHeader = ! foam.util.equals(group, previousGroup);
            }

            if ( showHeader ) {
              e.tag(self.groupHeaderView,
                { ...args,
                  groupLabel: group,
                  groupBy: self.groupBy,
                }
              );
            }

            previousGroup = group;
          }

          var isEven = (index + 1) % 2 !== 0 ;
          var rowEl = e.start(self.rowView, args).attr('data-idx', index).attr('data-even', isEven);
          rowEl.el().then(a => {
            self.rowObserver.observe(a)
          });
        };

        var previousGroup = null;

        if ( foam.mlang.sink.Projection.isInstance( values ) ) {
          for ( var i = 0 ; i < values.projection.length ; i++ ) {
            let args = { data: values.array[i], projection: values.projection[i] };
            populateRows(args);
          }
        } else if ( foam.dao.Sink.isInstance( values ) && values.array ) {
          for ( var i = 0 ; i < values.array.length ; i++ ) {
            let args = { data: values.array[i] };
            populateRows(args);
          }
        }

        var isSet = false;
        if ( self.renderedPages_[page] ) {
          console.warn('Trying to overwrite a loaded page without clearing....Clearing page');
          this.clearPage(page)
        }

        Object.keys(self.renderedPages_).forEach(j => {
          if ( j > page && self.renderedPages_[j] && ! isSet ) {
            this.appendTo.insertBefore(e, self.renderedPages_[j]);
            isSet = true;
            // TODO: Figure out why scrolling to the top causes you to go to first page
          }
        });

        if ( ! isSet ) { this.appendTo.add(e); isSet = true; }

        self.renderedPages_[page] = e;
        // self.loadingPages_[page]  = false;
        self.loadingPages_$remove(page);

        // If there is a scroll in progress and all pages have been loaded, try to scroll again
        if ( this.scrollToIndex && Object.keys(this.renderedPages_).length == Math.min(this.NUM_PAGES_TO_RENDER, this.numPages_) )
          self.safeScroll();

        this.dataLatch.resolve();
        if ( this.displayedRowCount_ < 0 ) this.bottomRow = this.daoCount
      });
    },

    async function processPageSequentially_(pageIndex) {
      if ( pageIndex >= Math.min(this.numPages_, this.NUM_PAGES_TO_RENDER) ) {
        this.daoLoading = false;
        return Promise.resolve();
      }

      var page = this.currentTopPage_ + pageIndex;
      if ( this.renderedPages_[page] || this.loadingPages_[page] ) {
        // Skip this page and move to next
        return this.processPageSequentially_(pageIndex + 1);
      }

      var skip = page * this.pageSize_;
      var dao  = this.data.limit(this.pageSize_).skip(skip);

      return await this.getPage(dao, page).then(() => {
        console.log('Processed', pageIndex);
        // Process next page after this one completes
        return this.processPageSequentially_(pageIndex + 1);
      });
    }
  ],

  listeners: [
    {
      name: 'checkPageSize_',
      isFramed: true,
      documentation: 'Ensure page size is always atleast as large as the displayedRowCount_',
      code: function () {
        let old = this.pageSize_;
        if ( this.displayedRowCount_ && this.displayedRowCount_ != this.pageSize_ ) {
          if (  this.pageSize < this.displayedRowCount_) {
            this.pageSize_ = this.displayedRowCount_;
          } else {
            this.pageSize_ = this.pageSize;
          }
          if ( old != this.pageSize_ )
            this.refresh();
        }
      }
    },
    {
      name: 'refresh',
      isFramed: true,
      code: function() {
        this.rowObserver?.disconnect();
        // Don't clear loadingPages_ here since they are being
        // loaded and will have latest data anyway
        Object.keys(this.renderedPages_).forEach(i => {
          this.clearPage(i, true);
        });
        // Clear group first page tracking
        this.groupFirstPage_ = {};
        if ( ! this.isInit ) {
          this.currentTopPage_ = 0;
          this.topRow = 0;
          this.bottomRow = 0;
        }
        this.isInit = false;
        this.updateRenderedPages_();
        if ( this.topRow > 1) {
          this.scrollToIndex = this.topRow;
        }
      }
    },
    {
      name: 'updateCount',
      isFramed: true,
      code: function() {
        var limit = ( this.data && this.data.limit_ ) || undefined;
        this.daoLoading = true;
        return this.data$proxy.select(this.Count.create()).then(s => {
          this.daoCount = limit && limit < s.value ? limit : s.value;
          this.daoLoading = false;
          this.refresh();
        });
      }
    },
    {
      name: 'updateRenderedPages_',
      isIdled: true,
      delay: 100,
      on: [
        'this.propertyChange.currentTopPage_'
      ],
      code: function() {
        let currentTopPage_ = this.currentTopPage_;
        // If grouping is enabled, process pages sequentially to maintain group order
        // Otherwise, process in parallel for better performance
        this.suspendObserver = true;
        let promise = Promise.resolve();
        if ( this.groupBy ) {
          promise = this.processPageSequentially_(0);
        } else {
          let promiseArr = [];
          // Add any pages that are not already rendered.
          for ( var i = 0; i < Math.min(this.numPages_, this.NUM_PAGES_TO_RENDER) ; i++ ) {
            var page = this.currentTopPage_ + i;
            if ( this.renderedPages_[page] || this.loadingPages_[page] ) continue;
            var skip = page * this.pageSize_;
            var dao  = this.data.limit(this.pageSize_).skip(skip);
            promiseArr.push(this.getPage(dao, page));
          }
          // If there is nothing to load, we should not set daoLoading to false
          if ( promiseArr.length !== 0 ){
            promise = Promise.all(promiseArr).then(()=>{
              this.daoLoading = false;
            });
          }
        }
        promise.finally(() => {
          Object.keys(this.renderedPages_).forEach(i => {
            if ( (i >= this.currentTopPage_ + this.NUM_PAGES_TO_RENDER) || i < this.currentTopPage_ ) {
              this.clearPage(i);
            }
          });
          // Wait to delete pages to fix scroll jumping and causing issues
          // this.rootElement.addEventListener('scroll', this.onScrollEnd);  
          if ( ! this.scrollToIndex ) {
            this.scrollToIndex = this.topRow;
            this.suspendObserver = false;
          } else {
            this.suspendObserver = false;
            this.safeScroll();
          }
        })
      }
    },
    // {
    //   name: 'onScrollEnd',
    //   isIdled: true,
    //   delay: 200,
    //   code: function() {
    //     // Remove any pages that are no longer on screen to save on
    //     // the amount of DOM we add to the page.
        
    //     this.removeEventListener('scroll', this.onScrollEnd);
    //   }
    // },
    {
      name: 'onRowIntersect',
      isFramed: true,
      code: function(entries, self){
        let intersectingSet = false;
        entries.forEach((entry) => {
          if ( entry.intersectionRatio == 0 ) return;
          intersectingSet = true;
          if ( self.suspendObserver && self.scrollToIndex ) return;
          var index = Number(entry.target.dataset.idx);
          if ( entry.boundingClientRect.top <= entry.rootBounds.top ) {
            if ( entry.boundingClientRect.top + (entry.boundingClientRect.height/2) <= entry.rootBounds.top )
              index += 1;

            self.topRow = index;
          } else if( entry.boundingClientRect.bottom >= entry.rootBounds.bottom ) {
            if ( entry.boundingClientRect.top + (entry.boundingClientRect.height/2) >= entry.rootBounds.bottom )
              index -= 1;

            if ( index > 0 )
              self.bottomRow = index;
          }
        });

        if ( ! intersectingSet ) return
        // Only applicable for grouped lists as group headers would be the ones intersecting and the "topRow" would eval to 0 in the code above
        if ( ! self.topRow && entries.length ) {
          self.topRow = entries[0].target.dataset.idx;
        }

        if ( ! self.bottomRow && self.displayedRowCount_ <= 0 )
          self.bottomRow = self.pageSize_ > entries.length ? entries.length : self.pageSize_;
      }
    }
  ],

  actions: [
    // All of these can be used by views that use this view for navigation
    {
      name: 'nextPage',
      toolTip: 'Next Page',
      isEnabled: function(bottomRow, daoCount, suspendObserver) {
        return ! suspendObserver && bottomRow != daoCount;
      },
      code: function() {
        var n = foam.Number.clamp(1,this.topRow + this.displayedRowCount_ + 1,this.daoCount);
        this.scrollToIndex = n;
      }
    },
    {
      name: 'lastPage',
      toolTip: 'Last Page',
      isEnabled: function(bottomRow, daoCount, suspendObserver) {
        return ! suspendObserver && bottomRow != daoCount;
      },
      code: function() {
        this.scrollToIndex = this.daoCount;
      }
    },
    {
      name: 'prevPage',
      toolTip: 'Previous Page',
      isEnabled: function(topRow, suspendObserver) {
        return ! suspendObserver && topRow > 1;
      },
      code: function() {
        var n = foam.Number.clamp(1,this.topRow - this.displayedRowCount_, this.daoCount);
        this.scrollToIndex = n;
      }
    },
    {
      name: 'firstPage',
      toolTip: 'First Page',
      isEnabled: function(topRow, suspendObserver) {
        return ! suspendObserver && topRow > 1;
      },
      code: function() {
        this.scrollToIndex = 1;
      }
    }
  ]
});

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
      max: 1000,
      factory: function() { return this.pageSize; },
      documentation: 'The number of items in each page.'
    },
    {
      type: 'Int',
      name: 'pageSize',
      max: 1000,
      value: 50,
      documentation: 'The number of items in each page.'
    },
    {
      class: 'Int',
      name: 'numPages_',
      expression: function(daoCount, pageSize_) {
        return Math.ceil(daoCount / pageSize_);
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
      documentation: 'Stores the index top row that is currently displayed in the table'
    },
    {
      class: 'Int',
      name: 'bottomRow',
      documentation: 'Stores the index of last row that is currently displayed in the table'
    },
    {
      class: 'Float',
      name: 'displayedRowCount_',
      documentation: 'Stores the number of rows that are currently displayed in the div height',
      expression: function(topRow, bottomRow) {
        return bottomRow > topRow ? bottomRow - topRow : 0;
      }
    },
    {
      class: 'Int',
      name: 'scrollToIndex',
      postSet: function () {
          this.safeScroll();
      }
    },
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
    {
      class: 'Map',
      name: 'pageHeights_',
      documentation: 'Cache of measured pixel heights per page number',
      factory: function() { return {}; }
    },
    {
      class: 'Float',
      name: 'estimatedRowHeight_',
      value: 48,
      documentation: 'Rolling average row height for estimating unloaded page heights'
    },
    {
      class: 'Int',
      name: 'totalMeasuredRows_',
      documentation: 'Total number of rows measured so far, used for rolling average'
    },
    {
      class: 'Float',
      name: 'totalMeasuredHeight_',
      documentation: 'Total measured height in pixels, used for rolling average'
    },
    {
      class: 'Int',
      name: 'firstLoadedPage_',
      documentation: 'Index of the first currently rendered page'
    },
    {
      class: 'Int',
      name: 'lastLoadedPage_',
      value: -1,
      documentation: 'Index of the last currently rendered page. -1 means no pages loaded.'
    },
    {
      class: 'Int',
      name: 'overscan',
      value: 1,
      documentation: 'Number of extra pages to keep rendered beyond the viewport in each direction'
    },
    'topSpacer_',
    'bottomSpacer_',
    'topSentinel_',
    'bottomSentinel_',
    'sentinelObserver_'
  ],

  methods: [
    function init() {
      this.onDetach(this.data$proxy.listen(this.FnSink.create({
        fn: () => {
          this.updateCount();
        }
      })));
      this.updateCount();
      this.daoLoading = false;
    },

    async function render() {
      this.appendTo.id = 'id' + this.$UID;

      var self = this;
      var root = await this.rootElement.el();

      this.topSpacer_      = this.E('div').style({ height: '0px' });
      this.topSentinel_    = this.E('div').style({ height: '1px', width: '100%' });
      this.bottomSentinel_ = this.E('div').style({ height: '1px', width: '100%' });
      this.bottomSpacer_   = this.E('div').style({ height: '0px' });

      this.appendTo.add(this.topSpacer_);
      this.appendTo.add(this.topSentinel_);
      this.appendTo.add(this.bottomSentinel_);
      this.appendTo.add(this.bottomSpacer_);

      // Empty state / loading spinner
      this.appendTo.add(this.slot(function(daoCount, isInit, daoLoading) {
        if ( daoLoading ) {
          return this.E().addClass(self.myClass('no-data'))
            .tag(self.LoadingSpinner, { size: 48 });
        }
        if ( isInit || daoCount ) return;
        return this.E().addClass(self.myClass('no-data'))
          .add(self.NO_DATA({ modelName: self.config?.emptyLabel ?? 'Data' }));
      }));

      var options = {
        root: root ?? null,
        rootMargin: this.offsetTop + 'px 0px 200px 0px',
        threshold: [0]
      };
      this.sentinelObserver_ = new IntersectionObserver(function(entries) {
        self.onSentinelIntersect(entries);
      }, options);

      this.topSentinel_.el().then(function(el) { if ( el ) self.sentinelObserver_.observe(el); });
      this.bottomSentinel_.el().then(function(el) { if ( el ) self.sentinelObserver_.observe(el); });

      if ( root ) {
        root.addEventListener('scroll', this.onScroll, { passive: true });
        this.onDetach(function() { root.removeEventListener('scroll', self.onScroll); });
      }

      this.onDetach(function() {
        try { self.sentinelObserver_.disconnect(); } catch (x) {}
      });

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
      var targetIndex = this.scrollToIndex;
      var targetPage = Math.floor((targetIndex - 1) / this.pageSize_);

      if ( this.renderedPages_[targetPage] ) {
        var el = document.querySelector('#' + this.appendTo.id + " [data-idx='" + targetIndex + "']");
        if ( el ) {
          this.scrollView(el.offsetTop);
          return;
        }
      }

      var self = this;
      Object.keys(this.renderedPages_).forEach(function(i) { self.clearPage(i); });
      this.renderedPages_ = {};
      this.loadingPages_ = {};
      this.groupFirstPage_ = {};

      var from = Math.max(0, targetPage - 1);
      var to   = Math.min(this.numPages_, targetPage + 2 + this.overscan);
      this.firstLoadedPage_ = from;
      this.lastLoadedPage_ = from - 1;
      this.updateSpacers_();

      function loadAndTrack(page) {
        var skip = page * self.pageSize_;
        var dao  = self.data.limit(self.pageSize_).skip(skip);
        return self.getPage(dao, page).then(function() {
          self.measurePage_(page);
          if ( page > self.lastLoadedPage_ ) self.lastLoadedPage_ = page;
          if ( page < self.firstLoadedPage_ ) self.firstLoadedPage_ = page;
        });
      }

      function onAllLoaded() {
        self.updateSpacers_();
        var el = document.querySelector('#' + self.appendTo.id + " [data-idx='" + targetIndex + "']");
        if ( el ) {
          self.scrollView(el.offsetTop);
        }
        self.daoLoading = false;
        self.dataLatch.resolve();
      }

      if ( this.groupBy ) {
        // Sequential loading to preserve group header order
        var chain = Promise.resolve();
        for ( var p = from ; p < to ; p++ ) {
          chain = chain.then(loadAndTrack.bind(null, p));
        }
        chain.then(onAllLoaded);
      } else {
        var promises = [];
        for ( var p = from ; p < to ; p++ ) {
          promises.push(loadAndTrack(p));
        }
        Promise.all(promises).then(onAllLoaded);
      }
    },

    function clearPage(page) {
      if ( ! this.renderedPages_[page] ) return;
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

      self.loadingPages_$set(page, true);

      var promise = this.prepDAO(proxy, this.ctx);
      var e       = this.E().attr('data-page', page);

      return promise.then(function(values) {
        function populateRows(args) {
          if ( args.data === undefined ) return;

          var index = (page * self.pageSize_) + i + 1;
          var group = null;
          var showHeader = false;

          if ( self.groupBy ) {
            group = self.groupBy.f(args.data);
            var groupKey = foam.json.stringify(group);

            if ( self.groupFirstPage_[groupKey] === undefined ) {
              self.groupFirstPage_[groupKey] = page;
            }

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
          e.start(self.rowView, args).attr('data-idx', index).attr('data-even', isEven);
        };

        var previousGroup = null;

        if ( foam.mlang.sink.Projection.isInstance( values ) ) {
          for ( var i = 0 ; i < values.projection.length ; i++ ) {
            var args = { data: values.array[i], projection: values.projection[i] };
            populateRows(args);
          }
        } else if ( foam.dao.Sink.isInstance( values ) && values.array ) {
          for ( var i = 0 ; i < values.array.length ; i++ ) {
            var args = { data: values.array[i] };
            populateRows(args);
          }
        }

        if ( self.renderedPages_[page] ) {
          console.warn('Trying to overwrite a loaded page without clearing....Clearing page');
          self.clearPage(page);
        }

        // Insert in correct page order between sentinels
        var inserted = false;
        Object.keys(self.renderedPages_).sort(function(a, b) { return a - b; }).forEach(function(j) {
          if ( j > page && self.renderedPages_[j] && ! inserted ) {
            self.appendTo.insertBefore(e, self.renderedPages_[j]);
            inserted = true;
          }
        });
        if ( ! inserted ) {
          self.appendTo.insertBefore(e, self.bottomSentinel_);
        }

        self.renderedPages_[page] = e;
        self.loadingPages_$remove(page);

        self.dataLatch.resolve();
      });
    },

    function loadPage_(page) {
      if ( this.renderedPages_[page] || this.loadingPages_[page] ) return;
      if ( page < 0 || page >= this.numPages_ ) return;

      var self = this;
      var skip = page * this.pageSize_;
      var dao  = this.data.limit(this.pageSize_).skip(skip);

      this.getPage(dao, page).then(function() {
        self.measurePage_(page);

        if ( self.lastLoadedPage_ < 0 || page < self.firstLoadedPage_ ) {
          self.firstLoadedPage_ = page;
        }
        if ( page > self.lastLoadedPage_ ) {
          self.lastLoadedPage_ = page;
        }

        self.updateSpacers_();
        self.evictDistantPages_();
        self.dataLatch.resolve();
      });
    },

    function estimatePageHeight_(page) {
      if ( this.pageHeights_[page] !== undefined ) return this.pageHeights_[page];
      var rows = (page === this.numPages_ - 1)
        ? this.daoCount - page * this.pageSize_
        : this.pageSize_;
      return rows * this.estimatedRowHeight_;
    },

    function calcSpacerHeight_(fromPage, toPage) {
      var h = 0;
      for ( var i = fromPage ; i < toPage ; i++ ) {
        h += this.estimatePageHeight_(i);
      }
      return h;
    },

    function updateSpacers_() {
      if ( ! this.topSpacer_ || ! this.bottomSpacer_ ) return;
      var topH = this.calcSpacerHeight_(0, this.firstLoadedPage_);
      var botH = this.calcSpacerHeight_(this.lastLoadedPage_ + 1, this.numPages_);
      this.topSpacer_.style({ height: topH + 'px' });
      this.bottomSpacer_.style({ height: botH + 'px' });
    },

    function measurePage_(page) {
      var el = this.renderedPages_[page];
      if ( ! el ) return;
      var self = this;
      el.el().then(function(domEl) {
        if ( ! domEl ) return;
        var h = domEl.offsetHeight;
        var wasEstimated = self.pageHeights_[page] === undefined;
        self.pageHeights_[page] = h;

        var rows = (page === self.numPages_ - 1)
          ? self.daoCount - page * self.pageSize_
          : self.pageSize_;
        if ( wasEstimated ) {
          self.totalMeasuredRows_ += rows;
          self.totalMeasuredHeight_ += h;
        }
        if ( self.totalMeasuredRows_ > 0 ) {
          self.estimatedRowHeight_ = self.totalMeasuredHeight_ / self.totalMeasuredRows_;
        }
        self.updateSpacers_();
      });
    },

    function evictDistantPages_() {
      var viewportPage = this.getViewportPage_();
      var keepFrom = Math.max(0, viewportPage - this.overscan - 1);
      var keepTo   = Math.min(this.numPages_ - 1, viewportPage + this.overscan + 1);

      var self = this;
      Object.keys(this.renderedPages_).forEach(function(i) {
        i = Number(i);
        if ( i < keepFrom || i > keepTo ) {
          self.clearPage(i);
        }
      });

      this.firstLoadedPage_ = this.findFirstLoadedPage_();
      this.lastLoadedPage_ = this.findLastLoadedPage_();
      this.updateSpacers_();
    },

    function getViewportPage_() {
      var root = this.rootElement?.el_();
      if ( ! root ) return this.firstLoadedPage_;
      var scrollCenter = root.scrollTop + root.clientHeight / 2;
      var accumulated = 0;
      for ( var i = 0 ; i < this.numPages_ ; i++ ) {
        accumulated += this.estimatePageHeight_(i);
        if ( accumulated >= scrollCenter ) return i;
      }
      return this.numPages_ - 1;
    },

    function findFirstLoadedPage_() {
      var pages = Object.keys(this.renderedPages_).map(Number).sort(function(a, b) { return a - b; });
      return pages.length > 0 ? pages[0] : 0;
    },

    function findLastLoadedPage_() {
      var pages = Object.keys(this.renderedPages_).map(Number).sort(function(a, b) { return a - b; });
      return pages.length > 0 ? pages[pages.length - 1] : -1;
    },

    function loadInitialPages_() {
      var startPage = 0;
      if ( this.topRow > 0 ) {
        startPage = Math.floor((this.topRow - 1) / this.pageSize_);
      }
      startPage = Math.max(0, Math.min(startPage, this.numPages_ - 1));

      var pagesToLoad = Math.min(this.numPages_, 2 + this.overscan);
      var from = Math.max(0, startPage);
      var to   = Math.min(this.numPages_, from + pagesToLoad);

      if ( this.groupBy ) {
        this.loadPagesSequentially_(from, to);
      } else {
        for ( var p = from ; p < to ; p++ ) {
          this.loadPage_(p);
        }
      }
    },

    async function loadPagesSequentially_(from, to) {
      for ( var p = from ; p < to ; p++ ) {
        if ( this.renderedPages_[p] || this.loadingPages_[p] ) continue;
        var skip = p * this.pageSize_;
        var dao  = this.data.limit(this.pageSize_).skip(skip);
        await this.getPage(dao, p);
        this.measurePage_(p);
        if ( p < this.firstLoadedPage_ || this.lastLoadedPage_ < 0 ) this.firstLoadedPage_ = Math.min(this.firstLoadedPage_, p);
        if ( p > this.lastLoadedPage_ ) this.lastLoadedPage_ = p;
        this.updateSpacers_();
      }
      this.daoLoading = false;
      this.dataLatch.resolve();

      if ( this.topRow > 1 ) {
        this.scrollToIndex = this.topRow;
      }
    }
  ],

  listeners: [
    {
      name: 'refresh',
      isFramed: true,
      code: function() {
        var self = this;
        Object.keys(this.renderedPages_).forEach(function(i) {
          self.clearPage(i);
        });
        this.renderedPages_ = {};
        this.loadingPages_ = {};
        this.groupFirstPage_ = {};
        this.pageHeights_ = {};
        this.totalMeasuredRows_ = 0;
        this.totalMeasuredHeight_ = 0;
        this.estimatedRowHeight_ = 48;

        this.firstLoadedPage_ = 0;
        this.lastLoadedPage_ = -1;

        this.updateSpacers_();

        if ( ! this.isInit ) {
          this.topRow = 0;
          this.bottomRow = 0;
        }
        this.isInit = false;

        this.loadInitialPages_();
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
      name: 'onSentinelIntersect',
      isFramed: true,
      code: function(entries) {
        for ( var i = 0 ; i < entries.length ; i++ ) {
          var entry = entries[i];
          if ( ! entry.isIntersecting ) continue;

          if ( this.topSentinel_ && entry.target === this.topSentinel_.el_() ) {
            var page = this.firstLoadedPage_ - 1;
            if ( page >= 0 && ! this.renderedPages_[page] && ! this.loadingPages_[page] ) {
              this.loadPage_(page);
            }
          } else if ( this.bottomSentinel_ && entry.target === this.bottomSentinel_.el_() ) {
            var page = this.lastLoadedPage_ + 1;
            if ( page < this.numPages_ && ! this.renderedPages_[page] && ! this.loadingPages_[page] ) {
              this.loadPage_(page);
            }
          }
        }
      }
    },
    {
      name: 'onScroll',
      isFramed: true,
      code: function() {
        var root = this.rootElement?.el_();
        if ( ! root ) return;

        var scrollTop    = root.scrollTop + this.offsetTop;
        var scrollBottom = scrollTop + root.clientHeight - this.offsetTop;
        var accumulated  = 0;
        var topFound     = false;

        for ( var p = 0 ; p < this.numPages_ ; p++ ) {
          var pageH = this.estimatePageHeight_(p);
          var pageStartRow = p * this.pageSize_ + 1;
          var pageRows = (p === this.numPages_ - 1)
            ? this.daoCount - p * this.pageSize_
            : this.pageSize_;
          var rowH = pageRows > 0 ? pageH / pageRows : this.estimatedRowHeight_;

          if ( ! topFound && accumulated + pageH > scrollTop ) {
            var offsetInPage = scrollTop - accumulated;
            this.topRow = Math.max(1, pageStartRow + Math.floor(offsetInPage / rowH));
            topFound = true;
          }

          if ( accumulated + pageH >= scrollBottom ) {
            var offsetInPage = scrollBottom - accumulated;
            this.bottomRow = Math.min(this.daoCount, pageStartRow + Math.ceil(offsetInPage / rowH) - 1);
            break;
          }

          accumulated += pageH;
        }

        if ( ! topFound ) this.topRow = 1;
        if ( accumulated < scrollBottom ) this.bottomRow = this.daoCount;

        // Fast scroll detection: if viewport is over unloaded pages, load them
        var viewportPage = this.getViewportPage_();
        if ( ! this.renderedPages_[viewportPage] && ! this.loadingPages_[viewportPage] ) {
          this.scrollToIndex = this.topRow;
        }
      }
    }
  ],

  actions: [
    {
      name: 'nextPage',
      toolTip: 'Next Page',
      isEnabled: function(bottomRow, daoCount) {
        return bottomRow < daoCount;
      },
      code: function() {
        var n = foam.Number.clamp(1, this.topRow + this.displayedRowCount_ + 1, this.daoCount);
        this.scrollToIndex = n;
      }
    },
    {
      name: 'lastPage',
      toolTip: 'Last Page',
      isEnabled: function(bottomRow, daoCount) {
        return bottomRow < daoCount;
      },
      code: function() {
        this.scrollToIndex = this.daoCount;
      }
    },
    {
      name: 'prevPage',
      toolTip: 'Previous Page',
      isEnabled: function(topRow) {
        return topRow > 1;
      },
      code: function() {
        var n = foam.Number.clamp(1, this.topRow - this.displayedRowCount_, this.daoCount);
        this.scrollToIndex = n;
      }
    },
    {
      name: 'firstPage',
      toolTip: 'First Page',
      isEnabled: function(topRow) {
        return topRow > 1;
      },
      code: function() {
        this.scrollToIndex = 1;
      }
    }
  ]
});

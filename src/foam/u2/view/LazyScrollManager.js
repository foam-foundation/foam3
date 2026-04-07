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

  documentation: `
    A scroll manager that uses a top/bottom spacer approach for virtual windowing.

    Three pages of rows are rendered at a time. As the user scrolls, old pages
    are removed and new ones loaded, with spacers maintaining correct scroll height
    and position in both directions to prevent scroll jumping.

    Page heights are measured after render and cached so that spacer estimates converge to exact values as the user scrolls.

    TODO: There is potentially a small issue with grouping where if you jump pages in the table
    and land the middle of a new group, the group header will be rendered in the middle of the group
    where the view first saw it rather than the real start of it.
    The fix for this would be to move the group header elements to different parent if the index on the group
    header is greater than the current row being rendered that belongs to that group.
  `,

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

  imports: ['config', 'requestAnimationFrame'],

  constants: [
    {
      type: 'Float',
      name: 'MIN_PAGE_PROGRESS',
      value: 0.25
    },
    {
      type: 'Integer',
      name: 'NUM_PAGES_TO_RENDER',
      value: 5
    }
  ],

  messages: [
    { name: 'NO_DATA', message: 'No ${modelName} found', template: true }
  ],

  css: `
    ^no-data {
      display: flex;
      height: 100%;
      justify-content: center;
      align-items: center;
    }
    ^scroll-host {
      overflow-anchor: none;
    }
    ^top-spacer, ^bottom-spacer {
      width: 100%;
      pointer-events: none;
    }

    ^table-page {
      content-visibility: auto;
      contain-intrinsic-height: auto var(--avgPageHeight, 2400px);
      min-width: 100%;
    }
  `,

  topics: ['pageLoading'],

  properties: [
    // DAO Properties
    {
      class: 'foam.dao.DAOProperty',
      name: 'data'
    },
    {
      type: 'Int',
      name: 'pageSize',
      max: 1000,
      value: 50,
      documentation: 'Desired number of items per page.'
    },

    // Internal DAO Properties

    {
      class: 'Int',
      name: 'daoCount',
      postSet: function(o,n) {
        if (o === n);
        // If count is too big increase pageSize_ to reduce page load flicker
        if ( n > 50000 ) this.pageSize_ = Math.min(100, this.pageSize_);
        if ( n > 100000 ) this.pageSize_ = Math.min(200, this.pageSize_);
      }
    },
    {
      type: 'Int',
      name: 'pageSize_',
      max: 1000,
      factory: function() { return this.pageSize; },
      postSet: function(o, n) { if ( o !== n ) this.refresh(); },
      documentation: 'Effective page size, adjusted if displayedRowCount_ exceeds pageSize.'
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
      factory: function() { return -1; },
      preSet: function(o, n) {
        let clamp = foam.Number.clamp(0, n, Math.max(0, this.numPages_ - this.NUM_PAGES_TO_RENDER));
        if ( o !== clamp ) this.suspendObserver = true;
        return clamp;
      }
    },
    {
      class: 'Map',
      name: 'renderedPages_',
      documentation: 'Map of page index -> FOAM element for currently rendered pages U2 Elements.'
    },
    {
      class: 'Map',
      name: 'loadingPages_',
      documentation: 'Set of page indices currently being fetched, to prevent duplicate loads.'
    },
    {
      class: 'Map',
      name: 'loadedPages_',
      documentation: 'Set of page indices that have data loaded already.'
    },

    // Spacer / Virtual Windowing

    {
      class: 'Map',
      name: 'pageHeights_',
      documentation: 'Measured px height for each page, keyed by page index.',
      factory: function() { return {}; }
    },
    {
      class: 'Int',
      name: 'estimatedPageHeight',
      expression: function(pageSize_) {
        let val = pageSize_ * 48 // estimated regular row height
        this.appendTo.element_.style.setProperty('--avgPageHeight', val + 'px');
        return val;
      },
      postSet: function(o, n) {
        if ( o !== n )
          this.appendTo.element_.style.setProperty('--avgPageHeight', n + 'px');
      },
      documentation: 'Estimated height per page used for spacers until a page is measured.'
    },
    {
      name: 'topSpacer_',
      documentation: 'Element above rendered pages representing unrendered rows above.'
    },
    {
      name: 'bottomSpacer_',
      documentation: 'Element below rendered pages representing unrendered rows below.'
    },

    // Row Tracking

    {
      class: 'Int',
      name: 'topRow',
      memorable: true,
      documentation: '1-based index of the topmost visible row.'
    },
    {
      class: 'Int',
      name: 'bottomRow',
      documentation: '1-based index of the bottommost visible row.'
    },
    {
      class: 'Float',
      name: 'displayedRowCount_',
      expression: function(topRow, bottomRow) {
        return topRow && bottomRow ? bottomRow - topRow : 0;
      }
    },
    {
      class: 'Int',
      name: 'scrollToIndex',
      postSet: function() { this.safeScroll(); }
    },

    // Observers

    {
      name: 'rowObserver',
      documentation: 'IntersectionObserver for individual rows — tracks topRow/bottomRow.'
    },
    {
      name: 'sentinelObserver_',
      documentation: 'IntersectionObserver for topSpacer_/bottomSpacer_ — detects fast scrolls.'
    },

    // Configuration

    {
      name: 'rootElement',
      documentation: 'FOAM element used as the scroll container and IntersectionObserver root.'
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
      name: 'groupBy'
    },
    {
      class: 'Boolean',
      name: 'invertGroupingOrder'
    },
    {
      class: 'FObjectProperty',
      name: 'order'
    },
    {
      name: 'ctx',
      documentation: 'Context variable passed to prepDAO.'
    },
    {
      class: 'Function',
      name: 'prepDAO',
      documentation: 'Called with a limited DAO before each page load. Must return a Promise.',
      factory: function() {
        return function(dao) { return dao.select(); };
      }
    },
    {
      name: 'appendTo',
      factory: function() { return this.parentNode; },
      documentation: 'Parent element. The scroll host and spacers are added here.'
    },
    {
      class: 'Int',
      name: 'offsetTop',
      value: 0
    },

    // Additional Internal Properties (defeedback and optimization)

    {
      class: 'FObjectProperty',
      of: 'foam.lang.Latch',
      name: 'dataLatch',
      factory: function() { return this.Latch.create(); }
    },
    {
      class: 'Boolean',
      name: 'daoLoading',
      value: true
    },
    ['isInit', true],
    {
      class: 'Map',
      name: 'groupFirstPage_',
      documentation: 'Tracks the first page where each group appears.',
      factory: function() { return {}; }
    },
    ['suspendObserver', false],
    {
      name: 'refreshId',
      documentation: 'UID used to prevent old data from corrupting the refresh process',
      factory: function() {
        return foam.next$UID();
      }
    }
  ],

  methods: [
    function init() {
      this.onDetach(this.data$proxy.listen(this.FnSink.create({
        fn: () => { this.updateCount(); }
      })));
      this.updateCount();
    },
    async function render() {
      var self = this;

      // Build DOM structure
      //
      //   appendTo (rootElement)
      //      top-spacer   (height = sum of pages above render window)
      //      (rendered pages go here)
      //      bottom-spacer  (height = sum of pages below render window)
      //
      // The rootElement is the IntersectionObserver root so all observations are
      // relative to the visible scroll viewport.

      // Empty / loading slot — appended inside the scroll host
      var statusSlot = this.slot(function(daoCount, isInit, daoLoading) {
        if ( daoLoading ) {
          return self.E().addClass(self.myClass('no-data'))
            .tag(self.LoadingSpinner, { size: 48 });
        }
        if ( isInit || daoCount ) return self.E(); // empty placeholder
        return self.E().addClass(self.myClass('no-data'))
          .add(self.NO_DATA({ modelName: self.config?.emptyLabel ?? 'Data' }));
      });

      this.appendTo
        .addClass(this.myClass('scroll-host'))
        .add(statusSlot)
        .start('', {}, this.topSpacer_$).addClass(this.myClass('top-spacer')).style({ height: '0px' }).end()
        .start('', {}, this.bottomSpacer_$).addClass(this.myClass('bottom-spacer')).style({ height: '0px' }).end();


      // IntersectionObserver: row-level topRow/bottomRow tracking
      let root = this.rootElement.element_;
      let rowObserverOptions = {
        root: root ?? null,
        rootMargin: `-${this.offsetTop}px 0px 0px`,
        threshold: [0.1, 0.5, 0.9]
      };
      this.rowObserver = new IntersectionObserver(
        (entries) => self.onRowIntersect(entries, self),
        rowObserverOptions
      );

      // IntersectionObserver: sentinel-level fast-scroll detection
      //  Uses a generous rootMargin so it fires well before the spacer fully
      //  enters the viewport, giving time to load the next page window.
      this.sentinelObserver_ = new IntersectionObserver(
        (entries) => self.onSentinelIntersect_(entries),
        { root: root ?? null, rootMargin: `${this.estimatedPageHeight/2}px 0px` }
      );
      this.topSpacer_.el().then(el    => this.sentinelObserver_.observe(el));
      this.bottomSpacer_.el().then(el => this.sentinelObserver_.observe(el));

      // ResizeObserver: adjust pageSize_ if container grows
      var resize = new ResizeObserver(this.checkPageSize_);
      this.dataLatch.then(() => { resize.observe(root); });

      root.addEventListener('scroll', this.onScroll_);

      // Detach things
      this.onDetach(() => root.removeEventListener('scroll', this.onScroll_));
      this.onDetach(() => { try { resize.disconnect();                   } catch(x) {} });
      this.onDetach(() => { try { this.rowObserver.disconnect();         } catch(x) {} });
      this.onDetach(() => { try { this.sentinelObserver_.disconnect();   } catch(x) {} });
      this.onDetach(this.rootElement$.sub(this.updateRenderedPages));
      this.onDetach(this.order$.sub(this.refresh));
      this.onDetach(this.groupBy$.sub(this.refresh));
    },

    // Spacer Helpers
    function getSpacerHeights_() {
      // console.debug('getting spacer heights for', this.currentTopPage_);
      var topPage    = this.currentTopPage_;
      var bottomPage = topPage + this.NUM_PAGES_TO_RENDER;
      var top = 0, bottom = 0;

      for ( var i = 0; i < topPage; i++ ) {
        top += this.pageHeights_[i] ?? this.estimatedPageHeight;
      }
      for ( var i = bottomPage; i < this.numPages_; i++ ) {
        bottom += this.pageHeights_[i] ?? this.estimatedPageHeight;
      }
      // console.debug('returning heights: ', top, bottom);
      return { top, bottom };
    },
    function correctSpacers_() {
      var { top, bottom } = this.getSpacerHeights_();
      this.topSpacer_.style({ height: top + 'px' });
      this.bottomSpacer_.style({ height: bottom + 'px' });
    },
    {
      name: 'estimatePageFromOffset_',
      documentation: `Estimate which page a given scrollTop falls within, using measured
      heights where available and estimatedPageHeight elsewhere.`,
      code: function(scrollTop) {
        var accumulated = 0;
        for ( var i = 0; i < this.numPages_; i++ ) {
          accumulated += this.pageHeights_[i] ?? this.estimatedPageHeight;
          if ( accumulated >= scrollTop ) return i;
        }
        return Math.max(0, this.numPages_ - 1);
      }
    },

    // Scroll / Navigation
    function scrollView(el) {
      el.scrollIntoView();
      this.scrollToIndex = undefined;
    },
    function safeScroll() {
      if ( ! this.scrollToIndex ) return;
      var page = Math.floor(this.scrollToIndex / this.pageSize_);
      if ( this.renderedPages_[page] ) {
        var el = this.renderedPages_[page].element_.querySelector(`[data-idx='${this.scrollToIndex}']`);
        if ( ! el ) return;
        this.scrollView(el);
      } else {
        if ( page === 0 && this.currentTopPage_ !== 0 ) {
          this.currentTopPage_ = 0;
          return;
        }
        if ( page === this.numPages_ - 1 &&
             this.currentTopPage_ !== this.numPages_ - this.NUM_PAGES_TO_RENDER ) {
          this.currentTopPage_ = this.numPages_ - this.NUM_PAGES_TO_RENDER;
          return;
        }
        if ( page !== this.currentTopPage_ + 1 ) {
          this.currentTopPage_ = page - 1;
          return;
        }
      }
    },

    // Page Lifecycle
    {
      name: 'clearPage',
      documentation: `Remove a rendered page from the DOM. Spacers absorb the freed height so
      layout does not jump.`,
      code: function(page, opt_skipObserver) {
        var pageEl = this.renderedPages_[page];
        if ( ! pageEl ) return;

        if ( ! opt_skipObserver ) {
          pageEl.childNodes?.forEach(e => {
            if ( e.el_() ) this.rowObserver.unobserve(e.el_());
          });
        }
        pageEl.remove();
        this.correctSpacers_();
        delete this.renderedPages_[page];
        delete this.loadedPages_[page];
      }
    },
    {
      name: 'renderPageWrapper',
      documentation: `Create a page wrapper element and insert it into
      scroll container in page-index order.`,
      code: function(page) {
        let self = this;

        if ( self.renderedPages_[page] ) {
          console.warn('Overwriting a loaded page — clearing first.');
          this.clearPage(page);
        }

        let e = this.E()
          .addClass(self.myClass('table-page'))
          .attr('data-page', page).style({ height: this.estimatedPageHeight });

        self.renderedPages_[page] = e;
        // All of this must happen in the same animation frame to avoid jitter
        this.requestAnimationFrame(() => {
          // Insert in sorted order among sibling pages
          var inserted = false;
          var renderedPageNums = Object.keys(self.renderedPages_).map(Number).sort((a, b) => a - b);
          for ( var j in renderedPageNums ) {
            if ( renderedPageNums[j] > page && self.renderedPages_[renderedPageNums[j]].parentNode) {
              self.appendTo.insertBefore(e, self.renderedPages_[renderedPageNums[j]]);
              inserted = true;
              break;
            }
          }
          if ( ! inserted ) self.appendTo.insertBefore(e, self.bottomSpacer_);
          this.correctSpacers_();
          e.load();
          // console.debug('loaded wrapper', page);
        });
        return e;
      }
    },
    function getPage(dao, page) {
      let self = this;
      var proxy      = this.ProxyDAO.create({ delegate: dao });
      var sortParams = [];

      if ( this.groupBy )
        sortParams.push(this.invertGroupingOrder ? this.DESC(this.groupBy) : this.groupBy);
      if ( this.order ) sortParams.push(this.order);
      if ( sortParams.length ) proxy = proxy.orderBy(sortParams);
      let refreshId = this.refreshId;

      this.loadingPages_$set(page);
      return this.prepDAO(proxy, this.ctx).then((values) => {
        // This means a refresh was triggered while the call was in-flight
        // discard any calls since they might have old data
        if ( this.refreshId !== refreshId ) return;
        if ( page < this.currentTopPage_ || page > this.currentTopPage_ + this.NUM_PAGES_TO_RENDER) {
          // console.debug('Skipping load', page);
          this.loadingPages_$remove(page);
          return;
        }
        let e = self.renderedPages_[page];
        var previousGroup = null;

        function populateRows(args) {
          if ( args.data === undefined ) return;

          var index = (page * self.pageSize_) + i + 1;

          if ( self.groupBy ) {
            var group    = self.groupBy.f(args.data);
            var groupKey = foam.json.stringify(group);

            if ( self.groupFirstPage_[groupKey] === undefined ) {
              self.groupFirstPage_[groupKey] = page;
            }

            var showHeader = page === self.groupFirstPage_[groupKey] &&
                             ! foam.util.equals(group, previousGroup);

            if ( showHeader ) {
              e.start(self.groupHeaderView, {
                ...args,
                groupLabel: group,
                groupBy:    self.groupBy
              })
                .attr('data-idx', index)
                .call(function() { self.rowObserver.observe(this.element_); })
              .end();
            }

            previousGroup = group;
          }

          var isEven = (index + 1) % 2 !== 0;
          var rowEl  = e.start(self.rowView, args)
            .attr('data-idx',  index)
            .attr('data-even', isEven);

          rowEl.el().then(a => self.rowObserver.observe(a));
        }

        if ( foam.mlang.sink.Projection.isInstance(values) ) {
          for ( var i = 0; i < values.projection.length; i++ ) {
            populateRows({ data: values.array[i], projection: values.projection[i] });
          }
        } else if ( foam.dao.Sink.isInstance(values) && values.array ) {
          for ( var i = 0; i < values.array.length; i++ ) {
            populateRows({ data: values.array[i] });
          }
        }

        self.loadingPages_$remove(page);
        self.loadedPages_$set(page, true);
        e.style({ height: "unset" });
        self.setEstimatedPageHeight(page);
        this.dataLatch.resolve();
      });
    },
    async function processPageSequentially_(pageIndex) {
      if ( pageIndex >= Math.min(this.numPages_, this.NUM_PAGES_TO_RENDER) ) {
        this.daoLoading = false;
        return Promise.resolve();
      }

      var page = this.currentTopPage_ + pageIndex;
      if ( this.loadingPages_[page] ) {
        return this.processPageSequentially_(pageIndex + 1);
      }

      var skip = page * this.pageSize_;
      var dao  = this.data.limit(this.pageSize_).skip(skip);

      return this.getPage(dao, page).then(() => {
        return this.processPageSequentially_(pageIndex + 1);
      });
    }
  ],

  listeners: [
    {
      // This is framed to prevent layout thrashing
      name: 'setEstimatedPageHeight',
      documentation: 'Updates estimated page height based on a median of all known heights',
      isFramed: true,
      code: function(page) {
        let h = this.renderedPages_[page]?.getBoundingClientRect().height ?? 0;
        if ( h && this.pageHeights_[page] !== h ) {
          this.pageHeights_[page] = h;

          values = Object.values(this.pageHeights_).sort((a, b) => a - b);

          const half = Math.floor(values.length / 2);

          this.estimatedPageHeight = (values.length % 2
            ? values[half]
            : (values[half - 1] + values[half]) / 2
          );
        }
      }
    },
    {
      name: 'checkPageSize_',
      isFramed: true,
      documentation: 'Ensure pageSize_ is at least as large as displayedRowCount_.',
      code: function() {
        var old = this.pageSize_;
        if ( this.displayedRowCount_ && this.displayedRowCount_ !== this.pageSize_ ) {
          this.pageSize_ = this.pageSize < this.displayedRowCount_
            ? this.displayedRowCount_
            : this.pageSize;
          if ( old !== this.pageSize_ ) this.refresh();
        }
      }
    },

    {
      name: 'refresh',
      isFramed: true,
      code: function() {
        this.rowObserver?.disconnect();
        this.sentinelObserver_?.disconnect();

        // Remove all rendered pages cleanly (spacers will be reset below)
        Object.keys(this.renderedPages_).forEach(i => this.clearPage(i, true));

        this.groupFirstPage_ = {};
        this.pageHeights_   = {};
        this.loadingPages_   = {};
        this.loadedPages_   = {};
        this.renderedPages_   = {};
        if ( ! this.isInit ) {
          this.currentTopPage_ = 0;
          this.topRow          = 0;
          this.bottomRow       = 0;
        }
        this.isInit = false;

        // Reset spacers to zero — updateRenderedPages will recalculate
        this.topSpacer_?.style({ height: '0px' });
        this.bottomSpacer_?.style({ height: '0px' });

        // Re-attach sentinel observer after disconnect
        this.topSpacer_?.el().then(el    => this.sentinelObserver_?.observe(el));
        this.bottomSpacer_?.el().then(el => this.sentinelObserver_?.observe(el));
        this.clearProperty('refreshId');
        this.updateRenderedPages();
        if ( this.topRow > 1 ) this.scrollToIndex = this.topRow;
      }
    },
    {
      name: 'updateCount',
      isFramed: true,
      code: function() {
        var limit = (this.data && this.data.limit_) || undefined;
        this.daoLoading = true;
        return this.data$proxy.select(this.Count.create()).then(s => {
          this.daoCount   = limit && limit < s.value ? limit : s.value;
          this.daoLoading = false;
          this.refresh();
        });
      }
    },
    {
      name: 'updateRenderedPages',
      documentation: `Sync method responsible for loading page wrappers.
      Calls internal method called updateRenderedPages_ that triggers dao calls.
      This is required as  on slower connections we want to load the page wrappers
      in order to preserve scroll position.`,
      on: ['this.propertyChange.currentTopPage_'],
      code: function() {
        for ( let i = 0; i < Math.min(this.numPages_, this.NUM_PAGES_TO_RENDER); i++ ) {
          var page = this.currentTopPage_ + i;
          if ( this.renderedPages_[page] ) continue;
          this.renderPageWrapper(page);
        }
        this.updateRenderedPages_();
        // console.debug('PAGE render complete');
      }
    },
    {
      name: 'updateRenderedPages_',
      isIdled: true,
      delay: 100,
      code: function() {
        // console.debug('starting render', this.currentTopPage_);
        var promise = Promise.resolve();

        if ( this.groupBy ) {
          promise = this.processPageSequentially_(0);
        } else {
          var promiseArr = [];
          for ( var i = 0; i < Math.min(this.numPages_, this.NUM_PAGES_TO_RENDER); i++ ) {
            var page = this.currentTopPage_ + i;
            if ( this.loadingPages_[page] || this.loadedPages_[page] ) continue;
            // console.debug('loading data for', page);
            var skip = page * this.pageSize_;
            var dao  = this.data$proxy.limit(this.pageSize_).skip(skip);
            promiseArr.push(this.getPage(dao, page));
          }
          if ( promiseArr.length ) {
            promise = Promise.all(promiseArr).then(() => { this.daoLoading = false; });
          }
        }

        promise.finally(() => {
          // Evict pages outside the current window
          Object.keys(this.renderedPages_).forEach(i => {
            var n = Number(i);
            if ( n >= this.currentTopPage_ + this.NUM_PAGES_TO_RENDER ||
                 n <  this.currentTopPage_ ) {
              this.clearPage(n);
            }
          });
          this.correctSpacers_();

          this.suspendObserver = false;
          if ( this.scrollToIndex ) this.safeScroll();
          if ( this.displayedRowCount_ < 0 ) this.bottomRow = this.daoCount;
          // console.debug('render complete');
        });
      }
    },
    {
      name: 'onSentinelIntersect_',
      documentation: `
        Fires when topSpacer_ or bottomSpacer_ enters the viewport.
        This indicates a fast scroll that jumped past the rendered window.
        We estimate the target page from the current scrollTop and jump to it.
      `,
      code: function(entries) {
        if ( this.suspendObserver ) return;
        entries.forEach(entry => {
          if ( ! entry.isIntersecting ) return;

          var scrollTop  = this.rootElement.el_()?.scrollTop ?? 0;
          var targetPage = this.estimatePageFromOffset_(scrollTop);
          var isTop      = entry.target === this.topSpacer_.el_();
          var newTopPage = isTop
            ? Math.max(0, targetPage - 1)
            : Math.min(Math.max(0, this.numPages_ - this.NUM_PAGES_TO_RENDER), targetPage);

          // Only suspend and update if currentTopPage_ is actually changing.
          // If it isn't, updateRenderedPages_ won't fire and suspendObserver
          // would never reset to false, permanently blocking the sentinel.
          if ( newTopPage === this.currentTopPage_ ) return;
          // console.debug('Setting top page - observer', newTopPage);
          this.currentTopPage_ = newTopPage;
        });
      }
    },
    {
      name: 'onRowIntersect',
      code: function(entries, self) {
        var intersectingSet = false;
        entries.forEach(entry => {
          if ( entry.intersectionRatio === 0 ) return;
          intersectingSet = true;
          if ( self.suspendObserver && self.scrollToIndex ) return;

          var index = Number(entry.target.dataset.idx);
          if ( entry.boundingClientRect.top <= entry.rootBounds.top ) {
            // Recheck before setting since the intersection observer might have been delayed
            let bounds = entry.target.getBoundingClientRect();
            if ( bounds.top <= entry.rootBounds.top && bounds.bottom >= entry.rootBounds.top )
              self.topRow = index;
          } else if ( entry.boundingClientRect.bottom >= entry.rootBounds.bottom ) {
            // Recheck before setting since the intersection observer might have been delayed
            let bounds = entry.target.getBoundingClientRect();
            if ( bounds.bottom >= entry.rootBounds.bottom && bounds.top < entry.rootBounds.bottom )
              if ( index > 0 ) self.bottomRow = index;
          }
        });
        if ( ! intersectingSet ) return;
        if ( ! self.bottomRow && self.displayedRowCount_ <= 0 )
          self.bottomRow = self.pageSize_ > entries.length ? entries.length : self.pageSize_;
      }
    },
    {
      name: 'onScroll_',
      documentation: `
        Listener for extreme edge case where user scrolls faster than
        we can listen to the observer or their device can process pages
        approximates desired page and loads that page will not be accurate
      `,
      isIdled: true,
      delay: 48,
      code: function() {
        var scrollEl = this.rootElement.el_();
        if ( ! scrollEl || this.scrollToIndex ) return;

        var scrollTop  = scrollEl.scrollTop;
        var targetPage = this.estimatePageFromOffset_(scrollTop);
        if ( targetPage < 0 ) return;
        var outsideWindow = targetPage < this.currentTopPage_ ||
                            targetPage >= this.currentTopPage_ + this.NUM_PAGES_TO_RENDER;

        if ( outsideWindow ) {
          // console.debug('Setting top page - scroll listener', targetPage - 1);
          this.currentTopPage_ = foam.Number.clamp(
            0,
            targetPage - 1,
            Math.max(0, this.numPages_ - this.NUM_PAGES_TO_RENDER)
          );
        }
      }
    }
  ],

  actions: [
    {
      name: 'nextPage',
      toolTip: 'Next Page',
      isEnabled: function(bottomRow, daoCount, suspendObserver) {
        return ! suspendObserver && bottomRow !== daoCount;
      },
      code: function() {
        var n = foam.Number.clamp(1, this.topRow + this.displayedRowCount_ + 1, this.daoCount);
        this.scrollToIndex = n;
      }
    },
    {
      name: 'lastPage',
      toolTip: 'Last Page',
      isEnabled: function(bottomRow, daoCount, suspendObserver) {
        return ! suspendObserver && bottomRow !== daoCount;
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
        var n = foam.Number.clamp(1, this.topRow - this.displayedRowCount_, this.daoCount);
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

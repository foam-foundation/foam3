foam.CLASS({
  package: 'org.chartjs',
  name: 'CalendarDAOChartView',
  extends: 'foam.u2.Element',
  documentation: 'Dashboard calendar-table, fully props-driven and tokenized, like Pie/Bar.',
  css: `
    ^table        { border-collapse: collapse; border: 1px solid $borderLight; width:100%; max-width:100%; table-layout: fixed; }
    ^th           { border: 1px solid $borderLight; padding: 10px; background: $backgroundSectionHeader; }
    ^td           { border: 1px solid $borderLight; padding: 10px; max-width: 320px; background: $backgroundTableBody; vertical-align: top; min-height: 40px; }
    ^cellStack    { display: flex; flex-direction: row; flex-wrap: wrap; gap: 4px; align-items: flex-start; }
    ^block        { padding: 5px; border-radius: 5px; font-weight: bold; min-width: 30px; color: $textDefault; background: $backgroundTertiary; }
    ^legend       { display: flex; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; align-items: center; }
    ^legendEntry  { display: inline-flex; align-items: center; gap: 4px; }
    ^legendSwatch { width: 18px; height: 18px; border-radius: 4px; display: inline-block; border: 1px solid $borderLight; }
  `,
  properties: [
    { class: 'StringArray', name: 'labels' },
    { class: 'StringArray', name: 'categories' },
    { class: 'Array', name: 'values' },
    { class: 'StringArray', name: 'colors' },
    { class: 'Boolean', name: 'showLegend', value: true },
    { class: 'Enum', name: 'legendPosition', of: 'foam.core.reflow.dashboard.LegendPosition', value: 'TOP' },
    { class: 'Boolean', name: 'maintainAspectRatio', value: false },
    { class: 'Int', name: 'height', value: 300 },
    { class: 'Enum', name: 'alignment', of: 'foam.core.reflow.dashboard.MetricAlignment', value: 'CENTER' },
    { class: 'Boolean', name: 'animate', value: true },
    { class: 'Int', name: 'animationDuration', value: 1000 },
    { name: 'parentEl_' }
  ],
  methods: [
    function legendBlock(self, colorList) {
      this.start('div').addClass(this.myClass('legend'))
        .forEach((self.categories||[]), function(cat,i) {
          var color = colorList[i] || '#b3cde0';
          this.start('span').addClass(self.myClass('legendEntry'))
            .start('span').addClass(self.myClass('legendSwatch')).style({background:color}).end()
            .add(cat)
          .end();
        })
      .end();
    },
    function render() {
      var self = this;
      this.onDetach(this.dynamic(function(labels, categories, values, colors, showLegend, legendPosition, alignment, maintainAspectRatio, height) {
        // Clear current content
        self.removeAllChildren();
        // Resolve colors against theme tokens
        var resolvedColors = (colors||[]).map(function(c){ return foam.CSS.returnTokenValue(c, self.cls_, self.__subContext__); });
        // Build month/year map
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        let dateCatMap = {};
        (labels||[]).forEach(function(lbl, i) {
          if (!lbl) return;
          var parts = lbl.split('-');
          if ( parts.length < 2 ) return;
          var y = parts[0];
          var m = parseInt(parts[1], 10);
          var mo = MONTHS[m-1];
          if (!y || !mo) return;
          if (!dateCatMap[mo]) dateCatMap[mo] = {};
          if (!dateCatMap[mo][y]) dateCatMap[mo][y] = (categories||[]).map(function(){return 0;});
          (values[i]||[]).forEach(function(val, catIdx){ dateCatMap[mo][y][catIdx] = val || 0; });
        });
        var years = Array.from(new Set(Object.values(dateCatMap).flatMap(function(monthObj){ return Object.keys(monthObj);}))).sort();
        var legendPosName = legendPosition && legendPosition.name ? legendPosition.name : (legendPosition || 'TOP');
        // Legend top
        if (showLegend && (legendPosName === 'TOP')) {
          self.legendBlock(self, resolvedColors);
        }
        // Container and table
        self.start('div', null, self.parentEl_$)
          .style({ width:'100%', height:(height||300)+'px', position:'relative', overflowX:'auto', display:'flex', flexDirection:'column', alignItems: (alignment ? alignment.alignmentStyle : 'center') })
          .start('table').addClass(self.myClass('table'))
            .start('thead').start('tr')
              .start('th').addClass(self.myClass('th')).add('Year') .end()
              .forEach(years, function(y){ this.start('th').addClass(self.myClass('th')).add(y).end(); })
            .end().end()
            .start('tbody')
              .forEach(MONTHS, function(mo){
                this.start('tr')
                  .start('th').addClass(self.myClass('th')).add(mo).end()
                  .forEach(years, function(y){
                    var vals = (dateCatMap[mo] && dateCatMap[mo][y]) ? dateCatMap[mo][y] : [];
                    this.start('td').addClass(self.myClass('td'))
                      .start('div').addClass(self.myClass('cellStack'))
                        .callIf(vals.length > 0, function(){
                          this.forEach(vals, function(val, idx){
                            var color = resolvedColors[idx] || '#b3cde0';
                            this.start().addClass(self.myClass('block')).style({ background: color })
                              .add(val > 0 ? val.toLocaleString() : (val === 0 ? '0' : ''))
                            .end();
                          });
                        })
                      .end()
                    .end();
                  })
                .end();
              })
            .end()
          .end()
        .end();
        // Legend bottom
        if (showLegend && (legendPosName === 'BOTTOM')) {
          self.legendBlock(self, resolvedColors);
        }
      }, this.labels$, this.categories$, this.values$, this.colors$, this.showLegend$, this.legendPosition$, this.alignment$, this.maintainAspectRatio$, this.height$));
    }
  ]
});

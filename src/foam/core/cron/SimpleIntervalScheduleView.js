/**
  * @license
  * Copyright 2022 The FOAM Authors. All Rights Reserved.
  * http://www.apache.org/licenses/LICENSE-2.0
  */

foam.CLASS({
  package: 'foam.core.cron',
  name: 'SimpleIntervalScheduleView',
  extends: 'foam.u2.View',

  imports: ['displayWidth?'],

  css: `
    << {
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    <<container {
      display: grid;
      gap: 12px 8px;
    }
    <<fullWidth {
      grid-column: span 12;
    }
    <<halfWidth {
      grid-column: span 6;
    }
    <<halfWidth.foam-u2-PropertyBorder {
      justify-content: flex-start;
    }
  `,

  methods: [
    function render() {
      var self = this;
      let data = this.data;
      this
      .addClass()
      .start()
        .style(
          { 'grid-template-columns': this.displayWidth$.map(dw => {
              dw = dw || foam.u2.layout.DisplayWidth.XL;
              return `repeat(${dw.cols}, 1fr)`;
            })
          }
        ).addClass(this.myClass('container'))
        .start(data.NAME.__).addClass(this.myClass('fullWidth')).end()
        .start(data.START_DATE.__).addClass(this.myClass('fullWidth')).end()
        .start(data.REPEAT.__).addClass(this.myClass('halfWidth')).end()
        .start(data.FREQUENCY.__).addClass(this.myClass('halfWidth')).end()
        .add(this.dynamic(function(data$frequency) {
          if ( data$frequency == 'WEEK' )
            this.start().add(data.DAY_OF_WEEK.__).addClass(self.myClass('fullWidth')).end();
          if ( data$frequency == 'MONTH' )
            this.start().call(self.addGrid, [self]).addClass(self.myClass('fullWidth'))
              .start(data.MONTHLY_CHOICE.__, { reserveLabelSpace: false }).addClass(self.myClass('fullWidth')).end()
              .start()
                .addClass(self.myClass('fullWidth'))
                .add(self.dynamic(function(data$monthlyChoice) {
                  if ( ! data$monthlyChoice ) return;
                  if ( data$monthlyChoice == 'EACH' )
                    return this.add(data.DAY_OF_MONTH.__);
                  return this.start().call(self.addGrid, [self])
                    .start(data.SYMBOLIC_FREQUENCY.__, { reserveLabelSpace: false }).addClass(self.myClass('halfWidth')).end()
                    .start(data.EXPANDED_DAY_OF_WEEK.__, { reserveLabelSpace: false }).addClass(self.myClass('halfWidth')).end()
                  .end();
                }))
              .end()
            .end();
          return;
        }))
        .start(data.ENDS.__).addClass(this.myClass('halfWidth')).end()
        .add(this.dynamic(function(data$ends,data$repeat) {
          if ( ! data$repeat ) return;
          return this.start()
            .addClass(self.myClass('halfWidth'))
            .add(data$ends == foam.core.cron.ScheduleEnd.ON ? self.data.ENDS_ON.__ : self.data.ENDS_AFTER.__)
            .end();
        }))
      .end();
    },
    function addGrid(self) {
      return this.style(
        { 'grid-template-columns': self.displayWidth$.map(dw => {
            dw = dw || foam.u2.layout.DisplayWidth.XL;
            return `repeat(${dw.cols}, 1fr)`;
          })
        }
      ).addClass(self.myClass('container'));
    }
  ]
});

/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var E = foam.__context__.E.bind(foam.__context__);

foam.CLASS({
  name: 'User',

  properties: [
    {
      class: 'String',
      name: 'id',
      label: 'ID',
      width: 12,
      value: '1234',
      updateVisibility: 'DISABLED',
      help: 'Unique identifier for this User.',
      documentation: 'Unique name of the Group.'
    },
    {
      class: 'Date',
      name: 'created',
      // TODO: doesn't work
      visibility: foam.u2.DisplayMode.RO,
      factory: function() { return new Date(); }
    },
    {
      class: 'Date',
      name: 'terminated',
      visibility: function(isEmployee, enabled) {
        return isEmployee & ! enabled ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.RO;
      }
    },
    {
      class: 'Boolean',
      name: 'enabled',
      value: true
    },
    {
      class: 'Boolean',
      name: 'isEmployee',
      label: 'Employee',
      value: true
    },
    {
      class: 'Int',
      name: 'employeeId',
      help: 'Date of start of employment.',
      visibility: function(isEmployee) { return isEmployee ? 'RW' : 'HIDDEN'; }
    },
    {
      class: 'Int',
      name: 'salary',
      help: "The employee's annual salary.",
      units: 'CAD$',
      validateObj: function(salary) {
        if ( salary < 30000 ) return 'Salary must be at least $30,000.';
      },
      visibility: function(isEmployee) {
        return isEmployee ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'jobTitle',
      visibility: function(isEmployee) {
        return isEmployee ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.HIDDEN;
      }
    },
    {
      class: 'String',
      name: 'firstName',
      label: '',
      required: true
    },
    {
      class: 'Boolean',
      name: 'toggleNameLabel',
      value: false
    },
    {
      class: 'String',
      name: 'lastName',
      required: true,
      validateObj: function(lastName) {
        if ( ! lastName ) return 'Required';
        if ( lastName && lastName.length < 2 ) return 'Last Name must be at least 2 chars';
      },
    },
    {
      class: 'EMail',
      name: 'email'
    },
    {
      class: 'Date',
      name: 'birthday',
      help: 'Date of birth.'
    },
    {
      class: 'String',
      name: 'title',
      width: 4
    },
    {
      class: 'String',
      name: 'address',
      width: 80
    },
    {
      class: 'String',
      name: 'City',
      width: 40
    },
    {
      class: 'String',
      name: 'region',
      label: 'Province',
      width: 4
    },
    {
      class: 'String',
      name: 'postalCode',
      width: 10
    },
    {
      class: 'String',
      name: 'country',
      value: 'Canada',
      view: { class: 'foam.u2.view.ChoiceView', choices: [ 'Canada', 'United States' ] },
      postSet: function(_,n) {
        if ( n == 'Canada' ) this.region = 'ON';
        if ( n == 'United States' ) this.region = '';
      },
      width: 30
    }
  ]
});


foam.CLASS({
  name: 'CustomUserDetailView',
  extends: 'foam.u2.View',

  requires: [
    'User', 'foam.u2.PropertyBorder'
  ],

  css: `
    << {
      padding: 8px;
      display: inline-block;
      border-radius: 3px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.38);
      margin: 8px;
    }
  `,

  methods: [
    function render() {
      this.SUPER();
      var self = this, data = this.data;

//      this.add(this.data.cls_.getAxiomsByClass(foam.lang.Property).filter(p => ! p.hidden));

      this.
        start(LabelledSection, {title: 'User'}).
        addClass().
       // start(Row).add('start',data.ID, data.ENABLED, data.IS_EMPLOYEE,'end').end().
        start('h3').add('Title').end().
        start(Columns).
          start(Column).
            add(data.TOGGLE_NAME_LABEL.__).
            add(data.ID.__, data.ENABLED.__).
            tag(data.FIRST_NAME.__, { config: { label$: data.toggleNameLabel$.map(v => v ? 'Name' : '') } }).
            tag(data.FIRST_NAME.__, { reserveLabelSpace: true, config: { label$: data.toggleNameLabel$.map(v => v ? 'Name' : '') } }).
            add(data.EMAIL.__).
          end().
          start(Column).
            add(data.CREATED.__, data.TERMINATED.__, data.LAST_NAME.__, data.BIRTHDAY.__).
          end().
          start(Column).
            add(data.IS_EMPLOYEE.__, data.EMPLOYEE_ID.__).
          end().
        end().
        br().
        start(Tabs).
          start(Tab, {label: 'Address'}).
            add(data.ADDRESS.__).
            start(Columns).
              start(Column).
                add(data.CITY.__, data.COUNTRY.__).
              end().
              start(Column).
                tag(self.PropertyBorder, {
                  prop: data.POSTAL_CODE,
                  label: this.data.country$.map(c => {
                    return { Canada: 'Postal Code', 'United States': 'Zip Code' }[c];
                  })
                }).
                tag(self.PropertyBorder, {
                  prop: data.REGION,
                  view$: this.data.country$.map(c => {
                    if ( c === 'Canada' ) {
                      return {
                        class: 'foam.u2.view.ChoiceView',
                        choices: [
                          [ 'ON', 'Ontario' ],
                          [ 'PQ', 'Quebec' ],
                          [ 'OT', 'Other' ]
                        ]
                      };
                    }
                    return data.REGION.view;
                  }),
                  config: {
                    label$: this.data.country$.map(c => { return { Canada: 'Province', 'United States': 'State' }[c] })
                  }
                }).
              end().
            end().
          end().
          start(Tab, {label: 'Employee Information'}).
            show(data.isEmployee$).
            add(data.JOB_TITLE.__, data.SALARY.__).
          end().
        end().
        start(FoldingSection, {title: 'Employee Information'}).
          show(data.isEmployee$).
          add(data.JOB_TITLE.__).
          tag(data.JOB_TITLE.__, { config: { label: 'something', units: '123' } }).
          // How to add a Property view without wrapping in a PropertyBorder
          add(data.JOB_TITLE).
          add(data.JOB_TITLE.toE({}, this.__subSubContext__)).
          tag(self.PropertyBorder, {
            prop: data.SALARY,
            config: {
              units$: this.data.country$.map(c => {
                return { Canada: 'CAD', 'United States': '$' }[c];
              })
            }
          }).
        end().
        start(FoldingSection, {title: 'Reserve Label Space test'}).
          add(data.TOGGLE_NAME_LABEL.__).
          tag(data.FIRST_NAME.__, { config: { label: 'Name' }}).
          tag(data.FIRST_NAME.__, { config: { label$: data.toggleNameLabel$.map(v => v ? 'Name' : '') } }).
          tag(data.FIRST_NAME.__, { reserveLabelSpace: true, config: { label$: data.toggleNameLabel$.map(v => v ? 'Name' : '') } }).
        end();
    }
  ]
});

// Bug: Borders don't pass down Context properly

E('br').write();
E('hr').write();
E('br').write();

foam.CLASS({
  name: 'ControllerModeTester',
  extends: 'foam.u2.Controller',

  properties: [
    {
      class: 'Enum',
      name: 'mode',
      of: 'foam.u2.ControllerMode'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'view'
    }
  ],

  methods: [
    function render() {
      this.SUPER();

      this.
        add(this.MODE).
        tag('hr').
        add(this.mode$.map(m => {
          return this.E().startContext({controllerMode: m}).tag(this.view);
        }));
    }
  ]
});

var user = User.create({firstName: 'Kevin', lastName: 'Greer'});

ControllerModeTester.create({
  view: {class: 'CustomUserDetailView', of: User, data: user}
}).write();

//CustomUserDetailView.create({of: User, data: user}).write();

/*
foam.u2.DetailView.create({data: user, showActions: true}).write();

foam.u2.detail.SectionedDetailView.create({data: user, showActions: true}).write();
*/

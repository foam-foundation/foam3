/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.column',
  name: 'CommonColumnHandler',

  requires: [
    'foam.core.column.ColumnConfigToPropertyConverter'
  ],

  axioms: [ foam.pattern.Singleton.create() ],

  methods: [
    function returnColumnNameForNLevelName(col, n) {
      if ( ! col.split ) return null;
      var propNames = col.split('.');
      if ( n === -1 ) {
        if ( propNames.length === 0 )
          n = 0;
        else
          n = propNames.length - 1;
      }
      return propNames[n];
    },
    function propertyNamesForColumnArray(col) {
      return this.returnPropertyNamesForColumn(this.returnNElementIfArray(col, 0));
    },
    function returnPropertyNamesForColumn(col) {
      return this.canColumnBeTreatedAsAnAxiom(col) ? col.name : col;
    },
    function checkIfArrayAndReturnColumnLastLevelName(col) {
      return this.returnColumnLastLevelName(this.returnNElementIfArray(col, 0));
    },
    function returnColumnLastLevelName(col) {
      return this.canColumnBeTreatedAsAnAxiom(col) ? col.name : this.returnColumnNameForNLevelName(col, -1);
    },
    function checkIfArrayAndReturnFirstLevelColumnName(col) {
      return this.returnColumnFirstLevelName(this.returnNElementIfArray(col, 0));
    },
    function returnColumnFirstLevelName(col) {
      return this.canColumnBeTreatedAsAnAxiom(col) ? col.name : this.returnColumnNameForNLevelName(col, 0);
    },
    function returnNElementIfArray(col, n) {
      return foam.Array.isInstance(col) ? col[n] : col;
    },
    function canColumnBeTreatedAsAnAxiom(col) {
      return foam.lang.Property.isInstance(col) || foam.lang.Action.isInstance(col) || foam.Object.isInstance(col);
    },
    function mapArrayColumnsToArrayOfColumnNames(cols) {
      return cols.map(c => this.propertyNamesForColumnArray(c));
    },
    function checkIfArrayAndReturnPropertyNameForRootProperty(rootProperty) {
      return this.returnPropertyNameForRootProperty(this.returnNElementIfArray(rootProperty, 0));
    },
    function returnPropertyNameForRootProperty(rootProperty) {
      return this.canColumnBeTreatedAsAnAxiom(rootProperty) ? rootProperty.name : rootProperty;
    },
    function checkIfArrayAndReturnRootPropertyHeader(rootProperty) {
      return this.returnRootPropertyHeader(this.returnNElementIfArray(rootProperty, 1));
    },
    function returnRootPropertyHeader(rootProperty) {
      return this.canColumnBeTreatedAsAnAxiom(rootProperty) ?  this.returnAxiomHeader(rootProperty) : rootProperty;
    },
    function checkIfArrayAndReturnAxiomHeader(rootProperty) {
      return this.returnAxiomHeader(this.returnNElementIfArray(rootProperty, 0));
    },
    function returnAxiomHeader(axiom) {
      return axiom.columnLabel;
    },
    function getClassForNestedPropertyObject(cls, propNames) {
      var of_ = cls;
      for ( var i = 0 ; i < propNames.length - 1 ; i++ ) {
        of_ = of_.getAxiomByName(propNames[i]).of;
      }
      return of_;
    },
    function returnPropNamesToQuery(props) {
      var propertyNamesToQuery = props.filter(p => foam.lang.Property.isInstance(p.property)).map(p => p.fullPropertyName);
      props.forEach(p => {
        var propPrefix = ! p.fullPropertyName.includes('.') ? '' : this.getNestedPropertyNameExcludingLastProperty(p.fullPropertyName) + '.';
        if ( p.property.unitPropValueToString && p.property.unitPropName )
          propertyNamesToQuery.push(propPrefix + p.property.unitPropName);
        for (var i = 0 ; i < p.property.dependsOnPropertiesWithNames.length ; i++ ) {
          propertyNamesToQuery.push(propPrefix + p.property.dependsOnPropertiesWithNames[i]);
        }
      });
      return propertyNamesToQuery;
    },
    function returnPropertyForColumn(props, of, col, property) {
      var colObj = foam.Array.isInstance(col) ? col[1] && col[1][property] ? col[1] : col[0] : col ;

      if ( colObj && this.canColumnBeTreatedAsAnAxiom(colObj) ) {
        if ( colObj[property] )
          return colObj[property];
      }
      var name = this.returnPropertyNamesForColumn(colObj);
      var prop = props.find(p => p.fullPropertyName === name );
      if ( prop ) return prop.property[property]; 
      
      var ax = of.getAxiomByName(name);
      if ( ! ax ) {
        console.error('returnPropertyForColumn: missing property "' + name + '" on ' + of.id);
      }
      return  ax[property];
    },
    function groupRelatedObjects(of, arrayOfNestedPropertiesName, arrayOfValues) {
      // this function creates obj for nested properties and adds it to the map
      // eg lets assume that current `of` class has property called user
      // and we query 3 properties user.firstName, user.lastName and user.fullName
      // in this case we will create 'user' entry in our 'map' object initalized below
      // and value for 'user' key will be object of class user
      // then we set firstName of user with user.firstName value from array of values which we got with projection
      // then user.lastName and then user.fullName
      // so if tableCellFormatter of one property depends on tableCellFormatter of other property, it works correctly
      var map = {};
      for ( var i = 0 ; i < arrayOfNestedPropertiesName.length ; i++ ) {
        var key = this.getNestedPropertyNameExcludingLastProperty(arrayOfNestedPropertiesName[i]);
        var objsClass = this.getClassForNestedPropertyObject(of, arrayOfNestedPropertiesName[i].split('.'));
        if( ! map[key] ) {
          map[key] = objsClass.create({}, this);
        }
        if ( arrayOfValues[i] )
          objsClass.getAxiomByName(this.getNameOfLastPropertyForNestedProperty(arrayOfNestedPropertiesName[i])).set(map[key], arrayOfValues[i]);
      }
      return map;
    },
    function getNestedPropertyNameExcludingLastProperty(nestedPropertyName) {
      //this method asssumes that the propName is nestedPropertyName
      var lastIndex = nestedPropertyName.lastIndexOf('.');
      return nestedPropertyName.substr(0, lastIndex);//lastIndex == length here
    },
    function getNameOfLastPropertyForNestedProperty(nestedPropertyName) {
      // returns last property name eg for 'user.firstName' that would be 'firstName'
      var lastIndex = nestedPropertyName.lastIndexOf('.');
      return nestedPropertyName.substr(lastIndex + 1);
    },
    function buildPropNameAndIndexArray(propNames) {
      // gathering nested properties and indexes of corresponding values in Projection array
      var nestedPropertyNames = [];
      var indexOfValuesForCorrespondingPropertyNames = [];
      for ( var i = 0 ; i < propNames.length ; i++ ) {
        if ( ! propNames[i].includes('.') )
          continue;
        nestedPropertyNames.push(propNames[i]);
        indexOfValuesForCorrespondingPropertyNames.push(i);
      }
      var result = [nestedPropertyNames, indexOfValuesForCorrespondingPropertyNames];
      return result;
    },
    function filterNestedPropertyValues(valuesArray, indexes) {
      var filteredArr = [];
      for ( var i = 0 ; i < indexes.length; i++ ) {
        filteredArr.push(valuesArray[indexes[i]]);
      }
      return filteredArr;
    }
  ]
});

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [FOAM Relationships](#foam-relationships)
  - [Overview](#overview)
  - [Reference vs Relationship](#reference-vs-relationship)
    - [Reference Property](#reference-property)
    - [Relationship](#relationship)
    - [Comparison Table](#comparison-table)
    - [Real-World Example](#real-world-example)
  - [Defining a Relationship](#defining-a-relationship)
    - [Basic Syntax](#basic-syntax)
    - [Relationship Properties](#relationship-properties)
  - [One-to-Many Relationships (1:*)](#one-to-many-relationships-1)
    - [What Gets Generated](#what-gets-generated)
    - [Example: Professor → Courses](#example-professor--courses)
    - [Using the Relationship](#using-the-relationship)
  - [Many-to-Many Relationships (*:*)](#many-to-many-relationships-)
    - [What Gets Generated](#what-gets-generated-1)
    - [Example: Student ↔ Course](#example-student--course)
    - [The Generated Junction Model](#the-generated-junction-model)
    - [Using the ManyToManyRelationship](#using-the-manytomanyrelationship)
  - [How FOAM Eliminates Junction API Complexity](#how-foam-eliminates-junction-api-complexity)
    - [Traditional Junction Table Approach](#traditional-junction-table-approach)
    - [FOAM's Approach](#foams-approach)
  - [Advanced Configuration](#advanced-configuration)
    - [Custom Property Configuration](#custom-property-configuration)
    - [Custom DAO Keys](#custom-dao-keys)
    - [One-Way Relationships](#one-way-relationships)
  - [UI Integration](#ui-integration)
  - [Complete Working Example](#complete-working-example)
    - [Models](#models)
    - [Services Configuration](#services-configuration)
    - [Usage in Application Code](#usage-in-application-code)
  - [Summary](#summary)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# FOAM Relationships

## Overview

FOAM Relationships define typed links between models with automatic property, method, and DAO generation. They support two cardinalities:

- **One-to-Many (1:*)** - A parent owns many children (e.g., Professor → Courses)
- **Many-to-Many (*:*)** - Objects on both sides can link to multiple objects on the other side (e.g., Students ↔ Courses)

The key benefit of FOAM relationships is that they **eliminate manual junction table management**. You declare the relationship once, and FOAM generates all the necessary models, properties, methods, and DAOs to navigate and manipulate the relationship from both sides.

---

## Reference vs Relationship

FOAM provides two ways to link models: **Reference** properties and **Relationships**. Understanding when to use each is important.

### Reference Property

A `Reference` is a simple foreign key - it stores the ID of another object and provides convenient access to it:

```javascript
foam.CLASS({
  package: 'com.foamdev.cook',
  name: 'IngredientAmount',
  properties: [
    { class: 'Long', name: 'id' },
    { class: 'Float', name: 'amount' },
    {
      class: 'Reference',
      of: 'com.foamdev.cook.IngredientAmount',
      name: 'alternative',
      targetDAOKey: 'ingredientAmountDAO'
    }
  ]
});
```

**Use Reference when:**
- You have a simple one-way link (A points to B, but B doesn't need to know about A)
- Self-references (an object pointing to another object of the same type)
- The relationship is not the primary organizing structure
- You don't need automatic collection management

**What Reference provides:**
- Stores the target object's ID
- UI renders as a picker/autocomplete
- Can resolve to the full object via the DAO

**What Reference does NOT provide:**
- No inverse property on the target
- No automatic filtering/collection on the source
- No junction management for many-to-many

### Relationship

A `Relationship` creates bidirectional links with automatic property generation on both sides:

```javascript
foam.RELATIONSHIP({
  sourceModel: 'com.foamdev.cook.Ingredient',
  targetModel: 'com.foamdev.cook.IngredientAmount',
  forwardName: 'ingredientAmounts',
  inverseName: 'ingredient',
  cardinality: '1:*'
});
```

**Use Relationship when:**
- You need bidirectional navigation (get courses for a professor AND get the professor for a course)
- The link is a core part of your domain model
- You want automatic collection management (professor.courses returns a filtered DAO)
- For many-to-many, you want FOAM to handle the junction table

### Comparison Table

| Feature | Reference | Relationship |
|---------|-----------|--------------|
| Direction | One-way | Bidirectional |
| Code generated | None | Properties + methods on both models |
| Collection access | Manual query | Automatic (`source.targets` returns DAO) |
| Inverse navigation | Not available | Automatic (`target.source` property) |
| Junction tables | Manual | Automatic for `*:*` |
| Self-reference | ✓ Supported | Not typical |
| UI integration | Picker/autocomplete | Table/browser + picker |

### Real-World Example

In a recipe application:

```javascript
// Relationships.js - bidirectional links that are core to the domain
foam.RELATIONSHIP({
  sourceModel: 'com.foamdev.cook.Recipe',
  targetModel: 'com.foamdev.cook.RecipeStep',
  forwardName: 'steps',
  inverseName: 'recipe',
  cardinality: '1:*'
});

foam.RELATIONSHIP({
  sourceModel: 'com.foamdev.cook.RecipeStep',
  targetModel: 'com.foamdev.cook.IngredientAmount',
  forwardName: 'ingredientAmounts',
  inverseName: 'recipeSteps',
  cardinality: '*:*'
});
```

```javascript
// IngredientAmount.js - simple self-reference for alternatives
{
  class: 'Reference',
  of: 'com.foamdev.cook.IngredientAmount',
  name: 'alternative',
  targetDAOKey: 'ingredientAmountDAO'
}
```

The `alternative` property is a Reference because:
- It's a self-reference (IngredientAmount → IngredientAmount)
- Navigation is one-way (we look up alternatives, not "what am I an alternative for?")
- It's optional metadata, not a core structural relationship

The Recipe → RecipeStep link is a Relationship because:
- We need `recipe.steps` to get all steps
- We need `step.recipe` to navigate back
- It's a core part of the domain structure

---

## Defining a Relationship

### Basic Syntax

Relationships are declared using `foam.RELATIONSHIP()`, typically in the same file as one of the models:

```javascript
foam.RELATIONSHIP({
  sourceModel: 'com.example.Professor',
  targetModel: 'com.example.Course',
  forwardName: 'courses',      // professor.courses
  inverseName: 'professor',    // course.professor
  cardinality: '1:*'           // default, can be omitted
});
```

### Relationship Properties

| Property | Description |
|----------|-------------|
| `sourceModel` | Fully qualified name of the "owning" model |
| `targetModel` | Fully qualified name of the "owned" or related model |
| `forwardName` | Property name added to source (e.g., `professor.courses`) |
| `inverseName` | Property name added to target (e.g., `course.professor`) |
| `cardinality` | `'1:*'` (default) or `'*:*'` |
| `sourceDAOKey` | DAO key for source model (defaults to `sourceModel` daoized) |
| `targetDAOKey` | DAO key for target model (defaults to `targetModel` daoized) |
| `junctionDAOKey` | For `*:*` only: DAO key for junction model |
| `sourceProperty` | Override configuration for the forward property |
| `targetProperty` | Override configuration for the inverse property |
| `oneWay` | If true, don't install the inverse property on target |

---

## One-to-Many Relationships (1:*)

### What Gets Generated

When you define a 1:* relationship, FOAM automatically installs:

**On the source model (e.g., Professor):**
- A **property** named by `forwardName` (e.g., `courses`)
- A **method** `get<ForwardName>(x)` that returns a `RelationshipDAO`

**On the target model (e.g., Course):**
- A **Reference property** named by `inverseName` (e.g., `professor`) that stores the source's ID

### Example: Professor → Courses

```javascript
// Professor.js
foam.CLASS({
  package: 'foam.core.demo.relationship',
  name: 'Professor',
  properties: [
    { class: 'String', name: 'id', hidden: true },
    { class: 'String', name: 'name' },
    { class: 'Float', name: 'salary' }
  ]
});

foam.RELATIONSHIP({
  sourceModel: 'foam.core.demo.relationship.Professor',
  targetModel: 'foam.core.demo.relationship.Course',
  forwardName: 'courses',
  inverseName: 'professor'
});
```

```javascript
// Course.js
foam.CLASS({
  package: 'foam.core.demo.relationship',
  name: 'Course',
  ids: [ 'code' ],
  properties: [
    { class: 'String', name: 'code' },
    { class: 'String', name: 'title' },
    { class: 'Float', name: 'cost' }
  ]
});
```

After the relationship is processed, FOAM has effectively added:

```javascript
// Generated on Professor (conceptually):
{
  class: 'foam.dao.DAOProperty',
  name: 'courses',
  getter: function() {
    return this.getCourses(this.__context__);
  }
}

// Generated method on Professor:
function getCourses(x) {
  return foam.dao.RelationshipDAO.create({
    sourceId: this.id,
    targetProperty: Course.PROFESSOR,
    targetDAOKey: 'courseDAO'
  }, x);
}

// Generated on Course:
{
  class: 'Reference',
  name: 'professor',
  of: 'foam.core.demo.relationship.Professor',
  targetDAOKey: 'professorDAO'
}
```

### Using the Relationship

```javascript
// Get all courses for a professor
var courses = await professor.courses.select();
console.log(courses.array);

// Add a new course to a professor (automatically sets course.professor)
var newCourse = Course.create({ code: 'CS101', title: 'Intro to CS' });
await professor.courses.put(newCourse);
// newCourse.professor is now set to professor.id

// Navigate from course back to professor
var prof = await courseDAO.find(course.professor);
```

The `RelationshipDAO` is a filtered view of the target DAO that:
1. Automatically filters to show only objects related to the source
2. Automatically sets the inverse reference when you `put()` through it

---

## Many-to-Many Relationships (*:*)

### What Gets Generated

For `*:*` relationships, FOAM generates significantly more:

**A Junction Model:**
- Automatically created with `sourceId` and `targetId` Reference properties
- Named `<Source><Target>Junction` by default (e.g., `StudentCourseJunction`)

**On both models:**
- A **property** returning a `ManyToManyRelationshipImpl`
- A **method** `get<RelationshipName>(x)`

The `ManyToManyRelationshipImpl` provides:
- `dao` - A filtered DAO showing related objects
- `junctionDAO` - Direct access to the junction records
- `add(target)` - Create a relationship
- `remove(target)` - Remove a relationship

### Example: Student ↔ Course

```javascript
// Student.js
foam.CLASS({
  package: 'foam.core.demo.relationship',
  name: 'Student',
  ids: [ 'studentId' ],
  properties: [
    { class: 'String', name: 'name' },
    { class: 'Long', name: 'studentId' }
  ]
});

foam.RELATIONSHIP({
  sourceModel: 'foam.core.demo.relationship.Student',
  targetModel: 'foam.core.demo.relationship.Course',
  cardinality: '*:*',
  forwardName: 'courses',
  inverseName: 'students'
});
```

### The Generated Junction Model

FOAM automatically creates:

```javascript
// Generated - you don't write this
foam.CLASS({
  package: 'foam.core.demo.relationship',
  name: 'StudentCourseJunction',
  ids: ['sourceId', 'targetId'],
  properties: [
    {
      class: 'Reference',
      name: 'sourceId',
      of: 'foam.core.demo.relationship.Student'
    },
    {
      class: 'Reference',
      name: 'targetId',
      of: 'foam.core.demo.relationship.Course'
    }
  ]
});
```

You need to provide a DAO for this junction in your `services.jrl`:

```javascript
p({
  "class": "foam.core.boot.CSpec",
  "name": "studentCourseJunctionDAO",
  "serve": true,
  "serviceScript": """
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(foam.core.demo.relationship.StudentCourseJunction.getOwnClassInfo())
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .build();
  """
})
```

### Using the ManyToManyRelationship

```javascript
// Get all courses a student is enrolled in
var enrollment = student.courses;  // Returns ManyToManyRelationshipImpl
var courses = await enrollment.dao.select();
console.log(courses.array);

// Enroll a student in a course
await student.courses.add(course);

// Unenroll a student from a course
await student.courses.remove(course);

// Get all students in a course (inverse direction)
var students = await course.students.dao.select();

// Add a student to a course (same effect as student.courses.add(course))
await course.students.add(student);
```

---

## How FOAM Eliminates Junction API Complexity

### Traditional Junction Table Approach

Without FOAM, managing many-to-many relationships requires:

```javascript
// Traditional approach - lots of manual work
async function enrollStudent(studentId, courseId) {
  // 1. Create junction record manually
  await junctionDAO.put({ studentId, courseId });
}

async function getCoursesForStudent(studentId) {
  // 2. Query junction table
  var junctions = await junctionDAO
    .where(EQ(Junction.STUDENT_ID, studentId))
    .select();

  // 3. Extract course IDs
  var courseIds = junctions.array.map(j => j.courseId);

  // 4. Query courses table
  return courseDAO.where(IN(Course.ID, courseIds)).select();
}

async function getStudentsForCourse(courseId) {
  // Same tedious process in reverse...
}
```

### FOAM's Approach

With FOAM relationships, all of this complexity is hidden:

```javascript
// FOAM approach - simple and intuitive
await student.courses.add(course);              // Enroll
await student.courses.remove(course);           // Unenroll
var courses = await student.courses.dao.select(); // Get courses
var students = await course.students.dao.select(); // Get students
```

**What FOAM handles automatically:**
1. Junction model creation with proper IDs and References
2. Junction record creation/deletion when using `add()`/`remove()`
3. Proper filtering through `ManyToManyRelationshipDAO`
4. Bidirectional navigation (both `student.courses` and `course.students` work)
5. UI integration with proper views for managing relationships

---

## Advanced Configuration

### Custom Property Configuration

You can customize the generated properties:

```javascript
foam.RELATIONSHIP({
  sourceModel: 'com.example.Author',
  targetModel: 'com.example.Book',
  forwardName: 'books',
  inverseName: 'author',
  sourceProperty: {
    label: 'Published Books',
    visibility: 'RO'
  },
  targetProperty: {
    label: 'Written By',
    required: true
  }
});
```

### Custom DAO Keys

If your DAOs don't follow the default naming convention:

```javascript
foam.RELATIONSHIP({
  sourceModel: 'com.example.Team',
  targetModel: 'com.example.Player',
  forwardName: 'roster',
  inverseName: 'team',
  sourceDAOKey: 'myTeamDAO',
  targetDAOKey: 'myPlayerDAO'
});
```

### One-Way Relationships

Sometimes you only need navigation in one direction:

```javascript
foam.RELATIONSHIP({
  sourceModel: 'com.example.Order',
  targetModel: 'com.example.AuditLog',
  forwardName: 'auditLogs',
  inverseName: 'order',
  oneWay: true  // Don't add 'order' property to AuditLog
});
```

---

## UI Integration

FOAM's UI layer automatically understands relationships:

- **1:* forward property** - Renders as an embedded table/browser of related objects
- **1:* inverse property** - Renders as a reference picker/link
- **\*:\* properties** - Render with `ManyToManyRelationshipPropertyView` providing Add/Remove actions

The relationship properties respect visibility settings, so you can hide them on create forms and show them on detail views:

```javascript
foam.RELATIONSHIP({
  sourceModel: 'com.example.Project',
  targetModel: 'com.example.Task',
  forwardName: 'tasks',
  inverseName: 'project',
  sourceProperty: {
    createVisibility: 'HIDDEN',  // Don't show on create form
    updateVisibility: 'RW'       // Show when editing
  }
});
```

---

## Complete Working Example

Here's a complete example showing models, relationships, services, and usage:

### Models

```javascript
// Department.js
foam.CLASS({
  package: 'com.example.university',
  name: 'Department',
  properties: [
    { class: 'Long', name: 'id' },
    { class: 'String', name: 'name', required: true },
    { class: 'String', name: 'building' }
  ]
});

foam.RELATIONSHIP({
  sourceModel: 'com.example.university.Department',
  targetModel: 'com.example.university.Professor',
  forwardName: 'faculty',
  inverseName: 'department'
});
```

```javascript
// Professor.js
foam.CLASS({
  package: 'com.example.university',
  name: 'Professor',
  properties: [
    { class: 'Long', name: 'id' },
    { class: 'String', name: 'name', required: true },
    { class: 'EMail', name: 'email' }
  ]
});

foam.RELATIONSHIP({
  sourceModel: 'com.example.university.Professor',
  targetModel: 'com.example.university.Course',
  forwardName: 'courses',
  inverseName: 'instructor'
});
```

```javascript
// Course.js
foam.CLASS({
  package: 'com.example.university',
  name: 'Course',
  properties: [
    { class: 'String', name: 'code' },
    { class: 'String', name: 'title', required: true },
    { class: 'Int', name: 'credits', min: 1, max: 6 }
  ],
  ids: ['code']
});
```

```javascript
// Student.js
foam.CLASS({
  package: 'com.example.university',
  name: 'Student',
  properties: [
    { class: 'Long', name: 'id' },
    { class: 'String', name: 'name', required: true },
    { class: 'Int', name: 'year', min: 1, max: 4 }
  ]
});

foam.RELATIONSHIP({
  sourceModel: 'com.example.university.Student',
  targetModel: 'com.example.university.Course',
  cardinality: '*:*',
  forwardName: 'enrollments',
  inverseName: 'students'
});
```

### Services Configuration

```javascript
// services.jrl
p({
  "class": "foam.core.boot.CSpec",
  "name": "departmentDAO",
  "serve": true,
  "serviceScript": """
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.university.Department.getOwnClassInfo())
      .setSeqNo(true)
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .build();
  """
})

p({
  "class": "foam.core.boot.CSpec",
  "name": "professorDAO",
  "serve": true,
  "serviceScript": """
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.university.Professor.getOwnClassInfo())
      .setSeqNo(true)
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .build();
  """
})

p({
  "class": "foam.core.boot.CSpec",
  "name": "courseDAO",
  "serve": true,
  "serviceScript": """
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.university.Course.getOwnClassInfo())
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .build();
  """
})

p({
  "class": "foam.core.boot.CSpec",
  "name": "studentDAO",
  "serve": true,
  "serviceScript": """
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.university.Student.getOwnClassInfo())
      .setSeqNo(true)
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .build();
  """
})

// Junction DAO for Student ↔ Course many-to-many
p({
  "class": "foam.core.boot.CSpec",
  "name": "studentCourseJunctionDAO",
  "serve": true,
  "serviceScript": """
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(com.example.university.StudentCourseJunction.getOwnClassInfo())
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .build();
  """
})
```

### Usage in Application Code

```javascript
foam.CLASS({
  name: 'UniversityService',

  imports: [
    'departmentDAO',
    'professorDAO',
    'courseDAO',
    'studentDAO'
  ],

  requires: [
    'com.example.university.Department',
    'com.example.university.Professor',
    'com.example.university.Course',
    'com.example.university.Student'
  ],

  methods: [
    async function setupUniversity() {
      // Create department
      var csDept = await this.departmentDAO.put(
        this.Department.create({ name: 'Computer Science', building: 'Gates Hall' })
      );

      // Create professor in department (1:* relationship)
      var prof = this.Professor.create({ name: 'Dr. Smith', email: 'smith@uni.edu' });
      prof = await csDept.faculty.put(prof);  // Automatically sets prof.department

      // Create courses for professor (1:* relationship)
      await prof.courses.put(this.Course.create({ code: 'CS101', title: 'Intro to Programming', credits: 3 }));
      await prof.courses.put(this.Course.create({ code: 'CS201', title: 'Data Structures', credits: 4 }));

      // Create students
      var alice = await this.studentDAO.put(this.Student.create({ name: 'Alice', year: 2 }));
      var bob = await this.studentDAO.put(this.Student.create({ name: 'Bob', year: 1 }));

      // Enroll students in courses (*:* relationship)
      var cs101 = await this.courseDAO.find('CS101');
      var cs201 = await this.courseDAO.find('CS201');

      await alice.enrollments.add(cs101);
      await alice.enrollments.add(cs201);
      await bob.enrollments.add(cs101);

      // Query relationships
      console.log('Courses in CS dept:');
      var deptCourses = await csDept.faculty.select();
      for ( var p of deptCourses.array ) {
        var courses = await p.courses.select();
        console.log(`  ${p.name}: ${courses.array.map(c => c.code).join(', ')}`);
      }

      console.log('Students in CS101:');
      var cs101Students = await cs101.students.dao.select();
      console.log(`  ${cs101Students.array.map(s => s.name).join(', ')}`);

      console.log('Alice\'s courses:');
      var aliceCourses = await alice.enrollments.dao.select();
      console.log(`  ${aliceCourses.array.map(c => c.code).join(', ')}`);
    }
  ]
});
```

---

## Summary

FOAM Relationships provide:

1. **Declarative Definition** - One `foam.RELATIONSHIP()` call defines both sides
2. **Automatic Code Generation** - Properties, methods, and junction models are created for you
3. **Bidirectional Navigation** - Access relationships from either side
4. **Junction Abstraction** - For `*:*`, junction management is completely hidden
5. **UI Integration** - Relationship properties render with appropriate views
6. **Type Safety** - Reference properties provide type checking and validation
7. **DAO Composition** - Relationship DAOs filter automatically and set inverse references

The key insight: relationships are first-class citizens in FOAM. Rather than manually managing foreign keys and junction tables, you declare the relationship once and let FOAM handle all the plumbing.

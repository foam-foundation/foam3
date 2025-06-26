# FOAM3 Dashboard Quick Start Guide

This guide shows you how to create a simple dashboard in FOAM3 in just a few steps.

## What You Need

A FOAM3 dashboard requires these components:

1. **Dashboard Menu Entry** - defines your dashboard layout and widgets in `menu.jrl`
2. **Widget Menus** - hidden menu entries that define your widgets
3. **Citation Views** - for displaying individual records (optional)

## Step 1: Create Your Dashboard in menu.jrl

Add this to your `menu.jrl`:

```javascript
p({
  class: "foam.core.menu.Menu",
  id: "my.dashboard",
  keywords: ["dashboard"],
  label: "My Dashboard",
  themeIcon: "dashboard",
  handler: {
    class: "foam.core.menu.ViewMenu",
    view: {
      class: "foam.dashboard.view.DashboardView",
      main: true,
      widgets: {
        'my.dashboard.users.table': { column: 6 },
        'my.dashboard.users.count': { column: 6 }
      }
    }
  },
  order: 1
})
```

## Step 2: Create Widget Menus

Add these to your `menu.jrl`:

```javascript
// Data table widget
p({
  class: "foam.core.menu.Menu",
  id: "my.dashboard.users.table",
  label: "Users Table",
  handler: {
    class: "foam.core.menu.ViewMenu",
    view: {
      class: "foam.dashboard.view.CardWrapper",
      title: "Recent Users",
      currentView: {
        class: "foam.dashboard.view.DAOTable",
        dao: "userDAO",
        limit: 5,
        viewMore: true,
        viewMoreMenuItem: "users",
        emptyTitle: "No Users",
        emptySubTitle: "No users found"
      }
    }
  },
  parent: "hidden"
})

// Count widget
p({
  class: "foam.core.menu.Menu",
  id: "my.dashboard.users.count",
  label: "User Count",
  handler: {
    class: "foam.core.menu.ViewMenu",
    view: {
      class: "foam.dashboard.view.CardWrapper",
      title: "Total Users",
      currentView: {
        class: "foam.dashboard.model.Count",
        daoName: "userDAO"
      }
    }
  },
  parent: "hidden"
})
```

## That's It!

Your dashboard is now ready. It will show:
- A table of recent users (if you have a `userDAO`)
- A count of total users

## Grid Layout

The `column` property controls widget width and supports two approaches for layouts:

### Fixed Columns (12-column grid)
Use this approach when you want precise control over widget widths:
- `{ column: 12 }` - Full width
- `{ column: 6 }` - Half width  
- `{ column: 4 }` - Third width
- `{ column: 3 }` - Quarter width

### Fractional Units
Use this approach when you want flexible, proportional layouts:
```javascript
widgets: {
  'my.dashboard.users.count': { 
    column: '1fr'    // Takes 1 fraction of available space
  },
  'my.dashboard.users.table': { 
    column: '2fr'    // Takes 2 fractions of available space
  }
}
```

### Mixed Layouts
You can mix fixed columns and fractional units, and combine them with responsive breakpoints:

```javascript
widgets: {
  'my.dashboard.users.count': { 
    column: 12,      // Full width by default
  },
  'my.dashboard.users.table': { 
    column: '1fr',   // Takes 1 fraction of available space
    SMColumn: 6,    // Full width on small screens
    XSColumn: 12     // Full width on extra small screens
  }
}
```

Note: When using fixed columns (like 12), the maximum effective width is 6 columns. So both `column: 6` and `column: 12` will give the same result. However, when using fractional units, the full width is available.

### Responsive Breakpoints
You can specify different layouts for different screen sizes. The available column grid varies by screen size:

- `XXSColumn`: Extra extra small screens (0px - 320px) - 4 column grid
- `XSColumn`: Extra small screens (320px - 576px) - 6 column grid  
- `SMColumn`: Small screens (576px - 768px) - 12 column grid
- `MDColumn`: Medium screens (768px - 960px) - 12 column grid
- `LGColumn`: Large screens (960px - 1280px) - 12 column grid
- `XLColumn`: Extra large screens (1280px+) - 12 column grid

For complete responsive display width specifications, see `foam3/src/foam/u2/layout/DisplayWidth.js`

Choose either fixed columns or fractional units for your layout and stick with that approach consistently. This will make your dashboard layout more predictable and easier to maintain.

## Common Widget Types

### Data Table
```javascript
{
  class: "foam.dashboard.view.CardWrapper",
  title: "My Data",
  currentView: {
    class: "foam.dashboard.view.DAOTable",
    dao: "myDAO",
    limit: 5
  }
}
```

### Count Widget
```javascript
{
  class: "foam.dashboard.view.CardWrapper", 
  title: "Total Records",
  currentView: {
    class: "foam.dashboard.model.Count",
    daoName: "myDAO"
  }
}
```

### Custom Widget
```javascript
{
  class: "my.custom.Widget",
  // your custom properties
}
```


And create corresponding hidden menu entries for each widget ID.

That's all you need for a basic FOAM3 dashboard!